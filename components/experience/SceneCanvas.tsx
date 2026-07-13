'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { detectQuality, dprFor, type Quality, getReducedMotion } from '@/lib/performance';
import { modelConfig } from '@/lib/modelConfig';
import { disposeObjectResources } from '@/lib/threeDisposal';
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
 * - Capability-selected quality with a bounded, stable render DPR
 * - Activity-aware rendering for the atmospheric and soil simulations
 */
export function SceneCanvas({
  progressRef,
  pointerRef,
  reduceMotion,
  dismantleProgressRef,
  dismantleTimelineRef,
  dismantleActive,
  onReady,
}: {
  progressRef: RefObject<number>;
  pointerRef: RefObject<{ x: number; y: number }>;
  reduceMotion: boolean;
  /** 0..1 progress of the 6-second teardown animation. Null = idle. */
  dismantleProgressRef: RefObject<number>;
  /** 0..1 elapsed time through the full teardown animation. */
  dismantleTimelineRef: RefObject<number>;
  /** True while the teardown scene is mounted (during the 6 s window). */
  dismantleActive: boolean;
  onReady?: () => void;
}) {
  const quality = useMemo<Quality>(() => detectQuality(), []);
  const cameraGroupRef = useRef<Group | null>(null);
  const rigRef = useRef<ModelRigHandle | null>(null);

  const dprMax = useMemo(() => dprFor(quality), [quality]);
  const prefersReduced = reduceMotion || getReducedMotion();

  return (
    <Canvas
      shadows
      dpr={[Math.min(1, dprMax), dprMax]}
      gl={{
        antialias: dprMax <= 1.25,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [5.45, 1.55, 7.0], fov: 32, near: 0.1, far: 200 }}
      style={{ background: '#080302' }}
      frameloop="demand"
      flat={false}
      onCreated={(state) => {
        const gl = state.gl;
        gl.sortObjects = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.18;
        gl.setClearColor('#080302', 1);
      }}
    >
      <FrameGovernor dismantleActive={dismantleActive} reduceMotion={prefersReduced} />
      <PerspectiveCamera
        makeDefault
        position={[5.45, 1.55, 7.0]}
        fov={32}
        near={0.1}
        far={200}
        onUpdate={(camera) => camera.layers.enable(1)}
      />

      {/* Live HeroScene is mounted immediately. While the GLB inside
          <HeroScene> is parsing, R3F <Suspense> renders <MinimalPlaceholder>
          which paints the same Mars background — no visible flash between
          "first paint" and "GLB ready". */}
      <Suspense fallback={<MinimalPlaceholder />}>
        <RendererResourceLifecycle />
        <ModelResourceLifecycle />
        <HeroScene
          ref={rigRef as unknown as RefObject<ModelRigHandle>}
          quality={quality}
          dismantleProgressRef={dismantleProgressRef}
          dismantleTimelineRef={dismantleTimelineRef}
          dismantleActive={dismantleActive}
        />
        <ScrollDirector
          progressRef={progressRef}
          pointerRef={pointerRef}
          rigRef={rigRef}
          cameraGroupRef={cameraGroupRef}
          reduceMotion={prefersReduced}
        />
        <FreeExploreControls progressRef={progressRef} />
        <SceneReadySignal onReady={onReady} />
      </Suspense>

      <object3D ref={cameraGroupRef} />
    </Canvas>
  );
}

const ACTIVE_FRAME_INTERVAL_MS = 1_000 / 24;
const IDLE_FRAME_INTERVAL_MS = 1_000 / 10;
const REDUCED_MOTION_FRAME_INTERVAL_MS = 1_000 / 4;
const ACTIVITY_TAIL_MS = 1_200;

/**
 * Keep interaction fluid without rendering an expensive WebGL scene at full
 * speed forever. Demand mode stops completely while hidden, runs at a quiet
 * cinematic cadence while idle, and wakes immediately for user input.
 */
function FrameGovernor({
  dismantleActive,
  reduceMotion,
}: {
  dismantleActive: boolean;
  reduceMotion: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const activityUntilRef = useRef(0);
  const lastRenderedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const timerRef = useRef<number | null>(null);
  const scheduleNextRef = useRef<() => void>(() => undefined);

  useFrame(() => {
    lastRenderedAtRef.current = performance.now();
    scheduleNextRef.current();
  });

  useEffect(() => {
    let disposed = false;

    const clearTimer = () => {
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const scheduleNext = () => {
      clearTimer();
      if (disposed || document.hidden) return;
      const active = dismantleActive || performance.now() < activityUntilRef.current;
      const delay = active
        ? ACTIVE_FRAME_INTERVAL_MS
        : reduceMotion
          ? REDUCED_MOTION_FRAME_INTERVAL_MS
          : IDLE_FRAME_INTERVAL_MS;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!disposed && !document.hidden) invalidate();
      }, delay);
    };

    scheduleNextRef.current = scheduleNext;

    const markActive = () => {
      const now = performance.now();
      activityUntilRef.current = now + ACTIVITY_TAIL_MS;
      clearTimer();
      if (document.hidden) return;
      const remaining = ACTIVE_FRAME_INTERVAL_MS - (now - lastRenderedAtRef.current);
      if (remaining <= 0) {
        invalidate();
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!disposed && !document.hidden) invalidate();
      }, remaining);
    };

    const handleVisibility = () => {
      if (document.hidden) clearTimer();
      else markActive();
    };

    const passive = { passive: true } as const;
    window.addEventListener('pointerdown', markActive, passive);
    window.addEventListener('pointermove', markActive, passive);
    window.addEventListener('pointerup', markActive, passive);
    window.addEventListener('touchmove', markActive, passive);
    window.addEventListener('wheel', markActive, passive);
    window.addEventListener('scroll', markActive, passive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('focus', markActive);
    document.addEventListener('visibilitychange', handleVisibility);
    markActive();

    return () => {
      disposed = true;
      clearTimer();
      scheduleNextRef.current = () => undefined;
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('pointermove', markActive);
      window.removeEventListener('pointerup', markActive);
      window.removeEventListener('touchmove', markActive);
      window.removeEventListener('wheel', markActive);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('focus', markActive);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dismantleActive, invalidate, reduceMotion]);

  return null;
}

/**
 * R3F releases the WebGL context on unmount, but Chromium can keep the lost
 * canvas native object alive while it finishes GPU teardown. Detach it before
 * React removes the page subtree so that native retention cannot pin the
 * entire previous route in memory.
 */
function RendererResourceLifecycle() {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => () => {
    const canvas = gl.domElement;
    gl.setAnimationLoop(null);
    canvas.remove();
  }, [gl]);

  return null;
}

/** Keep the shared GLTF alive for scene swaps, then release its cache on route exit. */
function ModelResourceLifecycle() {
  const gltf = useGLTF(modelConfig.mainPath);

  useEffect(() => () => {
    disposeObjectResources(gltf.scene, {
      geometries: true,
      materials: true,
      textures: true,
    });
    useGLTF.clear(modelConfig.mainPath);
  }, [gltf.scene]);

  return null;
}

function SceneReadySignal({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  const fired = useRef(false);

  useFrame(() => {
    if (fired.current) return;
    frames.current += 1;
    if (frames.current < 3) return;
    fired.current = true;
    onReady?.();
  });

  return null;
}

// ---------------------------------------------------------------------
// MinimalPlaceholder
//
// Ultra-cheap first-paint scene. Same lighting direction + background
// as the live HeroScene so the transition to the real scene is invisible.
// One slowly-spinning cube gives the GPU something to render even on
// demand-loop frames that begin before useGLTF resolves.
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
      <ambientLight intensity={0.5} color={'#ffb16b'} />
      <directionalLight position={[5, 8, 4]} intensity={2.2} color={'#fff1d2'} />
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial
          color={'#ff5a1f'}
          roughness={0.7}
          emissive={'#3a1408'}
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}
