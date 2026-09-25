'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HybridFrameGovernor } from '@/components/performance/HybridFrameGovernor';
import { SpaceFlightRig } from './SpaceFlightRig';
import { RealisticStarfield } from './RealisticStarfield';
import { CelestialVoyage } from './CelestialVoyage';
import { SpacePostProcessing } from './SpacePostProcessing';
import { TransitDebris } from './TransitDebris';

class SpaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function SpaceScene({ reduced, onOpeningReady }: { reduced: boolean; onOpeningReady: (ready: boolean) => void }) {
  const gl = useThree((state) => state.gl);
  const [lostContext, setLostContext] = useState(false);
  useEffect(() => {
    const canvas = gl.domElement;
    // Unmount owned GPU resources while the context is lost. Recreating the
    // whole Canvas after restoration would dispose old framebuffers against
    // the restored context; rebuilding just this subtree avoids stale handles.
    const lost = (event: Event) => {
      event.preventDefault();
      setLostContext(true);
      window.dispatchEvent(new Event('team-space-reset'));
    };
    const restored = () => {
      setLostContext(false);
      window.dispatchEvent(new Event('team-space-reset'));
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl]);
  if (lostContext) return null;
  return (
    <>
      <HybridFrameGovernor forceActive={!reduced} reduceMotion={reduced} />
      <SpaceFlightRig />
      <RealisticStarfield />
      <CelestialVoyage onOpeningReady={onOpeningReady} />
      <TransitDebris />
      <SpacePostProcessing />
    </>
  );
}

/** One visual specification on every device; only work scheduling is adaptive. */
export function TeamSpaceField() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [openingReady, setOpeningReady] = useState(false);
  useEffect(() => {
    // A future page-loading animation can wait for this event or data attribute.
    window.dispatchEvent(new CustomEvent('team-space-ready', { detail: { ready: openingReady } }));
  }, [openingReady]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    setReady(true);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  if (!ready) return null;

  return (
    <div className="team-space" aria-hidden="true" data-space-ready={openingReady} style={{ visibility: openingReady ? 'visible' : 'hidden' }}>
      <SpaceBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: true, alpha: false, powerPreference: 'high-performance',
            depth: true, stencil: false, toneMapping: THREE.NoToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          camera={{ position: [0, 0, 0], fov: 45, near: 0.5, far: 42000 }}
          frameloop="demand"
          fallback={null}
          onCreated={({ gl }) => {
            gl.setClearColor('#000104', 1);
            gl.toneMappingExposure = 1;
          }}
        >
          <SpaceScene reduced={reduced} onOpeningReady={setOpeningReady} />
        </Canvas>
      </SpaceBoundary>
    </div>
  );
}
