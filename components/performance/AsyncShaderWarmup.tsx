'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Build every GPU program a scene owns before its first real draw.
 *
 * Three links programs lazily and then reads each program's info log the first
 * time it is used. That readback is synchronous, so it forces the driver to
 * finish the whole queued compilation inside one task — several seconds of
 * frozen main thread on a scene assembled from procedural noise shaders, once
 * per WebGL context. Warming through `compileAsync`
 * (KHR_parallel_shader_compile) moves the work off the critical frame and
 * paces it one program at a time, behind whatever loading state the route is
 * already showing.
 */
export function AsyncShaderWarmup({
  readyRef,
  onReady,
}: {
  /** Set to true once every program is linked. */
  readyRef?: RefObject<boolean>;
  /** Fired once, on the same tick `readyRef` flips. */
  onReady?: () => void;
}) {
  const { gl, scene, camera, invalidate } = useThree();
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const cancelledRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const finish = useCallback(() => {
    if (cancelledRef.current || doneRef.current) return;
    doneRef.current = true;
    if (readyRef) readyRef.current = true;
    invalidate();
    onReadyRef.current?.();
  }, [invalidate, readyRef]);

  // A `frameloop="demand"` canvas only draws when something asks it to, and a
  // canvas mounted ahead of its section may have its frame governor suspended.
  // Keep requesting frames until the warm-up owns one, then stop.
  useEffect(() => {
    if (doneRef.current) return undefined;
    invalidate();
    const timer = window.setInterval(() => {
      if (startedRef.current || doneRef.current) {
        window.clearInterval(timer);
        return;
      }
      invalidate();
    }, 100);
    return () => window.clearInterval(timer);
  }, [invalidate]);

  // Kicks off KHR_parallel_shader_compile on the first frame it sees. Drawing
  // is deliberately not this component's job — see SceneRenderLoop.
  useFrame(() => {
    if (doneRef.current || startedRef.current) return;
    startedRef.current = true;
    void compileShadersInBatches(gl, scene, camera, () => cancelledRef.current).then(
      (completed) => {
        if (!completed) return;
        finish();
      },
      () => {
        // Unsupported/broken extensions must never strand the loading screen;
        // fall back to the browser's normal first-render compilation path.
        finish();
      },
    );
  }, 1);

  return null;
}

/**
 * Owns `gl.render()` for a canvas that is warming its shaders.
 *
 * Any `useFrame` with a positive priority switches off R3F's automatic
 * rendering for the whole canvas, which makes drawing an explicit
 * responsibility. That responsibility must not live inside a `<Suspense>`
 * boundary: a subtree that re-suspends mid-scroll — a lazily mounted rig, a
 * texture that was not cached — takes its `useFrame` subscriptions down with
 * it, and a canvas that stops drawing shows its clear colour rather than its
 * last frame. Mount this outside the boundary and the picture survives every
 * suspension underneath it.
 *
 * Before the warm-up reports ready it draws nothing, so the first real frame
 * still lands after the programs are linked.
 */
export function SceneRenderLoop({ readyRef }: { readyRef: RefObject<boolean> }) {
  const { gl, scene, camera } = useThree();

  useFrame(() => {
    if (!readyRef.current) return;
    gl.render(scene, camera);
  }, 2);

  return null;
}

export async function compileShadersInBatches(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  cancelled: () => boolean,
) {
  const renderables: THREE.Object3D[] = [];
  // Objects that start hidden — a teardown rig, a phenomenon waiting for its
  // turn in the cycle — still need their programs now. Compiling them when
  // they first become visible would move the freeze into mid-scroll instead of
  // removing it.
  scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh
      || object instanceof THREE.Points
      || object instanceof THREE.Line
      || object instanceof THREE.Sprite
    ) {
      // A shallow clone preserves material, geometry, morph/skinning and
      // instancing flags without reparenting or duplicating heavyweight data.
      renderables.push(object.clone(false));
    }
  });

  const batch = new THREE.Group();
  for (const renderable of renderables) {
    if (cancelled()) return false;
    batch.add(renderable);
    const programsBefore = gl.info.programs?.length ?? 0;
    await gl.compileAsync(batch, camera, scene);
    batch.clear();

    // Cached material variants finish immediately. Yield only when this
    // object introduced a new GPU program, preventing ANGLE from launching
    // the entire compiler pool in one high-usage burst.
    if ((gl.info.programs?.length ?? 0) > programsBefore) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 24));
    }
  }

  if (cancelled()) return false;
  // Confirm every variant is ready; this is normally an immediate cache hit.
  await gl.compileAsync(scene, camera);
  return !cancelled();
}
