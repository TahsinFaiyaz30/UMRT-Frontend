'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';

// =====================================================================
// FAST NOISE
// =====================================================================

const PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (i * 16807 + 7) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function grad2D(hash: number, x: number, y: number): number {
  const h = hash & 3;
  return (h & 1 ? -x : x) + (h & 2 ? -y : y);
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x) & 255;
  const iy = Math.floor(y) & 255;
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = PERM[ix + PERM[iy]];
  const b = PERM[ix + 1 + PERM[iy]];
  const c = PERM[ix + PERM[iy + 1]];
  const d = PERM[ix + 1 + PERM[iy + 1]];
  const x1 = grad2D(a, fx, fy) + u * (grad2D(b, fx - 1, fy) - grad2D(a, fx, fy));
  const x2 = grad2D(c, fx, fy - 1) + u * (grad2D(d, fx - 1, fy - 1) - grad2D(c, fx, fy - 1));
  return (x1 + v * (x2 - x1)) * 0.5 + 0.5;
}

function fbm2(x: number, y: number): number {
  return noise2D(x, y) * 0.65 + noise2D(x * 2.1, y * 2.1) * 0.35;
}

// =====================================================================
// NON-SUSPENDING TEXTURE LOADER
// Loads textures asynchronously without blocking React rendering
// =====================================================================

const textureCache = new Map<string, THREE.Texture>();
const textureLoader = typeof window !== 'undefined' ? new THREE.TextureLoader() : null;

function useAsyncTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(() => textureCache.get(url) ?? null);

  useEffect(() => {
    if (textureCache.has(url)) {
      setTexture(textureCache.get(url)!);
      return;
    }
    if (!textureLoader) return;

    textureLoader.load(
      url,
      (tex) => {
        textureCache.set(url, tex);
        setTexture(tex);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load texture: ${url}`, err);
      },
    );
  }, [url]);

  return texture;
}

// =====================================================================
// TERRAIN GEOMETRY
// =====================================================================

function createTerrain(size: number, seg: number, hScale: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);

    let h = fbm2(x * 0.008 + 10, z * 0.008 + 5) * hScale;
    h += noise2D(x * 0.03 + 20, z * 0.03 + 30) * hScale * 0.15;

    const dist = Math.sqrt(x * x + z * z);
    if (dist > 40) {
      const ridgeT = Math.min(1, (dist - 40) / 50);
      h += noise2D(x * 0.015, z * 0.015) * hScale * 0.6 * ridgeT;
    }

    const flatten = Math.max(0, 1 - dist / 15);
    h *= 1 - flatten * flatten;

    pos.setZ(i, h);
  }

  geo.computeVertexNormals();
  return geo;
}

// =====================================================================
// MARS GROUND
// =====================================================================

export function MarsGround({
  size = 200,
  segments = 128,
  heightScale = 0.6,
  quality = 'medium',
}: {
  size?: number;
  segments?: number;
  heightScale?: number;
  quality?: Quality;
}) {
  const seg = quality === 'low' ? 64 : quality === 'medium' ? 96 : 128;
  const geometry = useMemo(() => createTerrain(size, seg, heightScale), [size, seg, heightScale]);

  const colorMap = useAsyncTexture('/textures/mars_surface.png');
  const normalMap = useAsyncTexture('/textures/mars_normal.png');

  // Configure textures when they load
  useEffect(() => {
    if (!colorMap) return;
    const tileCount = 8;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(tileCount, tileCount);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.generateMipmaps = true;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;
    colorMap.magFilter = THREE.LinearFilter;
    colorMap.anisotropy = quality === 'high' ? 16 : quality === 'medium' ? 8 : 4;
    colorMap.needsUpdate = true;
  }, [colorMap, quality]);

  useEffect(() => {
    if (!normalMap) return;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(8, 8);
    normalMap.generateMipmaps = true;
    normalMap.minFilter = THREE.LinearMipmapLinearFilter;
    normalMap.needsUpdate = true;
  }, [normalMap]);

  // Fallback color while textures load
  const fallbackColor = useMemo(() => new THREE.Color('#A06838'), []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <meshStandardMaterial
        color={colorMap ? '#ffffff' : fallbackColor}
        map={colorMap}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1.2, 1.2)}
        roughness={0.92}
        metalness={0.02}
        envMapIntensity={0.3}
      />
    </mesh>
  );
}

// =====================================================================
// INSTANCED ROCKS
// =====================================================================

export type RockData = {
  position: [number, number, number];
  scale: number;
  seed: number;
  colorIndex: number;
};

const ROCK_COLORS_RGB = [
  new THREE.Color('#6B3A1C'),
  new THREE.Color('#8A4A28'),
  new THREE.Color('#5A2A12'),
];

export function MarsRocks({ rocks }: { rocks: RockData[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = noise2D(x * 3 + 100, z * 3 + y * 2 + 200);
      const deform = 0.55 + n * 0.6;
      pos.setX(i, x * deform * 1.1);
      pos.setY(i, y * deform * 0.4);
      pos.setZ(i, z * deform);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      dummy.position.set(r.position[0], r.position[1], r.position[2]);
      dummy.scale.set(r.scale, r.scale * 0.5, r.scale * 0.9);
      dummy.rotation.set(0, r.seed * 2.7, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const base = ROCK_COLORS_RGB[r.colorIndex % 3];
      const variation = (PERM[Math.abs(r.seed * 7) & 255] / 255 - 0.5) * 0.15;
      color.set(base);
      color.r = Math.max(0, Math.min(1, color.r + variation));
      color.g = Math.max(0, Math.min(1, color.g + variation * 0.6));
      color.b = Math.max(0, Math.min(1, color.b + variation * 0.4));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rocks]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, rocks.length]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.01} flatShading />
    </instancedMesh>
  );
}

// =====================================================================
// DUST PARTICLES
// =====================================================================

export function MarsDust({
  count = 200,
  spread = 30,
  height = 5,
}: {
  count?: number;
  spread?: number;
  height?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, basePositions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const sp = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = PERM[(i * 7) & 255] / 255 * Math.PI * 2;
      const r = 2 + PERM[(i * 13) & 255] / 255 * spread;
      const x = Math.cos(angle) * r;
      const y = PERM[(i * 19) & 255] / 255 * height + 0.1;
      const z = Math.sin(angle) * r;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      sp[i] = 0.15 + PERM[(i * 37) & 255] / 255 * 0.4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, basePositions: base, speeds: sp };
  }, [count, spread, height]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(t * speeds[i] + i * 0.37) * 0.5;
    }
    pos.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.005;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#D4A080"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// =====================================================================
// SKY DOME — texture-based with vertex-color fallback
// =====================================================================

export function MarsSky() {
  const skyTexture = useAsyncTexture('/textures/mars_sky.png');

  useEffect(() => {
    if (!skyTexture) return;
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    skyTexture.minFilter = THREE.LinearFilter;
    skyTexture.magFilter = THREE.LinearFilter;
    skyTexture.needsUpdate = true;
  }, [skyTexture]);

  // Vertex-colored fallback geometry (always available)
  const fallbackGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(90, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const horizon = new THREE.Color('#D4A070');
    const mid = new THREE.Color('#8A5030');
    const zenith = new THREE.Color('#4A2818');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 90);
      if (t < 0.1) {
        tmp.lerpColors(horizon, mid, t / 0.1);
      } else {
        tmp.lerpColors(mid, zenith, Math.min(1, (t - 0.1) / 0.5));
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  if (skyTexture) {
    return (
      <mesh>
        <sphereGeometry args={[90, 32, 16]} />
        <meshBasicMaterial map={skyTexture} side={THREE.BackSide} fog={false} />
      </mesh>
    );
  }

  // Fallback: vertex-colored sky dome while texture loads
  return (
    <mesh geometry={fallbackGeo} position={[0, -1, 0]}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
    </mesh>
  );
}

// =====================================================================
// HORIZON HAZE
// =====================================================================

export function MarsHorizonHaze() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[15, 90, 32]} />
        <meshBasicMaterial color="#D0A070" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} fog={false} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[55, 80, 5, 24, 1, true]} />
        <meshBasicMaterial color="#C08050" transparent opacity={0.02} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

// =====================================================================
// LIGHTING
// =====================================================================

export function MarsLighting({ quality = 'medium' }: { quality?: Quality }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (!sunRef.current) return;
    const l = sunRef.current;
    const s = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;
    l.shadow.mapSize.set(s, s);
    l.shadow.camera.near = 0.5;
    l.shadow.camera.far = 60;
    l.shadow.camera.left = -20;
    l.shadow.camera.right = 20;
    l.shadow.camera.top = 20;
    l.shadow.camera.bottom = -20;
    l.shadow.bias = -0.001;
    l.shadow.normalBias = 0.02;
  }, [quality]);

  return (
    <>
      <ambientLight intensity={0.5} color="#D0A880" />
      <directionalLight ref={sunRef} position={[20, 18, 12]} intensity={3.0} color="#FFE0C0" castShadow={quality !== 'low'} />
      <directionalLight position={[-15, 10, -10]} intensity={0.4} color="#C08050" />
      <directionalLight position={[-5, 4, 15]} intensity={0.3} color="#FFB070" />
      <hemisphereLight args={['#D0A070', '#8A5030', 0.4]} />
      <pointLight position={[50, 3, 0]} intensity={8} color="#D09060" distance={90} decay={2} />
    </>
  );
}
