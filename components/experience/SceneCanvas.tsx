'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, PerspectiveCamera, Preload } from '@react-three/drei';
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
  const [minDelayDone, setMinDelayDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinDelayDone(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!minDelayDone) return;
    if (mode === 'hero') return;
    if (!active && progress >= 99) {
      setMode('hero');
    } else if (!active && progress > 30 && minDelayDone) {
      window.setTimeout(() => setMode('hero'), 600);
    }
  }, [active, progress, minDelayDone, mode]);

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
      // Performance optimizations
      frameloop="demand"
      flat={false}
      onCreated={(state) => {
        // Switch to continuous rendering once created
        state.setFrameloop('always');
        // Enable logarithmic depth buffer for large scenes
        const gl = state.gl;
        gl.sortObjects = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
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
            <Preload all />
          </>
        ) : (
          <LoadingScene quality={quality} progress={progress / 100} />
        )}
      </Suspense>

      <object3D ref={cameraGroupRef} />
    </Canvas>
  );
}
