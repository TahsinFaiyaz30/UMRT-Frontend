'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, PerspectiveCamera } from '@react-three/drei';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { detectQuality, dprFor, type Quality, getReducedMotion } from '@/lib/performance';
import { LoadingScene } from './LoadingScene';
import { HeroScene } from './HeroScene';
import { ScrollDirector } from './ScrollDirector';
import { FreeExploreControls } from './FreeExploreControls';
import type { ModelRigHandle } from './ModelRig';

type SceneMode = 'loading' | 'hero';

/**
 * R3F Canvas + scene root.
 *
 * Rendering pipeline:
 * - Uses WebGL2 with ACES Filmic tone mapping for cinematic color grading
 * - WebGL2 maps to DirectX 11/12 on Windows (via ANGLE), Metal on macOS,
 *   OpenGL ES / Vulkan on Android — the browser handles native dispatch
 * - Adaptive DPR and quality via PerformanceMonitor
 * - Proper color management (SRGBColorSpace output)
 */
export function SceneCanvas({
  progressRef,
  reduceMotion,
}: {
  progressRef: React.RefObject<number>;
  reduceMotion: boolean;
}) {
  const [quality, setQuality] = useState<Quality>(() => detectQuality());
  const [mode, setMode] = useState<SceneMode>('loading');
  const { active, progress } = useProgress();
  const cameraGroupRef = useRef<Group | null>(null);
  const rigRef = useRef<ModelRigHandle | null>(null);
  // Keep the renderer in `frameloop="demand"` until the user actually
  // scrolls or interacts with the page. This prevents the WebGL renderer
  // from painting every frame from t=0 (which is what was making the
  // page feel "not responding" during the very first long task).
  const [alwaysRender, setAlwaysRender] = useState(false);

  // Switch to the hero scene as soon as the GLB + textures finish
  // loading — no artificial 900 ms or 600 ms delays. If everything is
  // cached, the user sees the hero on the next animation frame.
  // We require both `!active` (no asset currently in-flight) AND
  // `progress >= 100` to ensure the procedural running-rover stays
  // visible until the real model has truly finished loading.
  useEffect(() => {
    if (mode === 'hero') return;
    if (!active && progress >= 100) {
      setMode('hero');
    }
  }, [active, progress, mode]);

  // Promote the Canvas to a continuous render loop on first real
  // interaction. Before that, R3F only paints when something calls
  // `invalidate()` (e.g. a `useFrame` returning after state change).
  useEffect(() => {
    if (alwaysRender) return;
    const enable = () => setAlwaysRender(true);
    window.addEventListener('pointerdown', enable, { once: true, passive: true });
    window.addEventListener('wheel', enable, { once: true, passive: true });
    window.addEventListener('scroll', enable, { once: true, passive: true });
    window.addEventListener('keydown', enable, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('wheel', enable);
      window.removeEventListener('scroll', enable);
      window.removeEventListener('keydown', enable);
    };
  }, [alwaysRender]);

  const dprMax = useMemo(() => dprFor(quality), [quality]);

  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={[1, dprMax]}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        // Tone mapping for cinematic look — applied by Three.js renderer
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        // Color management
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 1.6, 14], fov: 38, near: 0.1, far: 200 }}
      style={{ background: '#4A2818' }}
      // Stay in demand mode while idle so the GPU isn't woken up on
      // every frame for no reason. We flip to "always" as soon as the
      // user actually interacts (see the effect above).
      frameloop={alwaysRender ? 'always' : 'demand'}
      flat={false}
      onCreated={(state) => {
        const gl = state.gl;
        gl.sortObjects = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        // Mark the canvas as opaque and don't waste GPU on background
        // clears every frame while still in demand mode.
        gl.setClearColor('#4A2818', 1);
      }}
    >
      <PerformanceMonitor
        onDecline={() => setQuality((q) => (q === 'high' ? 'medium' : 'low'))}
        onIncline={() => setQuality((q) => (q === 'low' ? 'medium' : 'high'))}
        flipflops={3}
        onFallback={() => setQuality('low')}
      />
      <PerspectiveCamera makeDefault position={[0, 1.6, 14]} fov={38} near={0.1} far={200} />

      <Suspense fallback={<LoadingScene quality={quality} progress={progress / 100} />}>
        {mode === 'hero' ? (
          <>
            <HeroScene ref={rigRef as React.RefObject<ModelRigHandle>} quality={quality} />
            <ScrollDirector
              progressRef={progressRef}
              rigRef={rigRef}
              cameraGroupRef={cameraGroupRef}
              reduceMotion={reduceMotion || getReducedMotion()}
            />
            <FreeExploreControls progressRef={progressRef} />
          </>
        ) : (
          <LoadingScene quality={quality} progress={progress / 100} />
        )}
      </Suspense>

      <object3D ref={cameraGroupRef} />
    </Canvas>
  );
}
