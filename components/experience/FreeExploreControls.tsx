'use client';

import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MOUSE, TOUCH } from 'three';
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
      enableDamping
      dampingFactor={0.075}
      enablePan
      enableRotate
      enableZoom
      screenSpacePanning
      panSpeed={0.82}
      rotateSpeed={0.72}
      zoomSpeed={0.92}
      minDistance={1.65}
      maxDistance={16}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI * 0.88}
      target={[0, 1, 0]}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
      touches={{
        ONE: TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN,
      }}
      makeDefault
    />
  );
}
