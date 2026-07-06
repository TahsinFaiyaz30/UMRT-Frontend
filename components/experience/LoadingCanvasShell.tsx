'use client';

/**
 * LoadingCanvasShell
 *
 * A deliberately tiny R3F Canvas that paints ONLY the procedural
 * running-rover scene from LoadingScene, with no terrain textures and
 * no GLB. It is used as the placeholder that `MarsExperience` mounts
 * while it waits for the browser to go idle — that way the user sees
 * the animated "running rover on Mars" loading screen instead of a
 * flat colour, but the first paint stays cheap enough to avoid the
 * "page isn't responding" warning.
 *
 * Once the heavy `SceneCanvas` is ready, this shell is unmounted and
 * its WebGL context released, so no GPU work is duplicated.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import { fogDensityFor, particleCountFor } from '@/lib/performance';

const LOADING_ROCKS = [
  { position: [-10, 0.3, -12], scale: 2.2, seed: 1 },
  { position: [8, 0.2, -14], scale: 1.8, seed: 2 },
  { position: [-15, 0.5, -18], scale: 3.0, seed: 5 },
  { position: [14, 0.4, -16], scale: 2.5, seed: 6 },
] as const;

export function LoadingCanvasShell() {
  return (
    <Canvas
      // No shadows, low DPR, no antialias — this is a placeholder.
      shadows={false}
      dpr={[1, 1.25]}
      gl={{
        antialias: false,
        powerPreference: 'low-power',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 1.6, 12], fov: 42, near: 0.1, far: 100 }}
      frameloop="always"
      flat={false}
      style={{ background: '#4A2818' }}
    >
      <color attach="background" args={['#4A2818']} />
      <fogExp2 attach="fog" args={['#B08050', 0.04]} />

      {/* Soft ambient only — no shadow-casting sun. */}
      <ambientLight intensity={0.7} color="#D0A880" />
      <directionalLight position={[8, 12, 6]} intensity={1.4} color="#FFE0C0" />

      {/* A flat ground — single colour, no texture decode. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[40, 32]} />
        <meshStandardMaterial color="#A06838" roughness={1} />
      </mesh>

      <SimpleRocks />
      <SimpleDust count={Math.min(particleCountFor('medium'), 40)} spread={20} height={4} />
      <RunningProxy />
    </Canvas>
  );
}

function SimpleRocks() {
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);

  return (
    <instancedMesh
      ref={(m) => {
        if (!m || m.userData.initialized) return;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < LOADING_ROCKS.length; i++) {
          const r = LOADING_ROCKS[i];
          dummy.position.set(r.position[0], r.position[1], r.position[2]);
          dummy.scale.set(r.scale, r.scale * 0.5, r.scale * 0.9);
          dummy.rotation.set(0, r.seed, 0);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        m.userData.initialized = true;
      }}
      args={[geometry, undefined, LOADING_ROCKS.length]}
      castShadow={false}
      receiveShadow={false}
    >
      <meshStandardMaterial color="#5A2A12" roughness={0.95} flatShading />
    </instancedMesh>
  );
}

function SimpleDust({ count, spread, height }: { count: number; spread: number; height: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i * 0.61803) * Math.PI * 2;
      const r = 2 + ((i * 0.41421) % 1) * spread;
      const x = Math.cos(angle) * r;
      const y = ((i * 0.73205) % 1) * height + 0.1;
      const z = Math.sin(angle) * r;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData.base = base;
    return geo;
  }, [count, spread, height]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const base = pointsRef.current.geometry.userData.base as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.4 + i * 0.37) * 0.4;
    }
    pos.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.005;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#D4A080"
        size={0.08}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function RunningProxy() {
  const groupRef = useRef<Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // Orbit the proxy slowly while loading so it feels alive.
    groupRef.current.position.x = Math.sin(t * 0.6) * 1.2;
    groupRef.current.position.z = Math.cos(t * 0.3) * 0.6;
    groupRef.current.rotation.y += delta * 0.4;
    groupRef.current.position.y = 0.05 + Math.abs(Math.sin(t * 6)) * 0.04;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* chassis */}
      <mesh position={[0, 0.55, 0]} castShadow={false}>
        <boxGeometry args={[0.9, 1.0, 0.5]} />
        <meshStandardMaterial color="#b8431b" roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.25, 0]} castShadow={false}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#2f0f06" roughness={0.6} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.32, 0.0, 0.18]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[0.32, 0.0, 0.18]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[-0.32, 0.0, -0.18]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
      <mesh position={[0.32, 0.0, -0.18]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#5a1d0c" />
      </mesh>
    </group>
  );
}