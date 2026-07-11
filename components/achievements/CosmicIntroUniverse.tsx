'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SystemCluster,
  TravelingStarField,
  type CosmicJourney,
} from '@/components/achievements/CosmicUniverse';
import { COSMIC_SYSTEMS } from '@/components/achievements/cosmicArchiveConfig';
import { detectQuality, dprFor, getReducedMotion, type Quality } from '@/lib/performance';
import { hasWebGLSupport } from '@/lib/webglSupport';

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotion());

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

function DemandFrame({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [active, invalidate, reducedMotion]);

  return null;
}

function IntroCamera({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const { camera, pointer, size } = useThree();
  const desired = useRef(new THREE.Vector3());
  useFrame((state, delta) => {
    if (!active || reducedMotion) return;
    const portrait = size.height > size.width * 1.08;
    desired.current.set(
      (portrait ? 0 : pointer.x * 0.32) + Math.sin(state.clock.elapsedTime * 0.11) * 0.1,
      pointer.y * 0.18 + Math.cos(state.clock.elapsedTime * 0.09) * 0.07,
      portrait ? 12.8 : 10.2,
    );
    camera.position.lerp(desired.current, 1 - Math.exp(-delta * 2.2));
    camera.lookAt(portrait ? 0 : 1.4, portrait ? 0.5 : 0, -1.2);
  });
  return null;
}

export default function CosmicIntroUniverse() {
  const containerRef = useRef<HTMLDivElement>(null);
  const journey = useRef<CosmicJourney>({ current: 0, target: 0 });
  const [quality, setQuality] = useState<Quality>('medium');
  const [dpr, setDpr] = useState(1);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(true);
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    setSupported(hasWebGLSupport());
    const next = detectQuality();
    setQuality(next);
    setDpr(dprFor(next));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '20% 0px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="achievement-intro-universe" aria-hidden="true">
      {supported && (
        <Canvas
          dpr={dpr}
          frameloop={active && !reducedMotion ? 'always' : 'demand'}
          camera={{ position: [0, 0, 10.2], fov: 43, near: 0.1, far: 220 }}
          gl={{ antialias: quality === 'high', alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ambientLight color="#240d07" intensity={0.38} />
          <TravelingStarField quality={quality} active={active && !reducedMotion} />
          <group position={[2.6, -0.1, -1.3]} scale={1.18}>
            <SystemCluster config={COSMIC_SYSTEMS[0]} index={0} quality={quality} journey={journey} active={active && !reducedMotion} local />
          </group>
          <IntroCamera active={active} reducedMotion={reducedMotion} />
          <DemandFrame active={active} reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </div>
  );
}
