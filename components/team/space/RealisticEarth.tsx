'use client';

/**
 * RealisticEarth — Distant Earth & Moon in the deep cosmos.
 *
 * Mapped with real NASA `earthmap1k.jpg` and `moonmap1k.jpg`, complete with
 * delicate blue atmospheric limb scattering.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticEarthProps {
  position?: [number, number, number];
  radius?: number;
  sunPosition?: [number, number, number];
}

const earthAtmoVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthAtmoFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uSunPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunPosition - vWorldPosition);

    float VdotN = max(0.0, dot(V, N));
    float rim = pow(1.0 - VdotN, 3.2);

    float sunFacing = smoothstep(-0.2, 0.4, dot(N, L));
    float alpha = rim * sunFacing * 0.85;

    if (alpha <= 0.003) discard;
    vec3 blueLimb = vec3(0.18, 0.52, 0.98);

    gl_FragColor = vec4(blueLimb * 1.35, alpha);
  }
`;

export function RealisticEarth({
  position = [-38, -24, -320],
  radius = 12,
  sunPosition = [160, 80, 120],
}: RealisticEarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const moonOrbitRef = useRef<THREE.Group>(null);

  const { earthTex, moonTex } = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const e = loader.load('/textures/earthmap1k.jpg');
    e.colorSpace = THREE.SRGBColorSpace;
    const m = loader.load('/textures/moonmap1k.jpg');
    m.colorSpace = THREE.SRGBColorSpace;
    return { earthTex: e, moonTex: m };
  }, []);

  const earthMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: earthTex,
        roughness: 0.65,
        metalness: 0.1,
      }),
    [earthTex],
  );

  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthAtmoVertex,
        fragmentShader: earthAtmoFragment,
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
        metalness: 0.05,
      }),
    [moonTex],
  );

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.015;
    }
    if (moonOrbitRef.current) {
      moonOrbitRef.current.rotation.y += delta * 0.025;
    }
  });

  return (
    <group position={position} rotation={[0.41, 0, 0]} name="realistic-earth">
      {/* Earth Sphere & Atmosphere */}
      <mesh ref={earthRef} material={earthMat}>
        <sphereGeometry args={[radius, 48, 36]} />
      </mesh>
      <mesh scale={1.035} material={atmoMat}>
        <sphereGeometry args={[radius, 36, 24]} />
      </mesh>

      {/* Orbiting Moon */}
      <group ref={moonOrbitRef} rotation={[0.2, 0, 0]}>
        <group position={[radius * 2.4, 1.2, 0]}>
          <mesh material={moonMat}>
            <sphereGeometry args={[radius * 0.27, 24, 18]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
