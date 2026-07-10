'use client';

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';
import { particleCountFor } from '@/lib/performance';
import { ModelRig, type ModelRigHandle } from './ModelRig';
import { DismantleRig } from './DismantleRig';
import { SoilInteraction } from './SoilInteraction';

export const HeroScene = forwardRef<
  ModelRigHandle,
  {
    quality: Quality;
    dismantleProgressRef?: RefObject<number>;
    dismantleTimelineRef?: RefObject<number>;
    dismantleActive?: boolean;
  }
>(function HeroScene(
  { quality, dismantleProgressRef, dismantleTimelineRef, dismantleActive },
  ref,
) {
  const groundRef = useRef<THREE.Mesh>(null);
  return (
    <>
      <color attach="background" args={['#050201']} />
      <fog attach="fog" args={['#160604', 18, 58]} />

      <Environment resolution={256} frames={1} background={false}>
        <Lightformer form="ring" color="#ff5a1f" intensity={4.2} scale={12} position={[-10, 10, -18]} target={[0, 0, 0]} />
        <Lightformer form="rect" color="#ff6c32" intensity={1.35} scale={[8, 4, 1]} position={[10, 6, 9]} target={[0, 0.8, 0]} />
        <Lightformer form="rect" color="#602012" intensity={1.2} scale={[10, 5, 1]} position={[-8, 3, 10]} target={[0, 0.5, 0]} />
      </Environment>

      <ambientLight intensity={0.2} color="#9b3420" />
      <hemisphereLight args={['#ff7540', '#120503', 0.56]} />
      <directionalLight
        position={[-9, 8.5, -36]}
        intensity={3.25}
        color="#ff692f"
        castShadow
        shadow-mapSize-width={quality === 'low' ? 1024 : 2048}
        shadow-mapSize-height={quality === 'low' ? 1024 : 2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={0.5}
        shadow-camera-far={52}
        shadow-bias={-0.00018}
        shadow-normalBias={0.006}
      />
      <spotLight
        position={[7, 5.5, 8]}
        intensity={11.5}
        angle={0.64}
        penumbra={0.96}
        distance={18}
        color="#ff6330"
        onUpdate={(light) => light.layers.set(1)}
      />
      <directionalLight position={[7, 5, 9]} intensity={1.7} color="#ff6d32" onUpdate={(light) => light.layers.set(1)} />

      <SolarHorizon />
      <DustStorm quality={quality} />
      <CinematicGround quality={quality} groundRef={groundRef} />
      <SoilInteraction groundRef={groundRef} />
      <SignalRings />
      <DustField count={particleCountFor(quality)} />

      {dismantleActive && dismantleProgressRef ? (
        <DismantleRig progressRef={dismantleProgressRef} timelineRef={dismantleTimelineRef} />
      ) : (
        <ModelRig ref={ref} running={false} />
      )}
    </>
  );
});

const SURFACE_BUMPS: Array<[number, number, number, number]> = [
  [-10, -6, 2.7, 0.78],
  [12, -9, 3.2, 0.96],
  [8, 8, 2.3, 0.62],
  [-15, 13, 4.1, 1.38],
  [17, 18, 4.6, 1.72],
  [-6, 21, 3.3, 1.24],
  [3.5, 15, 1.8, 0.46],
];

function hash2(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uy,
  );
}

function terrainFbm(x: number, y: number, octaves = 4) {
  let total = 0;
  let amplitude = 0.54;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, y * frequency) * amplitude;
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return total / normalizer;
}

function terrainHeight(x: number, y: number) {
  const distance = Math.sqrt(x * x + y * y);
  const centerMask = THREE.MathUtils.smoothstep(distance, 5.2, 9.5);
  const warpX = (terrainFbm(x * 0.045 + 11.2, y * 0.045 - 7.4, 3) - 0.5) * 5.4;
  const warpY = (terrainFbm(x * 0.045 - 19.1, y * 0.045 + 4.8, 3) - 0.5) * 5.4;
  const localRelief = THREE.MathUtils.lerp(0.22, 1, THREE.MathUtils.smoothstep(distance, 9, 22));
  const broad = (terrainFbm((x + warpX) * 0.09, (y + warpY) * 0.09, 5) - 0.5) * 0.96 * localRelief;
  const brokenRidges = Math.abs(terrainFbm((x - warpY) * 0.19 + 2.7, (y + warpX) * 0.19 - 8.3, 4) - 0.5) * 0.32 * localRelief;
  const gravel = (terrainFbm(x * 0.73 + warpX, y * 0.73 + warpY, 3) - 0.5) * 0.13;
  const craterA = -0.52 * Math.exp(-(((x + 10) ** 2 + (y + 5) ** 2) / 11));
  const craterB = -0.34 * Math.exp(-(((x - 13) ** 2 + (y - 7) ** 2) / 18));
  const angle = Math.atan2(y, x);
  const nearRidgeCenter = 27
    + Math.sin(angle * 3) * 2.7
    + Math.sin(angle * 7 + 0.8) * 1.25;
  const farRidgeCenter = 38
    + Math.sin(angle * 2 + 1.2) * 2.8
    + Math.sin(angle * 5 - 0.5) * 1.1;
  const nearRidgeBand = Math.exp(-((distance - nearRidgeCenter) ** 2) / 22);
  const nearRidgeProfile = Math.max(0, 1.65
    + Math.sin(angle * 5 + 1.3) * 1.05
    + Math.sin(angle * 11 - 0.4) * 0.58);
  const farRidgeBand = Math.exp(-((distance - farRidgeCenter) ** 2) / 18);
  const farRidgeProfile = Math.max(0, 1.05
    + Math.sin(angle * 4 - 0.7) * 0.66
    + Math.sin(angle * 9 + 0.2) * 0.34);
  const rim = Math.max(0, distance - 20) * 0.018;
  const ridges = nearRidgeBand * nearRidgeProfile + farRidgeBand * farRidgeProfile;
  const bumps = SURFACE_BUMPS.reduce((height, [bumpX, bumpY, radius, amplitude]) => {
    const dx = x - bumpX;
    const dy = y - bumpY;
    return height + Math.exp(-(dx * dx + dy * dy) / (radius * radius)) * amplitude;
  }, 0);
  return (broad + brokenRidges + gravel + craterA + craterB + rim + ridges + bumps) * centerMask - 0.12;
}

const DUST_VERTEX_SHADER = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DUST_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uSunDirection;
  varying vec3 vDirection;

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float x00 = mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), u.x);
    float x10 = mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), u.x);
    float x01 = mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), u.x);
    float x11 = mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), u.x);
    return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
  }

  float fbm3(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise3(p);
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    vec3 driftA = vec3(uTime * 0.018, -uTime * 0.0025, uTime * 0.009);
    vec3 driftB = vec3(-uTime * 0.027, uTime * 0.0035, uTime * 0.014);
    float warp = fbm3(direction * 2.35 + driftA * 0.42 + vec3(9.4, 1.8, 6.7));
    vec3 domainWarp = vec3(1.25, -0.74, 0.92) * (warp - 0.5) * 2.1;
    float broad = fbm3(direction * 6.2 + domainWarp + driftA + vec3(4.3, 9.7, 2.1));
    float detail = fbm3(direction * 14.2 - domainWarp * 0.68 + driftB + vec3(17.1, 2.4, 11.8));
    float cloud = smoothstep(0.5, 0.7, broad * 0.84 + detail * 0.24);
    cloud *= mix(0.48, 1.0, smoothstep(0.36, 0.7, detail));
    float bottomFade = smoothstep(-0.18, 0.02, direction.y);
    float topFade = 1.0 - smoothstep(0.08, 0.36, direction.y);
    float horizon = exp(-pow((direction.y - 0.08) * 3.1, 2.0));
    float sunScatter = pow(max(dot(direction, normalize(uSunDirection)), 0.0), 5.0);
    vec3 shadowDust = vec3(0.15, 0.012, 0.004);
    vec3 copperDust = vec3(0.61, 0.058, 0.01);
    vec3 sunDust = vec3(1.0, 0.29, 0.065);
    vec3 color = mix(shadowDust, copperDust, clamp(0.18 + broad * 0.72, 0.0, 1.0));
    color = mix(color, sunDust, sunScatter * (0.38 + detail * 0.42));
    float alpha = cloud * bottomFade * topFade * (0.16 + horizon * 0.84) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function DustStorm({ quality }: { quality: Quality }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: quality === 'high' ? 0.72 : quality === 'medium' ? 0.62 : 0.5 },
    uSunDirection: { value: new THREE.Vector3(-9, 8.5, -36).normalize() },
  }), [quality]);

  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, 0]} renderOrder={-6}>
      <icosahedronGeometry args={[52, quality === 'low' ? 4 : 5]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        fog={false}
        side={THREE.BackSide}
        vertexShader={DUST_VERTEX_SHADER}
        fragmentShader={DUST_FRAGMENT_SHADER}
      />
    </mesh>
  );
}

function CinematicGround({
  quality,
  groundRef,
}: {
  quality: Quality;
  groundRef: RefObject<THREE.Mesh | null>;
}) {
  const { gl } = useThree();
  const [albedo, normal] = useTexture([
    '/textures/mars-ground/albedo.jpg',
    '/textures/mars-ground/normal.png',
  ]);

  useEffect(() => {
    const anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
    [albedo, normal].forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = anisotropy;
      texture.center.set(0.5, 0.5);
      texture.needsUpdate = true;
    });
    albedo.repeat.set(6.2, 6.2);
    albedo.rotation = 0.17;
    normal.repeat.set(34, 34);
    normal.rotation = -0.29;
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
  }, [albedo, gl, normal]);

  const baseGeometry = useMemo(() => {
    const segments = quality === 'low' ? 96 : quality === 'medium' ? 144 : 192;
    const plane = new THREE.PlaneGeometry(86, 86, segments, segments);
    const position = plane.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const low = new THREE.Color('#571a0f');
    const high = new THREE.Color('#a9472c');
    const shade = new THREE.Color();

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const distance = Math.sqrt(x * x + y * y);
      const patchDistance = Math.max(Math.abs(x), Math.abs(y));
      const patchUnderlay = (1 - THREE.MathUtils.smoothstep(patchDistance, 8.15, 9)) * 0.32;
      const height = terrainHeight(x, y) - patchUnderlay;
      position.setZ(index, height);

      const microVariation = (Math.sin(x * 2.9) + Math.cos(y * 3.3)) * 0.035;
      const colorMix = THREE.MathUtils.clamp(0.2 + height * 0.58 + distance / 82 + microVariation, 0, 1);
      shade.lerpColors(low, high, colorMix);
      colors[index * 3] = shade.r;
      colors[index * 3 + 1] = shade.g;
      colors[index * 3 + 2] = shade.b;
    }

    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    plane.computeVertexNormals();
    return plane;
  }, [quality]);

  const patchGeometry = useMemo(() => {
    const size = 18;
    const segments = quality === 'low' ? 128 : quality === 'medium' ? 192 : 256;
    const plane = new THREE.PlaneGeometry(size, size, segments, segments);
    const position = plane.attributes.position;
    const uv = plane.attributes.uv;
    const colors = new Float32Array(position.count * 3);
    const baseHeights = new Float32Array(position.count);
    const deformations = new Float32Array(position.count);
    const low = new THREE.Color('#571a0f');
    const high = new THREE.Color('#a9472c');
    const shade = new THREE.Color();

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const distance = Math.sqrt(x * x + y * y);
      const height = terrainHeight(x, y);
      position.setZ(index, height);
      baseHeights[index] = height;

      // Match the world-space UV projection of the 86 m base terrain so the
      // high-resolution patch is visually continuous at its boundary.
      uv.setXY(index, (x + 43) / 86, (y + 43) / 86);
      const microVariation = (Math.sin(x * 2.9) + Math.cos(y * 3.3)) * 0.035;
      const colorMix = THREE.MathUtils.clamp(0.2 + height * 0.58 + distance / 82 + microVariation, 0, 1);
      shade.lerpColors(low, high, colorMix);
      colors[index * 3] = shade.r;
      colors[index * 3 + 1] = shade.g;
      colors[index * 3 + 2] = shade.b;
    }

    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    plane.userData.surfaceMeta = { size, segments, baseHeights, deformations };
    plane.computeVertexNormals();
    (plane.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    (plane.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    plane.computeBoundingSphere();
    return plane;
  }, [quality]);

  return (
    <group>
      <mesh
        name="mars-ground-base"
        geometry={baseGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          map={albedo}
          normalMap={normal}
          normalScale={new THREE.Vector2(1.08, 1.08)}
          vertexColors
          roughness={1}
          metalness={0}
          envMapIntensity={0.06}
        />
      </mesh>

      <mesh
        ref={groundRef}
        name="mars-ground-surface"
        geometry={patchGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.079, 0]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          map={albedo}
          normalMap={normal}
          normalScale={new THREE.Vector2(1.08, 1.08)}
          vertexColors
          roughness={1}
          metalness={0}
          envMapIntensity={0.06}
        />
      </mesh>
    </group>
  );
}

function SolarHorizon() {
  const glowRef = useRef<THREE.Sprite>(null);
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return new THREE.CanvasTexture(canvas);
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(255,178,82,1)');
    gradient.addColorStop(0.045, 'rgba(255,120,42,1)');
    gradient.addColorStop(0.105, 'rgba(255,88,22,0.98)');
    gradient.addColorStop(0.22, 'rgba(255,50,7,0.68)');
    gradient.addColorStop(0.48, 'rgba(255,55,4,0.18)');
    gradient.addColorStop(1, 'rgba(255,30,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  useFrame((state) => {
    if (!glowRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.38) * 0.018;
    glowRef.current.scale.set(6.2 * pulse, 6.2 * pulse, 1);
  });

  return (
    <group position={[-9, 8.5, -36]}>
      <sprite ref={glowRef} scale={[6.2, 6.2, 1]} renderOrder={-8}>
        <spriteMaterial
          map={glowTexture}
          color="#ff5a24"
          transparent
          opacity={0.94}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      <sprite scale={[1.35, 1.35, 1]} renderOrder={-5}>
        <spriteMaterial
          map={glowTexture}
          color="#ffb05c"
          transparent
          opacity={1}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
    </group>
  );
}

function SignalRings() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.z = state.clock.elapsedTime * 0.025;
  });

  return (
    <group ref={groupRef} position={[0, -0.178, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {[3.25, 4.7, 6.8].map((radius, index) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, index === 0 ? 0.012 : 0.006, 6, 128]} />
          <meshBasicMaterial
            color={index === 0 ? '#d8ff4f' : '#ff5a1f'}
            transparent
            opacity={index === 0 ? 0.38 : 0.16}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const HORIZON_ROCKS: Array<[number, number, number, number]> = [
  [-15, 0.6, -16, 3.8],
  [-9, 0.35, -20, 2.5],
  [12, 0.5, -18, 3.2],
  [18, 0.7, -23, 4.5],
  [-23, 0.8, -28, 5.2],
  [27, 0.5, -31, 4.0],
  [0, 0.45, -30, 3.2],
  [-7, 0.12, -8, 0.7],
  [8, 0.1, -10, 0.9],
];

function HorizonForms() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    HORIZON_ROCKS.forEach(([x, y, z, scale], index) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.17, index * 0.61, index * 0.09);
      dummy.scale.set(scale, scale * 0.34, scale * 0.78);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, HORIZON_ROCKS.length]} castShadow receiveShadow>
      <meshStandardMaterial color="#240705" roughness={1} flatShading />
    </instancedMesh>
  );
}

function DustField({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const dustTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(0.32, 'rgba(255,255,255,0.72)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = hash2(index + 3.1, 7.4) * Math.PI * 2;
      const radius = 1.8 + Math.sqrt(hash2(index + 8.3, 19.7)) * 29;
      const altitudeSeed = hash2(index + 11.7, 3.9);
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = altitudeSeed < 0.72
        ? -0.14 + Math.pow(altitudeSeed / 0.72, 2.2) * 0.8
        : 0.65 + ((altitudeSeed - 0.72) / 0.28) * 5.2;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.006;
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.012;
    pointsRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.09) * 0.4;
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.13) * 0.12;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ffb06b"
        map={dustTexture}
        alphaMap={dustTexture}
        alphaTest={0.01}
        size={0.052}
        sizeAttenuation
        transparent
        opacity={0.48}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
