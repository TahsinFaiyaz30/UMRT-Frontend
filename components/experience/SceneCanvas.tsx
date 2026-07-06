'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { detectQuality, dprFor, type Quality, getReducedMotion } from '@/lib/performance';
import { HeroScene } from './HeroScene';
import { ScrollDirector } from './ScrollDirector';
import { FreeExploreControls } from './FreeExploreControls';
import type { ModelRigHandle } from './ModelRig';

/**
 * R3F Canvas + scene root.
 *
 * NO staged loader. The Canvas paints the live Mars background colour
 * (set both via `style.background` and `gl.setClearColor`) on the very
 * first frame. Inside the Canvas we render `HeroScene` immediately —
 * it owns the GLB load via `useGLTF` (with `useGLTF.preload()` at
 * module scope on ModelRig) so the network fetch starts during JS
 * parse, not after any "ready" signal. While GLB parses, the R3F
 * `<Suspense>` renders `MinimalPlaceholder` which paints the same
 * Mars colour, so the page reads as fully loaded with no flicker.
 *
 * - WebGL2 with ACES Filmic tone mapping
 * - Adaptive DPR + quality via PerformanceMonitor
 * - `frameloop="demand"` until first user interaction (saves battery
 *   and stops the GPU running while the user is sitting still).
 */
export function SceneCanvas({
  progressRef,
  reduceMotion,
  dismantleProgressRef,
  dismantleTimelineRef,
  dismantleActive,
}: {
  progressRef: RefObject<number>;
  reduceMotion: boolean;
  /** 0..1 progress of the 6-second teardown animation. Null = idle. */
  dismantleProgressRef: RefObject<number>;
  /** 0..1 elapsed time through the full teardown animation. */
  dismantleTimelineRef: RefObject<number>;
  /** True while the teardown scene is mounted (during the 6 s window). */
  dismantleActive: boolean;
}) {
  const [quality, setQuality] = useState<Quality>(() => detectQuality());
  const cameraGroupRef = useRef<Group | null>(null);
  const rigRef = useRef<ModelRigHandle | null>(null);
  const [alwaysRender, setAlwaysRender] = useState(false);

  // Promote to continuous render loop on first real interaction.
  useEffect(() => {
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
  }, []);

  const dprMax = useMemo(() => dprFor(quality), [quality]);
  const prefersReduced = reduceMotion || getReducedMotion();

  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={[1, dprMax]}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 1.6, 14], fov: 38, near: 0.1, far: 200 }}
      style={{ background: '#4A2818' }}
      frameloop={alwaysRender ? 'always' : 'demand'}
      flat={false}
      onCreated={(state) => {
        const gl = state.gl;
        gl.sortObjects = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
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

      {/* Live HeroScene is mounted immediately. While the GLB inside
          <HeroScene> is parsing, R3F <Suspense> renders <MinimalPlaceholder>
          which paints the same Mars background — no visible flash between
          "first paint" and "GLB ready". */}
      <Suspense fallback={<MinimalPlaceholder />}>
        <HeroScene
          ref={rigRef as unknown as RefObject<ModelRigHandle>}
          quality={quality}
          dismantleProgressRef={dismantleProgressRef}
          dismantleTimelineRef={dismantleTimelineRef}
          dismantleActive={dismantleActive}
        />
        <ScrollDirector
          progressRef={progressRef}
          rigRef={rigRef}
          cameraGroupRef={cameraGroupRef}
          reduceMotion={prefersReduced}
        />
        <FreeExploreControls progressRef={progressRef} />
      </Suspense>

      <object3D ref={cameraGroupRef} />
    </Canvas>
  );
}

// ---------------------------------------------------------------------
// MinimalPlaceholder
//
// Ultra-cheap first-paint scene. Same lighting direction + background
// as the live HeroScene so the transition to the real scene is invisible.
// One slowly-spinning cube gives the GPU something to render even on
// `frameloop="always"` runs that begin before useGLTF resolves.
// ---------------------------------------------------------------------
function MinimalPlaceholder() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
      meshRef.current.rotation.x += delta * 0.15;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.85} color={'#D0A880'} />
      <directionalLight position={[5, 8, 4]} intensity={1.2} color={'#FFE0C0'} />
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial
          color={'#b8431b'}
          roughness={0.7}
          emissive={'#3a1408'}
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}
