'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Object3D, AnimationClip, Mesh, MeshStandardMaterial } from 'three';
import { AnimationMixer } from 'three';
import { modelConfig } from '@/lib/modelConfig';
import { ProxyRover } from './ProxyRover';

export type ModelRigHandle = {
  group: Group | null;
  /** Set horizontal offset (in world units, after scale). */
  setOffsetX: (x: number) => void;
  /** Set a small "running" bob multiplier. 0 = idle, 1 = running. */
  setRunning: (r: boolean) => void;
  /** Optional: latest loaded scene for diagnostics. */
  hasRealModel: () => boolean;
};

/**
 * Loads the user model from the configured GLB path and exposes its
 * root group via ref. If the asset is missing or fails to load, a
 * procedural proxy is rendered instead.
 *
 * PERFORMANCE
 * -----------
 * useGLTF must be called unconditionally (Rules of Hooks). It throws a
 * Promise during Suspense while the GLB is fetching — that promise is
 * caught by the nearest <Suspense>, NOT by JS try/catch. Wrapping it in
 * try/catch made React see inconsistent hook order across renders and
 * was a major cause of "page isn't responding" on first paint.
 *
 * If the file is missing entirely, drei returns an empty scene and the
 * !main?.scene branch below renders the procedural proxy.
 *
 * The labeled GLB (`curiosity_v4_semantic_external.glb`) is
 * pre-positioned and contains NO animations, so the only thing we do
 * after mount is apply `modelConfig.scale` and mark `hasRealRef` true.
 * That runs synchronously in the useEffect (no BoundingBox traversal,
 * no requestIdleCallback defer) because the cost is now trivial.
 */
export const ModelRig = forwardRef<ModelRigHandle, { running?: boolean }>(function ModelRig(
  { running = true },
  ref,
) {
  const groupRef = useRef<Group>(null);
  const fallbackRef = useRef<Group>(null);
  const offsetXRef = useRef(0);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const hasRealRef = useRef(false);

  const main = useGLTF(modelConfig.mainPath) as { scene: Group; animations: AnimationClip[] };
  const renderScene = useMemo(() => {
    if (!main?.scene) return null;
    const clone = main.scene.clone(true);
    clone.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    });
    return clone;
  }, [main?.scene]);

  // Find a "running" clip, fall back to the first available animation.
  // For the labeled rover GLB `main.animations.length === 0` so this
  // returns null and we skip the AnimationMixer entirely.
  const clip = (() => {
    if (!main?.animations?.length) return null;
    const names = modelConfig.runningAnimationNames;
    return (
      main.animations.find((a) => names.includes(a.name)) ??
      main.animations[0]
    );
  })();

  // Apply scale and set up the AnimationMixer (only if there are
  // clips). For the labeled GLB this is just one scene.scale assignment.
  useEffect(() => {
    if (!renderScene) return undefined;
    const scene = renderScene as Object3D;

    scene.scale.setScalar(modelConfig.scale);
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.layers.enable(1);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as MeshStandardMaterial;
        if (typeof standard.envMapIntensity === 'number') standard.envMapIntensity = 1.35;
        standard.needsUpdate = true;
      });
    });
    hasRealRef.current = true;

    if (clip) {
      const mixer = new AnimationMixer(scene);
      mixerRef.current = mixer;
      const action = mixer.clipAction(clip);
      action.reset().fadeIn(0.2).play();
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current.uncacheRoot(scene);
        mixerRef.current = null;
      }
      scene.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [renderScene, clip]);

  // Drive any authored mixer animation from R3F's own frame loop instead of a
  // parallel requestAnimationFrame loop. This eliminates a third rAF
  // stack competing with Lenis and R3F, which was a major contributor
  // to the page feeling unresponsive at startup.
  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  useImperativeHandle(ref, () => ({
    get group() {
      return (groupRef.current ?? fallbackRef.current) as Group | null;
    },
    setOffsetX(x) {
      offsetXRef.current = x;
      const g = groupRef.current ?? fallbackRef.current;
      if (g) g.position.x = (modelConfig.basePosition[0] ?? 0) + x;
    },
    setRunning(r) {
      if (mixerRef.current) {
        mixerRef.current.timeScale = r ? 1 : 0;
      }
    },
    hasRealModel() {
      return hasRealRef.current;
    },
  }));

  if (!renderScene) {
    return (
      <group name="rover-model-rig" ref={fallbackRef} position={modelConfig.basePosition} rotation={[0, modelConfig.rotationY, 0]}>
        <ProxyRover running={running} />
        <RoverSoilOccluder />
      </group>
    );
  }

  return (
    <group
      name="rover-model-rig"
      ref={groupRef}
      position={modelConfig.basePosition}
      rotation={[0, modelConfig.rotationY, 0]}
    >
      <primitive object={renderScene} />
      <RoverSoilOccluder />
    </group>
  );
});

function RoverSoilOccluder() {
  return (
    <mesh name="rover-soil-occluder" position={[0, 1.05, 0]}>
      {/* Broad-phase only. SoilInteraction resolves any hit inside this box
          against the actual rover meshes before rejecting the ground. */}
      <boxGeometry args={[4.2, 2.5, 3.15]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

// Preload the labelled GLB as soon as this module is parsed.
// `useGLTF` writes to drei's cache, so once SceneCanvas + HeroScene
// actually mount, `useGLTF(modelConfig.mainPath)` resolves synchronously
// from cache — the network fetch begins here, during JS parse, instead
// of competing with first paint.
useGLTF.preload(modelConfig.mainPath);
