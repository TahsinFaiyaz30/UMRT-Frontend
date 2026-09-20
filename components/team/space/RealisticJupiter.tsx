'use client';

/**
 * RealisticJupiter — Colossal Jovian gas giant with stormy cloud belts and Great Red Spot.
 *
 * Mapped with real NASA `jupitermap.jpg` texture, complete with atmospheric limb
 * scattering and an orbiting Galilean moon.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticJupiterProps {
  position?: [number, number, number];
  radius?: number;
  sunPosition?: [number, number, number];
}

const jupiterAtmoVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const jupiterAtmoFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uSunPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunPosition - vWorldPosition);

    float VdotN = max(0.0, dot(V, N));
    float rim = pow(1.0 - VdotN, 3.0);

    float sunFacing = smoothstep(-0.2, 0.35, dot(N, L));
    float alpha = rim * sunFacing * 0.65;

    if (alpha <= 0.003) discard;
    vec3 atmoColor = vec3(0.92, 0.82, 0.65);

    gl_FragColor = vec4(atmoColor * 1.3, alpha);
  }
`;

export function RealisticJupiter({
  position = [-34, -8, -120],
  radius = 30,
  sunPosition = [160, 80, 120],
}: RealisticJupiterProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const moonOrbitRef = useRef<THREE.Group>(null);

  const { jupiterTex, moonTex } = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const j = loader.load('/textures/jupitermap.jpg');
    j.colorSpace = THREE.SRGBColorSpace;
    j.anisotropy = 16;
    const m = loader.load('/textures/moonmap1k.jpg');
    m.colorSpace = THREE.SRGBColorSpace;
    m.anisotropy = 16;
    return { jupiterTex: j, moonTex: m };
  }, []);

  const jupiterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: jupiterTex,
        roughness: 0.85,
        metalness: 0.04,
      }),
    [jupiterTex],
  );

  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: jupiterAtmoVertex,
        fragmentShader: jupiterAtmoFragment,
        uniforms: {
          uSunPosition: { value: new THREE.Vector3(...sunPosition) },
        },
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [sunPosition],
  );

  const moonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: moonTex,
        roughness: 0.92,
        metalness: 0.06,
      }),
    [moonTex],
  );

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.015;
    }
    if (moonOrbitRef.current) {
      moonOrbitRef.current.rotation.y += delta * 0.035;
    }
  });

  return (
    <group position={position} rotation={[0.05, 0, 0.05]} name="realistic-jupiter">
      {/* Colossal Gas Giant Body */}
      <mesh ref={planetRef} material={jupiterMat}>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>

      {/* Atmospheric Scattering Shell */}
      <mesh scale={1.02} material={atmoMat}>
        <sphereGeometry args={[radius, 48, 36]} />
      </mesh>

      {/* Orbiting Galilean Moon */}
      <group ref={moonOrbitRef} rotation={[0.15, 0, 0]}>
        <group position={[radius * 1.85, 2.0, 0]}>
          <mesh material={moonMat}>
            <sphereGeometry args={[radius * 0.07, 24, 18]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
