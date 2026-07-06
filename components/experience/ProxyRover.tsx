'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { MeshStandardMaterial } from 'three';

/**
 * Procedural rover-like proxy used:
 *  - while the real GLB is loading,
 *  - during the lightweight loading scene,
 *  - and as a permanent fallback if the user model is missing.
 *
 * The mesh is intentionally simple (one material) so it stays cheap.
 * In running mode only the wheels rotate; the chassis stays planted.
 */
export function ProxyRover({
  running = true,
  bodyColor = '#b8431b',
  accentColor = '#2f0f06',
  metalColor = '#3a1a0a',
}: {
  running?: boolean;
  bodyColor?: string;
  accentColor?: string;
  metalColor?: string;
}) {
  const root = useRef<Group>(null);
  const wheelFrontL = useRef<Group>(null);
  const wheelFrontR = useRef<Group>(null);
  const wheelBackL = useRef<Group>(null);
  const wheelBackR = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!running) return;
    // spin wheels
    const wheels = [wheelFrontL.current, wheelFrontR.current, wheelBackL.current, wheelBackR.current];
    for (const w of wheels) {
      if (w) w.rotation.x -= delta * 6;
    }
  });

  const bodyMaterial = useMemo(
    () => new MeshStandardMaterial({ color: bodyColor, roughness: 0.7, metalness: 0.1 }),
    [bodyColor],
  );
  const accentMaterial = useMemo(
    () => new MeshStandardMaterial({ color: accentColor, roughness: 0.9 }),
    [accentColor],
  );
  const metalMaterial = useMemo(
    () => new MeshStandardMaterial({ color: metalColor, roughness: 0.4, metalness: 0.6 }),
    [metalColor],
  );

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* chassis */}
      <mesh material={bodyMaterial} position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.4, 2.6]} />
      </mesh>
      {/* upper deck */}
      <mesh material={accentMaterial} position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[1.2, 0.3, 1.8]} />
      </mesh>
      {/* sensor head */}
      <mesh material={metalMaterial} position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.6, 0.3, 0.5]} />
      </mesh>
      {/* mast */}
      <mesh material={metalMaterial} position={[0, 1.45, 0.2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
      </mesh>
      {/* solar panels */}
      <mesh material={accentMaterial} position={[0, 0.95, -0.6]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[2.4, 0.05, 0.9]} />
      </mesh>
      <mesh material={accentMaterial} position={[0, 0.95, 0.6]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[2.4, 0.05, 0.9]} />
      </mesh>

      {/* wheels */}
      {[
        { ref: wheelFrontL, pos: [-0.85, 0.3, 0.9] as const },
        { ref: wheelFrontR, pos: [0.85, 0.3, 0.9] as const },
        { ref: wheelBackL, pos: [-0.85, 0.3, -0.9] as const },
        { ref: wheelBackR, pos: [0.85, 0.3, -0.9] as const },
      ].map(({ ref, pos }, i) => (
        <group key={i} ref={ref} position={pos}>
          <mesh material={accentMaterial} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
          </mesh>
        </group>
      ))}

      {/* arm hint */}
      <mesh material={metalMaterial} position={[0.7, 0.6, 0.4]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.1, 0.1, 0.7]} />
      </mesh>
    </group>
  );
}
