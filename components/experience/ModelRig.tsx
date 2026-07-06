'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Object3D, AnimationClip } from 'three';
import { AnimationMixer, Box3, Vector3 } from 'three';
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
 * Schedule heavy synchronous work for after the browser goes idle.
 * The bounding-box walk on a 11 MB GLB is non-trivial; running it on
 * first paint was contributing to long tasks that triggered the
 * "page isn't responding" warning.
 */
function whenIdle(cb: () => void, timeout = 250) {
  if (typeof window === 'undefined') return;
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(cb, { timeout });
  } else {
    window.setTimeout(cb, Math.min(timeout, 50));
  }
}

/**
 * Loads the user model from the configured GLB path and exposes its
 * root group via ref. If the asset is missing or fails to load, a
 * procedural proxy is rendered instead.
 *
 * Works with both animated and static GLBs. Static models (no clips)
 * get a gentle idle bob via the wrapper group's `position.y`.
 */
export const ModelRig = forwardRef<ModelRigHandle, { running?: boolean }>(function ModelRig(
  { running = true },
  ref,
) {
  const groupRef = useRef<Group>(null);
  const fallbackRef = useRef<Group>(null);
  const offsetXRef = useRef(0);
  const baseY = modelConfig.basePosition[1] ?? 0;
  const mixerRef = useRef<AnimationMixer | null>(null);
  const hasRealRef = useRef(false);

  // useGLTF must be called unconditionally (Rules of Hooks). It throws a
  // Promise during Suspense while the GLB is fetching — that promise is
  // caught by the nearest <Suspense>, NOT by JS try/catch. Wrapping it in
  // try/catch made React see inconsistent hook order across renders and
  // was a major cause of "page isn't responding" on first paint.
  // If the file is missing entirely, drei returns an empty scene and the
  // !main?.scene branch below renders the procedural proxy.
  const main = useGLTF(modelConfig.mainPath) as { scene: Group; animations: AnimationClip[] };

  // Find a "running" clip, fall back to the first available animation.
  const clip = (() => {
    if (!main?.animations?.length) return null;
    const names = modelConfig.runningAnimationNames;
    return (
      main.animations.find((a) => names.includes(a.name)) ??
      main.animations[0]
    );
  })();

  // Set up an AnimationMixer once the model is mounted. We defer the
  // expensive bounding-box walk into requestIdleCallback so it doesn't
  // block the first paint.
  useEffect(() => {
    if (!main?.scene) return undefined;
    const scene = main.scene as Object3D;

    const finalize = () => {
      const root = groupRef.current;
      if (!root) return;
      hasRealRef.current = true;

      // Center + ground the model: translate the root so the model's
      // bounding box sits with its lowest point at y = 0. This makes
      // the hotspots in modelConfig.ts map cleanly regardless of how
      // the user's GLB is authored.
      scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(scene);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);
      if (isFinite(size.y) && size.y > 0) {
        const lift = -box.min.y;
        scene.position.set(-center.x, lift, -center.z);
        // Auto-scale: if the model is taller than ~3 units or shorter than 0.5,
        // normalise it to roughly 2 units tall so framing in scene config is stable.
        if (size.y > 3 || size.y < 0.5) {
          const k = 2 / size.y;
          scene.scale.setScalar(k * modelConfig.scale);
        } else {
          scene.scale.setScalar(modelConfig.scale);
        }
      } else {
        scene.scale.setScalar(modelConfig.scale);
      }

      if (clip) {
        const mixer = new AnimationMixer(scene);
        mixerRef.current = mixer;
        const action = mixer.clipAction(clip);
        action.reset().fadeIn(0.2).play();
      }
    };

    // Yield to the browser before doing the bounding-box traversal.
    whenIdle(finalize, 200);

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current.uncacheRoot(scene);
        mixerRef.current = null;
      }
    };
  }, [main?.scene, clip]);

  // Drive the mixer / idle bob from R3F's own frame loop instead of a
  // parallel requestAnimationFrame loop. This eliminates a third rAF
  // stack competing with Lenis and R3F, which was a major contributor
  // to the page feeling unresponsive at startup.
  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
      return;
    }
    const g = groupRef.current;
    if (g) {
      g.position.y = baseY + Math.sin(performance.now() * 0.0015) * modelConfig.fallbackBobAmplitude;
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

  if (!main?.scene) {
    return (
      <group ref={fallbackRef} position={modelConfig.basePosition} rotation={[0, modelConfig.rotationY, 0]}>
        <ProxyRover running={running} />
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={modelConfig.basePosition}
      rotation={[0, modelConfig.rotationY, 0]}
    >
      <primitive object={main.scene} />
    </group>
  );
});

// Preload the configured model. preload() is synchronous and safe to call
// at module load — it just kicks off the fetch. Errors surface through the
// Suspense boundary in the rendering tree, no try/catch needed here.
useGLTF.preload(modelConfig.mainPath);
