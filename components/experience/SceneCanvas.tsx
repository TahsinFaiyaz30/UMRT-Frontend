'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { detectQuality, dprFor, type Quality, getReducedMotion } from '@/lib/performance';
import { modelConfig } from '@/lib/modelConfig';
import { disposeObjectResources } from '@/lib/threeDisposal';
import {
  HybridFrameGovernor,
  WebGLRendererLifecycle,
} from '@/components/performance/HybridFrameGovernor';
import { HeroScene } from './HeroScene';
import { ScrollDirector } from './ScrollDirector';
import { FreeExploreControls } from './FreeExploreControls';
import type { ModelRigHandle } from './ModelRig';

/**
 * R3F Canvas + scene root.
 *
 * No component-quality staging. The Canvas paints the live Mars background colour
 * (set both via `style.background` and `gl.setClearColor`) on the very
 * first frame. Inside the Canvas we render `HeroScene` immediately —
 * it owns the GLB load via `useGLTF` (with `useGLTF.preload()` at
 * module scope on ModelRig) so the network fetch starts during JS
 * parse, not after any "ready" signal. While GLB parses, the R3F
 * `<Suspense>` renders `MinimalPlaceholder` which paints the same
 * Mars colour. Once resources resolve, the complete scene is shader-warmed
 * behind the existing loader before its first full draw, so there is no
 * reduced-detail intermediate frame or shader-compile freeze.
 *
 * - WebGL2 with ACES Filmic tone mapping
 * - Capability-selected quality with a bounded, stable render DPR
 * - Hybrid rendering: 60 FPS while active, low cadence while idle, paused hidden
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
  const shaderReadyRef = useRef(false);

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
        // Three's production default still synchronously asks WebGL for every
        // program/shader info log on first use. On Chromium this forces the
        // driver to finish the whole scene's parallel shader compilation in a
        // single multi-second task. All custom shaders remain checked in dev;
        // skip only that diagnostic readback in the tested production build.
        if (process.env.NODE_ENV === 'production') gl.debug.checkShaderErrors = false;
        gl.sortObjects = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.18;
        gl.setClearColor('#080302', 1);
        // Camera motion does not change a directional light's world-space
        // shadow map. Re-render it only when the sun, terrain, or a shadow-
        // casting model actually moves; the relevant scene components set
        // needsUpdate at those exact moments.
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
      }}
    >
      <HybridFrameGovernor forceActive={dismantleActive} reduceMotion={prefersReduced} />
      <WebGLRendererLifecycle />
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
        <ModelResourceLifecycle />
        <HeroScene
          ref={rigRef as unknown as RefObject<ModelRigHandle>}
          quality={quality}
          dismantleProgressRef={dismantleProgressRef}
          dismantleTimelineRef={dismantleTimelineRef}
          dismantleActive={dismantleActive}
        />
        <AsyncShaderWarmup readyRef={shaderReadyRef} />
        <ScrollDirector
          progressRef={progressRef}
          pointerRef={pointerRef}
          rigRef={rigRef}
          cameraGroupRef={cameraGroupRef}
          reduceMotion={prefersReduced}
        />
        <FreeExploreControls progressRef={progressRef} />
        <SceneReadySignal shaderReadyRef={shaderReadyRef} onReady={onReady} />
      </Suspense>

      <object3D ref={cameraGroupRef} />
    </Canvas>
  );
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

function AsyncShaderWarmup({ readyRef }: { readyRef: RefObject<boolean> }) {
  const { gl, scene, camera, invalidate } = useThree();
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // A positive render priority takes over R3F's automatic render. The first
  // frame starts KHR_parallel_shader_compile without drawing; later requested
  // frames use the normal renderer after all programs report ready.
  useFrame(() => {
    if (readyRef.current) {
      gl.render(scene, camera);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void compileShadersInBatches(gl, scene, camera, () => cancelledRef.current).then(
      (completed) => {
        if (!completed) return;
        if (cancelledRef.current) return;
        readyRef.current = true;
        invalidate();
      },
      () => {
        // Unsupported/broken extensions must never strand the loading screen;
        // fall back to the browser's normal first-render compilation path.
        if (cancelledRef.current) return;
        readyRef.current = true;
        invalidate();
      },
    );
  }, 1);

  return null;
}

async function compileShadersInBatches(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  cancelled: () => boolean,
) {
  const renderables: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
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

function SceneReadySignal({
  shaderReadyRef,
  onReady,
}: {
  shaderReadyRef: RefObject<boolean>;
  onReady?: () => void;
}) {
  const frames = useRef(0);
  const fired = useRef(false);

  useFrame(() => {
    if (fired.current) return;
    if (!shaderReadyRef.current) return;
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
// hybrid-loop frames that begin before useGLTF resolves.
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
