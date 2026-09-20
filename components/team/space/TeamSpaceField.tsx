'use client';

/**
 * TeamSpaceField — Photorealistic 3D deep space voyage across isolated celestial worlds.
 *
 * Grounded in authentic planetary science & NASA astronomical photography:
 *  - Distant, elegant starting view: at page top, Mars sits distant in the upper-right sky.
 *    The title area is completely clear, dark cosmic void with pin-point stars.
 *  - Strict celestial isolation: each celestial body is encountered in its own sector.
 *    Zero crowded clutter or multiple planets in one frame.
 *  - Close-in inspection & lift-away flight choreography: camera dives close to each celestial body,
 *    highlights its surface/rings/glow, then lifts away back into open space.
 *  - Interstellar void transit: rogue cratered asteroids and exploration probe in the quiet expanse.
 *  - Deep-Sky Milky Way panorama & pin-point, non-twinkling astronomical stars.
 *  - Continuous natural zero-gravity motion and mouse parallax.
 */

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping, SMAA, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  HybridFrameGovernor,
  WebGLRendererLifecycle,
} from '@/components/performance/HybridFrameGovernor';
import { useResponsiveDpr } from '@/components/performance/useResponsiveDpr';
import { detectQuality, getReducedMotion, type Quality } from '@/lib/performance';
import { SpaceFlightRig } from './SpaceFlightRig';
import { RealisticStarfield } from './RealisticStarfield';
import { CelestialVoyage } from './CelestialVoyage';

function Scene({ quality }: { quality: Quality }) {
  const bloomEnabled = quality !== 'low';

  return (
    <>
      <SpaceFlightRig />

      {/* Deep-Sky Milky Way Panorama & Static Pin-Point Stars */}
      <RealisticStarfield />

      {/* Isolated Celestial Voyage (Mars -> Void -> Black Hole -> Saturn) */}
      <CelestialVoyage />

      {/* Cinematic Post-Processing Pipeline */}
      {bloomEnabled && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          {/* SMAA anti-aliasing — smooth planet/ring silhouettes without MSAA cost */}
          <SMAA />
          {/* Bloom: atmospheric rims, accretion disk glow, star halos */}
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.3}
            mipmapBlur
            radius={0.6}
          />
          {/* Subtle cinematic vignette — darkened edges, brighter center */}
          <Vignette offset={0.25} darkness={0.55} />
          {/* ACES filmic tone curve: cinematic HDR color response */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}

export function TeamSpaceField() {
  const [ready, setReady] = useState(false);
  const [quality, setQuality] = useState<Quality>('medium');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setQuality(detectQuality());
    setReduced(getReducedMotion());
    setReady(true);

    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq?.matches ?? false);
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  const dprMax = useResponsiveDpr(quality);

  if (!ready) return null;

  return (
    <div className="team-space" aria-hidden="true">
      <Canvas
        dpr={[Math.min(1, dprMax), dprMax]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          depth: true,
          stencil: false,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [0, 0, 0], fov: 36, near: 0.1, far: 18000 }}
        frameloop="demand"
        onCreated={({ gl }) => {
          if (process.env.NODE_ENV === 'production') gl.debug.checkShaderErrors = false;
          gl.toneMappingExposure = 1.35;
          gl.setClearAlpha(0);
        }}
      >
        <HybridFrameGovernor forceActive={!reduced} reduceMotion={reduced} startupDurationMs={1500} />
        <WebGLRendererLifecycle />
        <Scene quality={quality} />
      </Canvas>
    </div>
  );
}
