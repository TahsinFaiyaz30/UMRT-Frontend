'use client';

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';
import { particleCountFor } from '@/lib/performance';
import { ModelRig, type ModelRigHandle } from './ModelRig';
import { DismantleRig } from './DismantleRig';

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
  return (
    <>
      <color attach="background" args={['#050201']} />
      <fog attach="fog" args={['#160604', 9, 46]} />

      <ambientLight intensity={0.24} color="#ff8b52" />
      <hemisphereLight args={['#ffc18f', '#0d0101', 0.44]} />
      <directionalLight
        position={[-11, 15, -14]}
        intensity={5.6}
        color="#ffd6ad"
        castShadow
        shadow-mapSize-width={quality === 'high' ? 3072 : 2048}
        shadow-mapSize-height={quality === 'high' ? 3072 : 2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={38}
        shadow-bias={-0.00045}
        shadow-normalBias={0.025}
      />
      <spotLight
        position={[-7, 6, 4]}
        target-position={[0, 1, 0]}
        intensity={13}
        angle={0.58}
        penumbra={0.82}
        distance={22}
        color="#ff4d18"
      />
      <spotLight position={[5, 3.4, 4]} intensity={9} angle={0.66} penumbra={0.94} distance={17} color="#fff0d2" />
      <pointLight position={[0, 2.3, -4]} intensity={7} distance={12} color="#d8ff4f" />

      <SolarHorizon />
      <DustStorm />
      <CinematicGround quality={quality} />
      <SignalRings />
      <DustField count={Math.min(260, particleCountFor(quality))} />

      {dismantleActive && dismantleProgressRef ? (
        <DismantleRig progressRef={dismantleProgressRef} timelineRef={dismantleTimelineRef} />
      ) : (
        <ModelRig ref={ref} running={false} />
      )}
    </>
  );
});

function terrainHash(seed: number) {
  const raw = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function terrainNoise(value: number) {
  const base = Math.floor(value);
  const fraction = value - base;
  const eased = fraction * fraction * (3 - 2 * fraction);
  return THREE.MathUtils.lerp(terrainHash(base), terrainHash(base + 1), eased);
}

function terrainHeight(x: number, y: number) {
  const distance = Math.sqrt(x * x + y * y);
  const centerMask = THREE.MathUtils.smoothstep(distance, 3.2, 10.5);
  const broad = Math.sin(x * 0.16) * Math.cos(y * 0.13) * 0.52;
  const cross = Math.sin((x + y) * 0.31) * 0.18 + Math.cos((x - y) * 0.27) * 0.16;
  const gravel = Math.sin(x * 1.73 + Math.cos(y * 0.8)) * 0.055
    + Math.cos(y * 1.31 + Math.sin(x * 0.7)) * 0.048;
  const craterA = -0.52 * Math.exp(-(((x + 10) ** 2 + (y + 5) ** 2) / 11));
  const craterB = -0.34 * Math.exp(-(((x - 13) ** 2 + (y - 7) ** 2) / 18));
  const ridgeNoise = terrainNoise(x * 0.23) * 2.5 + terrainNoise(x * 0.61 + 8.2) * 0.85;
  const farNoise = terrainNoise(x * 0.16 + 20.0) * 1.7 + terrainNoise(x * 0.48) * 0.52;
  const nearRidgeBand = Math.exp(-((y - 26) ** 2) / 28);
  const nearRidgeProfile = Math.max(0, 0.75 + ridgeNoise + Math.sin(x * 0.12) * 0.7);
  const farRidgeBand = Math.exp(-((y - 36) ** 2) / 20);
  const farRidgeProfile = Math.max(0, 0.65 + farNoise + Math.cos(x * 0.09) * 0.48);
  const rim = Math.max(0, distance - 20) * 0.018;
  const ridges = nearRidgeBand * nearRidgeProfile + farRidgeBand * farRidgeProfile;
  return (broad + cross + gravel + craterA + craterB + rim + ridges) * centerMask - 0.12;
}

function DustStorm() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 7.2, -34]} renderOrder={-2}>
      <planeGeometry args={[76, 26, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        fog={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
          }

          float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.52;
            for (int i = 0; i < 5; i++) {
              value += amplitude * noise(p);
              p = p * 2.03 + vec2(7.1, 3.7);
              amplitude *= 0.5;
            }
            return value;
          }

          void main() {
            vec2 drift = vec2(uTime * 0.012, -uTime * 0.003);
            float broad = fbm(vUv * vec2(3.2, 2.1) + drift);
            float detail = fbm(vUv * vec2(8.0, 4.8) - drift * 1.7);
            float cloud = smoothstep(0.48, 0.82, broad * 0.76 + detail * 0.32);
            float vertical = 1.0 - smoothstep(0.1, 0.96, vUv.y);
            float edge = smoothstep(0.0, 0.13, vUv.x) * smoothstep(0.0, 0.13, 1.0 - vUv.x);
            vec3 darkDust = vec3(0.18, 0.018, 0.005);
            vec3 litDust = vec3(1.0, 0.19, 0.035);
            vec3 color = mix(darkDust, litDust, clamp(vUv.x * 0.55 + broad * 0.6, 0.0, 1.0));
            gl_FragColor = vec4(color, cloud * vertical * edge * 0.72);
          }
        `}
      />
    </mesh>
  );
}

function CinematicGround({ quality }: { quality: Quality }) {
  const { gl } = useThree();
  const [albedo, normal, roughness, displacement] = useTexture([
    '/textures/mars-ground/albedo.jpg',
    '/textures/mars-ground/normal.png',
    '/textures/mars-ground/roughness.png',
    '/textures/mars-ground/displacement.png',
  ]);

  useEffect(() => {
    const maps = [albedo, normal, roughness, displacement];
    const anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
    maps.forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(22, 22);
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    });
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    roughness.colorSpace = THREE.NoColorSpace;
    displacement.colorSpace = THREE.NoColorSpace;
  }, [albedo, displacement, gl, normal, roughness]);

  const geometry = useMemo(() => {
    const segments = quality === 'low' ? 160 : quality === 'medium' ? 256 : 384;
    const plane = new THREE.PlaneGeometry(86, 86, segments, segments);
    const position = plane.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const low = new THREE.Color('#a36b58');
    const high = new THREE.Color('#f0b397');
    const shade = new THREE.Color();

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const distance = Math.sqrt(x * x + y * y);
      const height = terrainHeight(x, y);
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

  return (
    <group>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          map={albedo}
          normalMap={normal}
          normalScale={new THREE.Vector2(1.38, 1.38)}
          roughnessMap={roughness}
          displacementMap={displacement}
          displacementScale={quality === 'high' ? 0.42 : quality === 'medium' ? 0.3 : 0.18}
          displacementBias={-0.16}
          vertexColors
          roughness={0.96}
          metalness={0.015}
        />
      </mesh>
      <gridHelper
        args={[52, 52, '#ff5a1f', '#3a0e08']}
        position={[0, -0.015, 0]}
        material-transparent
        material-opacity={0.13}
        material-depthWrite={false}
      />
    </group>
  );
}

function RockField({ quality }: { quality: Quality }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = quality === 'low' ? 48 : quality === 'medium' ? 86 : 132;
  const geometry = useMemo(() => {
    const rock = new THREE.IcosahedronGeometry(1, 3);
    const position = rock.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const variation = 0.92
        + Math.sin(x * 7.1 + y * 3.7) * 0.055
        + Math.cos(z * 8.3 - x * 2.2) * 0.035;
      position.setXYZ(index, x * variation, y * variation, z * variation);
    }
    rock.computeVertexNormals();
    return rock;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const seed = index + 1;
      const randomA = ((seed * 16807) % 2147483647) / 2147483647;
      const randomB = ((seed * 48271 + 91) % 2147483647) / 2147483647;
      const randomC = ((seed * 69621 + 17) % 2147483647) / 2147483647;
      const angle = randomA * Math.PI * 2 + Math.sin(seed * 1.77) * 0.42;
      const radial = 6.3 + Math.sqrt(randomB) * 29;
      const x = Math.cos(angle) * radial + Math.sin(seed * 8.17) * 1.4;
      const z = Math.sin(angle) * radial + Math.cos(seed * 5.31) * 1.2;
      const scale = 0.035 + randomC ** 3.4 * 0.58;
      const stretch = 0.55 + ((seed * 19) % 37) / 60;
      dummy.position.set(x, terrainHeight(x, -z) + scale * 0.42, z);
      dummy.rotation.set(seed * 0.71, seed * 1.13, seed * 0.37);
      dummy.scale.set(scale * (0.8 + (seed % 4) * 0.13), scale * stretch, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
      color.set(index % 5 === 0 ? '#84351f' : index % 3 === 0 ? '#612315' : '#46170f');
      meshRef.current.setColorAt(index, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [count]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.96} metalness={0.025} />
    </instancedMesh>
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
    gradient.addColorStop(0, 'rgba(255,255,242,1)');
    gradient.addColorStop(0.045, 'rgba(255,250,205,1)');
    gradient.addColorStop(0.105, 'rgba(255,181,62,0.98)');
    gradient.addColorStop(0.22, 'rgba(255,80,10,0.62)');
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
    glowRef.current.scale.set(6.8 * pulse, 6.8 * pulse, 1);
  });

  return (
    <group position={[-8.5, 9.2, -31]}>
      <sprite ref={glowRef} scale={[6.8, 6.8, 1]} renderOrder={-1}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.94}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      <pointLight intensity={82} distance={54} color="#ff6a24" />
    </group>
  );
}

function SignalRings() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.z = state.clock.elapsedTime * 0.025;
  });

  return (
    <group ref={groupRef} position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
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
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const radius = 2 + ((index * 37) % count) / count * 28;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = ((index * 17) % 100) / 100 * 5.5;
      positions[index * 3 + 2] = Math.sin(angle) * radius - 4;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.006;
    pointsRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.09) * 0.4;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ffb06b"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.48}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
