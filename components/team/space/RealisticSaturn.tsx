'use client';

/**
 * RealisticSaturn — Photorealistic ringed gas giant.
 *
 * Authentic astronomical features:
 *  - Real NASA Saturn atmospheric banding texture (`saturnmap.jpg`).
 *  - High-precision translucent planetary ring system with Cassini division,
 *    A/B/C rings, and shadow cast by the planet sphere onto the rings.
 *  - 26.73° axial tilt and stately rotational inertia.
 *  - Opacity fading for seamless cosmic transitions.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticSaturnProps {
  position?: [number, number, number];
  radius?: number;
  sunPosition?: [number, number, number];
  opacity?: number;
}

const ringVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ringFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uSunPosition;
  uniform vec3 uCenter;
  uniform float uPlanetRadius;
  uniform float uOpacity;

  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    // Distance from center of ring disc (uv in [0, 1], normalized to [-1, 1])
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r < 0.44 || r > 0.98) discard;

    // Normalize radius across ring span [0.44, 0.98]
    float normR = (r - 0.44) / 0.54;

    // Authentic Cassini Division gap around 0.62..0.66
    float cassiniGap = 1.0 - smoothstep(0.60, 0.63, normR) * (1.0 - smoothstep(0.66, 0.69, normR)) * 0.94;

    // Fine ring particle density bands
    float bands = sin(normR * 95.0) * 0.12 + sin(normR * 220.0) * 0.08 + 0.8;
    float alpha = bands * cassiniGap * smoothstep(0.44, 0.48, r) * smoothstep(0.98, 0.94, r) * 0.85 * uOpacity;

    // Planet shadow cast onto rings
    vec3 toSun = normalize(uSunPosition - vWorldPosition);
    vec3 toCenter = uCenter - vWorldPosition;
    float proj = dot(toCenter, toSun);
    vec3 closest = vWorldPosition + toSun * max(0.0, proj);
    float distToCenter = length(closest - uCenter);
    float shadow = (proj > 0.0 && distToCenter < uPlanetRadius * 0.96) ? 0.06 : 1.0;

    // Saturn ring golden-cream dust tone
    vec3 ringColor = mix(vec3(0.85, 0.76, 0.62), vec3(0.96, 0.90, 0.78), normR);

    gl_FragColor = vec4(ringColor * shadow, alpha);
  }
`;

export function RealisticSaturn({
  position = [38, -12, -860],
  radius = 20,
  sunPosition = [160, 80, 120],
  opacity = 1.0,
}: RealisticSaturnProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const saturnTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/textures/saturnmap.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  const saturnMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: saturnTexture,
        roughness: 0.88,
        metalness: 0.04,
        transparent: true,
        opacity: opacity,
      }),
    [saturnTexture, opacity],
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        uniforms: {
          uSunPosition: { value: new THREE.Vector3(...sunPosition) },
          uCenter: { value: new THREE.Vector3(...position) },
          uPlanetRadius: { value: radius },
          uOpacity: { value: opacity },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [sunPosition, position, radius, opacity],
  );

  useFrame((_, delta) => {
    if (ringMatRef.current) {
      ringMatRef.current.uniforms.uOpacity.value = opacity;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.012;
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group ref={groupRef} position={position} rotation={[0.46, -0.2, 0.28]} name="realistic-saturn">
      {/* Saturn Gas Giant Sphere */}
      <mesh ref={planetRef} material={saturnMaterial}>
        <sphereGeometry args={[radius, 48, 36]} />
      </mesh>

      {/* Photorealistic Rings */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.35, radius * 2.45, 64]} />
        <primitive ref={ringMatRef} object={ringMaterial} attach="material" />
      </mesh>
    </group>
  );
}
