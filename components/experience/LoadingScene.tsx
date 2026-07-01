'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { fogDensityFor, particleCountFor, Quality } from '@/lib/performance';
import {
  MarsGround,
  MarsRocks,
  MarsDust,
  MarsSky,
  MarsHorizonHaze,
  MarsLighting,
  type RockData,
} from './MarsTerrain';

const LOADING_ROCKS: RockData[] = [
  { position: [-10, 0.3, -12], scale: 2.2, seed: 1, colorIndex: 0 },
  { position: [8, 0.2, -14], scale: 1.8, seed: 2, colorIndex: 1 },
  { position: [-5, 0.08, -6], scale: 0.6, seed: 3, colorIndex: 2 },
  { position: [6, 0.06, -5], scale: 0.4, seed: 4, colorIndex: 0 },
  { position: [-15, 0.5, -18], scale: 3.0, seed: 5, colorIndex: 1 },
  { position: [14, 0.4, -16], scale: 2.5, seed: 6, colorIndex: 2 },
];

export function LoadingScene({
  quality = 'medium',
  progress = 0,
}: {
  quality?: Quality;
  progress?: number;
}) {
  const groupRef = useRef<Group>(null);
  const dustCount = Math.min(particleCountFor(quality), 50);
  const fogDensity = fogDensityFor(quality);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.x = Math.sin(t * 1.2) * 1.2;
    groupRef.current.position.z = Math.cos(t * 0.6) * 0.6;
  });

  return (
    <>
      <color attach="background" args={['#4A2818']} />
      <fogExp2 attach="fog" args={['#B08050', fogDensity * 0.5]} />

      <MarsLighting quality={quality} />
      <MarsSky />
      <MarsHorizonHaze />
      <MarsGround size={120} heightScale={0.4} quality={quality} />
      <MarsRocks rocks={LOADING_ROCKS} />
      <MarsDust count={dustCount} spread={20} height={4} />

      <group ref={groupRef}>
        <RunningProxy />
      </group>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.07, 32, 1, 0, Math.PI * 2 * progress]} />
        <meshBasicMaterial color="#FFD4A8" transparent opacity={0.6} />
      </mesh>
    </>
  );
}

function RunningProxy() {
  const body = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!body.current) return;
    body.current.rotation.y += delta * 0.6;
  });
  return (
    <group ref={body} position={[0, 0, 0]} scale={0.9}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.9, 1.0, 0.5]} />
        <meshStandardMaterial color="#b8431b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#2f0f06" roughness={0.6} />
      </mesh>
      <mesh position={[-0.32, 0.0, 0.18]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[0.32, 0.0, 0.18]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[-0.32, 0.0, -0.18]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[0.32, 0.0, -0.18]} castShadow>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
    </group>
  );
}
