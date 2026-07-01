'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
  const runningRef = useRef(running);
  runningRef.current = running;
  const hasRealRef = useRef(false);

  // Try to load the main model. useGLTF will throw inside Suspense
  // if the file is still loading. If the file is missing entirely,
  // Suspense shows the fallback (LoadingScene with proxy).
  let main: { scene: Group; animations: AnimationClip[] } | null = null;
  try {
    main = useGLTF(modelConfig.mainPath) as { scene: Group; animations: AnimationClip[] };
  } catch {
    // Model failed to load — will render the proxy fallback below.
    main = null;
  }

  // Find a "running" clip, fall back to the first available animation.
  const clip = (() => {
    if (!main?.animations?.length) return null;
    const names = modelConfig.runningAnimationNames;
    return (
      main.animations.find((a) => names.includes(a.name)) ??
      main.animations[0]
    );
  })();

  // Set up an AnimationMixer once the model is mounted.
  useEffect(() => {
    if (!main?.scene) return undefined;
    const root = groupRef.current;
    if (!root) return undefined;
    hasRealRef.current = true;

    // Center + ground the model: translate the root so the model's
    // bounding box sits with its lowest point at y = 0. This makes
    // the hotspots in modelConfig.ts map cleanly regardless of how
    // the user's GLB is authored.
    const scene = main.scene as Object3D;
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
      return () => {
        action.fadeOut(0.2);
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
        mixerRef.current = null;
      };
    }
    return undefined;
  }, [main?.scene, clip]);

  // Drive the mixer / idle bob every frame at the Canvas level.
  // We do this here instead of via useFrame to keep the rig portable.
  useEffect(() => {
    if (!main?.scene) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (mixerRef.current) {
        mixerRef.current.update(dt);
      } else {
        // No animation: gentle idle bob (kept small so it reads as breathing).
        const g = groupRef.current;
        if (g) g.position.y = baseY + Math.sin(now * 0.0015) * modelConfig.fallbackBobAmplitude;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [main?.scene, baseY]);

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

// Preload the configured model. Failures are caught by Suspense.
try {
  useGLTF.preload(modelConfig.mainPath);
} catch {
  // Preload may fail if the path is invalid — that's OK, handled at render time.
}
