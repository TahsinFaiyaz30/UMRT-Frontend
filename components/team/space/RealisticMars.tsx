'use client';

/**
 * RealisticMars — Photorealistic Mars globe, delicate Rayleigh atmospheric limb, and orbiting Phobos.
 *
 * Grounded in authentic planetary science:
 *  - Real NASA Mars high-resolution surface map (`mars_surface.png`).
 *  - Gentle topographic normal map (`mars_normal.png`) scaled for natural crater relief without harsh noise.
 *  - Delicate Rayleigh atmospheric scattering shell on the sunlit limb.
 *  - 25.19° axial tilt with slow planetary rotation.
 *  - Orbiting Martian moon (Phobos) using authentic lunar/regolith surface texture (`moonmap1k.jpg`).
 *  - Smooth opacity fading for seamless deep-space transitions.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RealisticMarsProps {
  position?: [number, number, number];
  radius?: number;
  sunPosition?: [number, number, number];
  opacity?: number;
}

const atmoVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmoFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uSunPosition;
  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunPosition - vWorldPosition);

    // Fresnel limb glow
    float VdotN = max(0.0, dot(V, N));
    float rim = pow(1.0 - VdotN, 2.6);

    // Only illuminate the sunlit side
    float sunFacing = smoothstep(-0.15, 0.35, dot(N, L));
    float alpha = rim * sunFacing * 0.55 * uOpacity;

    if (alpha <= 0.002) discard;

    // Mars atmosphere: warm dust peach transitioning to faint pale blue on the grazing edge
    vec3 limbColor = mix(vec3(0.92, 0.48, 0.26), vec3(0.58, 0.74, 0.95), rim);

    gl_FragColor = vec4(limbColor * 1.2, alpha);
  }
`;

export function RealisticMars({
  position = [32, 10, -160],
  radius = 10,
  sunPosition = [120, 50, 80],
  opacity = 1.0,
}: RealisticMarsProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const phobosGroupRef = useRef<THREE.Group>(null);
  const phobosMeshRef = useRef<THREE.Mesh>(null);
  const atmoMatRef = useRef<THREE.ShaderMaterial>(null);

  // Load NASA Mars textures
  const { marsTexture, marsNormalTexture, moonTexture } = useMemo(() => {
    const loader = new THREE.TextureLoader();

    // High-resolution Mars surface
    const marsTex = loader.load('/textures/mars_surface.png');
    marsTex.colorSpace = THREE.SRGBColorSpace;
    marsTex.anisotropy = 16;

    const marsNorm = loader.load('/textures/mars_normal.png');
    marsNorm.anisotropy = 16;

    const moonTex = loader.load('/textures/moonmap1k.jpg');
    moonTex.colorSpace = THREE.SRGBColorSpace;
    moonTex.anisotropy = 16;

    return {
      marsTexture: marsTex,
      marsNormalTexture: marsNorm,
      moonTexture: moonTex,
    };
  }, []);

  // Mars surface material with gentle normal scale
  const marsMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: marsTexture,
        normalMap: marsNormalTexture,
        normalScale: new THREE.Vector2(0.18, 0.18),
        roughness: 0.85,
        metalness: 0.04,
        transparent: true,
        opacity: opacity,
      }),
    [marsTexture, marsNormalTexture, opacity],
  );

  // Atmosphere limb material
  const atmoMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVertexShader,
        fragmentShader: atmoFragmentShader,
        uniforms: {
          uSunPosition: { value: new THREE.Vector3(...sunPosition) },
          uOpacity: { value: opacity },
        },
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [sunPosition, opacity],
  );

  // Phobos moon material
  const phobosMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: moonTexture,
        roughness: 0.95,
        metalness: 0.08,
        transparent: true,
        opacity: opacity,
      }),
    [moonTexture, opacity],
  );

  useFrame((_, delta) => {
    if (atmoMatRef.current) {
      atmoMatRef.current.uniforms.uOpacity.value = opacity;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.015;
    }
    if (phobosGroupRef.current) {
      phobosGroupRef.current.rotation.y += delta * 0.035;
    }
    if (phobosMeshRef.current) {
      phobosMeshRef.current.rotation.y += delta * 0.05;
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group position={position} name="realistic-mars">
      {/* Mars Main Body with 25.19° Axial Tilt */}
      <group rotation={[0.18, 0, 0.44]}>
        <mesh ref={planetRef} material={marsMaterial}>
          <sphereGeometry args={[radius, 64, 48]} />
        </mesh>

        {/* Delicate atmospheric limb haze */}
        <mesh scale={1.025}>
          <sphereGeometry args={[radius, 48, 36]} />
          <primitive ref={atmoMatRef} object={atmoMaterial} attach="material" />
        </mesh>
      </group>

      {/* Orbiting Moon Phobos */}
      <group ref={phobosGroupRef} rotation={[0.3, 0, 0.1]}>
        <group position={[radius * 1.75, 2.0, 0]}>
          <mesh ref={phobosMeshRef} material={phobosMaterial} scale={[1.15, 0.85, 0.9]}>
            <sphereGeometry args={[0.9, 24, 18]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
