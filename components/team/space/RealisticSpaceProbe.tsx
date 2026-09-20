'use client';

/**
 * RealisticSpaceProbe — Photorealistic deep-space exploration orbiter.
 *
 * Modeled after deep-space exploratory spacecraft (Mars Reconnaissance Orbiter):
 *  - Central bus wrapped in reflective gold Multi-Layer Insulation (MLI) thermal foil.
 *  - Dual photovoltaic solar array wings with silicon blue cells and titanium hinges.
 *  - Parabolic high-gain communication dish antenna pointing into deep space.
 *  - Scientific instrument boom and reaction control thrusters.
 *  - Realistic zero-gravity attitude inertia and smooth parallax drift.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticSpaceProbeProps {
  position?: [number, number, number];
  scale?: number;
  rotationSpeed?: number;
  opacity?: number;
}

export function RealisticSpaceProbe({
  position = [12, 14, -310],
  scale = 1.35,
  rotationSpeed = 0.05,
  opacity = 1.0,
}: RealisticSpaceProbeProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Gold foil MLI thermal blanket material
  const goldFoilMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#dfa636',
        metalness: 0.92,
        roughness: 0.28,
        transparent: true,
        opacity: opacity,
      }),
    [opacity],
  );

  // Photovoltaic blue solar cell material
  const solarPanelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0d2854',
        metalness: 0.88,
        roughness: 0.18,
        transparent: true,
        opacity: opacity,
      }),
    [opacity],
  );

  // Titanium / Aerospace dark alloy frame
  const darkMetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#282b30',
        metalness: 0.9,
        roughness: 0.38,
        transparent: true,
        opacity: opacity,
      }),
    [opacity],
  );

  // High-gain parabolic antenna dish material
  const dishMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e4e7eb',
        metalness: 0.45,
        roughness: 0.32,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: opacity,
      }),
    [opacity],
  );

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed * 0.4;
      groupRef.current.rotation.x += delta * rotationSpeed * 0.15;
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group ref={groupRef} position={position} scale={scale} rotation={[0.2, 0.4, -0.1]} name="realistic-space-probe">
      {/* Central Satellite Main Body (Cuboid bus wrapped in gold foil) */}
      <mesh material={goldFoilMat}>
        <boxGeometry args={[0.9, 1.25, 0.9]} />
      </mesh>

      {/* Equipment Bay Base Ring */}
      <mesh position={[0, -0.68, 0]} material={darkMetalMat}>
        <cylinderGeometry args={[0.48, 0.48, 0.14, 16]} />
      </mesh>

      {/* High-Gain Parabolic Communication Dish */}
      <group position={[0, 0.72, 0.4]} rotation={[-0.55, 0.3, 0]}>
        <mesh position={[0, 0, -0.22]} material={darkMetalMat}>
          <cylinderGeometry args={[0.05, 0.05, 0.45, 8]} />
        </mesh>
        <mesh material={dishMat}>
          <sphereGeometry args={[0.65, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
        </mesh>
        {/* Feed Horn Assembly */}
        <mesh position={[0, 0.38, 0]} material={darkMetalMat}>
          <coneGeometry args={[0.08, 0.25, 12]} />
        </mesh>
      </group>

      {/* Left Photovoltaic Solar Array Wing */}
      <group position={[-1.85, 0, 0]}>
        <mesh position={[0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={darkMetalMat}>
          <cylinderGeometry args={[0.06, 0.06, 0.85, 8]} />
        </mesh>
        <mesh material={solarPanelMat}>
          <boxGeometry args={[1.8, 0.95, 0.04]} />
        </mesh>
        <mesh material={darkMetalMat}>
          <boxGeometry args={[1.84, 0.99, 0.02]} />
        </mesh>
      </group>

      {/* Right Photovoltaic Solar Array Wing */}
      <group position={[1.85, 0, 0]}>
        <mesh position={[-0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={darkMetalMat}>
          <cylinderGeometry args={[0.06, 0.06, 0.85, 8]} />
        </mesh>
        <mesh material={solarPanelMat}>
          <boxGeometry args={[1.8, 0.95, 0.04]} />
        </mesh>
        <mesh material={darkMetalMat}>
          <boxGeometry args={[1.84, 0.99, 0.02]} />
        </mesh>
      </group>

      {/* Magnetometer Science Boom Arm */}
      <group position={[0, -0.95, -0.45]} rotation={[0.42, 0, 0]}>
        <mesh material={darkMetalMat}>
          <cylinderGeometry args={[0.045, 0.045, 1.3, 8]} />
        </mesh>
        <mesh position={[0, -0.72, 0]} material={goldFoilMat}>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
        </mesh>
      </group>
    </group>
  );
}
