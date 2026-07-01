'use client';

import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { phases } from '@/lib/scrollTimeline';

/**
 * Enables drei <OrbitControls> only after the last scroll phase.
 * Before that, the ScrollDirector owns the camera. After the user
 * reaches the unlock phase, the OrbitControls handle pan/zoom/rotate.
 */
export function FreeExploreControls({
  progressRef,
}: {
  progressRef: React.RefObject<number>;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!ref.current) return;
    const active = (progressRef.current ?? 0) >= phases[phases.length - 1].start;
    ref.current.enabled = active;
  });

  useEffect(() => {
    // Ensure controls start disabled.
    if (ref.current) ref.current.enabled = false;
  }, []);

  return (
    <OrbitControls
      ref={ref}
      args={[camera]}
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableRotate
      enableZoom
      minDistance={2}
      maxDistance={20}
      target={[0, 1, 0]}
      makeDefault
    />
  );
}
