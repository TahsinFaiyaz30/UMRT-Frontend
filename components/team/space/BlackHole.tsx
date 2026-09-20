'use client';

/**
 * BlackHole — Supermassive black hole with relativistic glowing accretion disk.
 *
 * Modeled after relativistic gravitational physics (Interstellar / EHT M87 style):
 *  - Event Horizon: Pitch-black sphere absorbing 100% of incident light.
 *  - Relativistic Accretion Disk: Incandescent, swirling plasma disk with radial
 *    temperature gradient (white-hot inner boundary to amber outer edge) and Doppler brightening.
 *  - Gravitational Lensing Halo: Einstein ring optical distortion envelope catching bloom.
 *  - Smooth opacity fading for clean deep-space transitions.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BlackHoleProps {
  position?: [number, number, number];
  radius?: number;
  opacity?: number;
}

const diskVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const diskFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    // Distance from center of ring disc [-1, 1]
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r < 0.35 || r > 0.98) discard;

    float normR = (r - 0.35) / 0.63; // 0 (inner edge) to 1 (outer edge)
    float angle = atan(p.y, p.x);

    // Swirling spiral plasma streams
    float swirl = sin(angle * 6.0 - normR * 14.0 + uTime * 2.5);
    float microStreams = sin(angle * 16.0 + normR * 28.0 - uTime * 4.0) * 0.3;
    float plasma = smoothstep(-0.6, 0.8, swirl + microStreams);

    // Doppler brightening: plasma rotating toward viewer appears brighter
    float doppler = 0.65 + 0.35 * cos(angle + 0.4);

    // Radial temperature color gradient
    vec3 whiteHot = vec3(1.2, 1.15, 1.05);
    vec3 gold = vec3(1.0, 0.72, 0.28);
    vec3 amber = vec3(0.85, 0.38, 0.12);
    vec3 darkRed = vec3(0.45, 0.12, 0.05);

    vec3 col = mix(whiteHot, gold, smoothstep(0.0, 0.25, normR));
    col = mix(col, amber, smoothstep(0.25, 0.65, normR));
    col = mix(col, darkRed, smoothstep(0.65, 1.0, normR));

    // High inner rim brightness (photon sphere glow)
    float photonGlow = pow(1.0 - normR, 2.5) * 2.2;
    col += vec3(1.0, 0.95, 0.8) * photonGlow;

    // Edge fading
    float alpha = smoothstep(0.35, 0.42, r) * smoothstep(0.98, 0.92, r) * (0.75 + plasma * 0.25) * doppler * uOpacity;

    gl_FragColor = vec4(col * (1.2 + photonGlow * 0.8), alpha);
  }
`;

const lensingVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const lensingFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    float VdotN = max(0.0, dot(V, N));
    // Einstein ring grazing glow
    float ring = pow(1.0 - VdotN, 4.0);
    if (ring <= 0.003) discard;

    vec3 haloColor = vec3(1.0, 0.75, 0.35) * ring * 1.6;
    gl_FragColor = vec4(haloColor * uOpacity, ring * 0.75 * uOpacity);
  }
`;

export function BlackHole({
  position = [-36, -8, -480],
  radius = 18,
  opacity = 1.0,
}: BlackHoleProps) {
  const diskRef = useRef<THREE.Mesh>(null);
  const verticalDiskRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const lensingMatRef = useRef<THREE.ShaderMaterial>(null);

  const diskMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: diskVertexShader,
        fragmentShader: diskFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: opacity },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [opacity],
  );

  const lensingMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lensingVertexShader,
        fragmentShader: lensingFragmentShader,
        uniforms: {
          uOpacity: { value: opacity },
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [opacity],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uOpacity.value = opacity;
    }
    if (lensingMatRef.current) {
      lensingMatRef.current.uniforms.uOpacity.value = opacity;
    }
    if (diskRef.current) {
      diskRef.current.rotation.z += delta * 0.15;
    }
    if (verticalDiskRef.current) {
      verticalDiskRef.current.rotation.z += delta * 0.12;
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group position={position} rotation={[0.42, 0.25, -0.2]} name="supermassive-black-hole">
      {/* Event Horizon (Pure Black Sphere absorbing 100% light) */}
      <mesh>
        <sphereGeometry args={[radius * 0.55, 48, 36]} />
        <meshBasicMaterial color="#000000" transparent opacity={opacity} />
      </mesh>

      {/* Gravitational Lensing Halo (Einstein Ring) */}
      <mesh scale={1.04}>
        <sphereGeometry args={[radius * 0.55, 36, 24]} />
        <primitive ref={lensingMatRef} object={lensingMaterial} attach="material" />
      </mesh>

      {/* Primary Luminous Accretion Disk */}
      <mesh ref={diskRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.65, radius * 2.5, 64]} />
        <primitive object={diskMaterial} attach="material" ref={matRef} />
      </mesh>

      {/* Vertical Lensed Accretion Ring (Relativistic light arc bent over horizon) */}
      <mesh ref={verticalDiskRef} rotation={[0, -Math.PI / 4, 0]}>
        <ringGeometry args={[radius * 0.62, radius * 2.3, 64]} />
        <primitive object={diskMaterial} attach="material" />
      </mesh>
    </group>
  );
}
