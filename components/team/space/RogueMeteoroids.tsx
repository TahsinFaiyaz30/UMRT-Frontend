'use client';

/**
 * RogueMeteoroids — Photorealistic rogue asteroids drifting in the cosmic void.
 *
 * Distributed across the interstellar transit corridor:
 *  - Procedural cratered rock geometries with realistic chondrite / carbonaceous tones.
 *  - Slow zero-gravity rotational tumble.
 *  - Delivers authentic depth cues and 3D parallax during void cruising.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const METEOROID_COUNT = 36;

function makeCrateredGeometry(radius: number, seed: number) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  const hash = (x: number, y: number, z: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const noise = hash(v.x * 2.2, v.y * 2.2, v.z * 2.2) * 0.35;
    v.x *= 1.25;
    v.y *= 0.88;
    v.z *= 0.95;
    v.multiplyScalar(radius * (0.85 + noise));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

export interface RogueMeteoroidsProps {
  opacity?: number;
}

export function RogueMeteoroids({ opacity = 1.0 }: RogueMeteoroidsProps) {
  const groupRef = useRef<THREE.Group>(null);

  const meteoroids = useMemo(() => {
    let s = 0x82b41f;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const items = [];
    for (let i = 0; i < METEOROID_COUNT; i++) {
      const radius = 1.0 + Math.pow(rnd(), 1.5) * 5.0;
      const x = -200 + rnd() * 400;
      const y = -80 + rnd() * 260;
      const z = -5600 - rnd() * 800;

      const rx = (rnd() - 0.5) * 0.05;
      const ry = (rnd() - 0.5) * 0.05;
      const rz = (rnd() - 0.5) * 0.05;

      items.push({
        position: [x, y, z] as [number, number, number],
        rotationSpeed: [rx, ry, rz] as [number, number, number],
        geo: makeCrateredGeometry(radius, i * 7.3),
      });
    }
    return items;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#423c36',
        roughness: 0.94,
        metalness: 0.06,
        transparent: true,
        opacity: opacity,
      }),
    [opacity],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const m = meteoroids[i];
      if (m && children[i]) {
        children[i].rotation.x += delta * m.rotationSpeed[0];
        children[i].rotation.y += delta * m.rotationSpeed[1];
        children[i].rotation.z += delta * m.rotationSpeed[2];
      }
    }
  });

  if (opacity <= 0.001) return null;

  return (
    <group ref={groupRef} name="rogue-meteoroids">
      {meteoroids.map((m, idx) => (
        <mesh
          key={idx}
          geometry={m.geo}
          material={material}
          position={m.position}
        />
      ))}
    </group>
  );
}
