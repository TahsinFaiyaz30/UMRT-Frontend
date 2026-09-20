'use client';

/**
 * RealisticStarfield — Photorealistic astronomical starfield & Milky Way backdrop.
 *
 * True vacuum of space:
 *  - Stars do NOT twinkle or sparkle in space (no atmospheric turbulence).
 *  - Equirectangular celestial sphere mapped with real deep-sky astronomical survey.
 *  - Pin-point sharp stars with authentic stellar spectral temperatures
 *    (O/B blue-white, A/F white, G yellow, M orange-red).
 *  - Infinite depth perspective with zero popping or disappearing.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAR_COUNT = 6000;

export function RealisticStarfield() {
  const pointsRef = useRef<THREE.Points>(null);
  const skySphereRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Load real astronomical deep-sky survey texture
  const starfieldTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/textures/starfield.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  // 3D pin-point static stars
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);

    // Deterministic random seed
    let s = 0x5a1f2c;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const blueGiant = new THREE.Color('#a8c2ff');
    const pureWhite = new THREE.Color('#fcfdff');
    const yellowSun = new THREE.Color('#fff0d4');
    const amberRed = new THREE.Color('#ffcaa1');
    const c = new THREE.Color();

    for (let i = 0; i < STAR_COUNT; i++) {
      // Spherical distribution around universe center
      const u = rnd();
      const v = rnd();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 900 + rnd() * 1200;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Spectral classification
      const temp = rnd();
      if (temp < 0.22) c.copy(blueGiant);
      else if (temp < 0.65) c.copy(pureWhite);
      else if (temp < 0.88) c.copy(yellowSun);
      else c.copy(amberRed);

      // Realistic magnitude (brightness)
      const mag = 0.4 + Math.pow(rnd(), 4.0) * 1.8;
      colors[i * 3] = c.r * mag;
      colors[i * 3 + 1] = c.g * mag;
      colors[i * 3 + 2] = c.b * mag;
    }

    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const starMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    [],
  );

  const skySphereMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: starfieldTexture,
        side: THREE.BackSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.6,
      }),
    [starfieldTexture],
  );

  // Very slow, subtle cosmic rotation
  useFrame(({ camera }, delta) => {
    if (groupRef.current) { groupRef.current.position.copy(camera.position); }
    if (skySphereRef.current) {
      skySphereRef.current.rotation.y += delta * 0.0012;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.0012;
    }
  });

  return (
    <group ref={groupRef} name="realistic-starfield">
      {/* Deep-sky panoramic Milky Way & star clouds */}
      <mesh ref={skySphereRef}>
        <sphereGeometry args={[2600, 64, 48]} />
        <primitive object={skySphereMaterial} attach="material" />
      </mesh>

      {/* Needle-sharp 3D stars (static, non-twinkling) */}
      <points ref={pointsRef} geometry={geometry} material={starMaterial} />
    </group>
  );
}
