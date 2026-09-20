'use client';

/**
 * RealisticNeptune — Deep azure blue ice giant in deep space.
 *
 * Mapped with real NASA `neptunemap.jpg` texture with an ethereal cyan-blue
 * Rayleigh atmospheric scattering shell.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticNeptuneProps {
  position?: [number, number, number];
  radius?: number;
  sunPosition?: [number, number, number];
}

const neptuneAtmoVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const neptuneAtmoFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uSunPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunPosition - vWorldPosition);

    float VdotN = max(0.0, dot(V, N));
    float rim = pow(1.0 - VdotN, 2.6);

    float sunFacing = smoothstep(-0.25, 0.35, dot(N, L));
    float alpha = rim * sunFacing * 0.85;

    if (alpha <= 0.003) discard;
    vec3 methaneBlue = vec3(0.12, 0.58, 1.0);

    gl_FragColor = vec4(methaneBlue * 1.4, alpha);
  }
`;

export function RealisticNeptune({
  position = [28, 14, -480],
  radius = 18,
  sunPosition = [160, 80, 120],
}: RealisticNeptuneProps) {
  const planetRef = useRef<THREE.Mesh>(null);

  const neptuneTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/textures/neptunemap.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const neptuneMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: neptuneTexture,
        roughness: 0.72,
        metalness: 0.06,
      }),
    [neptuneTexture],
  );

  const atmoMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: neptuneAtmoVertex,
        fragmentShader: neptuneAtmoFragment,
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

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.012;
    }
  });

  return (
    <group position={position} rotation={[0.49, 0, 0]} name="realistic-neptune">
      <mesh ref={planetRef} material={neptuneMaterial}>
        <sphereGeometry args={[radius, 48, 36]} />
      </mesh>
      <mesh scale={1.03} material={atmoMaterial}>
        <sphereGeometry args={[radius, 36, 24]} />
      </mesh>
    </group>
  );
}
