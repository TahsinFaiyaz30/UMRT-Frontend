'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';
import {
  COSMIC_SYSTEMS,
  type CosmicPlanetConfig,
  type CosmicSystemConfig,
} from '@/components/achievements/cosmicArchiveConfig';

export type CosmicJourney = { target: number; current: number };
export type CosmicJourneyRef = React.MutableRefObject<CosmicJourney>;

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function TravelingStarField({ quality, active }: { quality: Quality; active: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = quality === 'high' ? 3200 : quality === 'medium' ? 1900 : 900;
  const geometry = useMemo(() => {
    const random = seededRandom(918273);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const warmth = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 64;
      positions[index * 3 + 1] = (random() - 0.5) * 38;
      positions[index * 3 + 2] = 18 - random() * 205;
      sizes[index] = 0.5 + random() * random() * 2.4;
      phases[index] = random() * Math.PI * 2;
      warmth[index] = random();
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    buffer.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    buffer.setAttribute('aWarmth', new THREE.BufferAttribute(warmth, 1));
    return buffer;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    if (active && materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aSize;
          attribute float aPhase;
          attribute float aWarmth;
          uniform float uTime;
          varying float vWarmth;
          varying float vPulse;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vWarmth = aWarmth;
            vPulse = 0.72 + 0.28 * sin(uTime * (0.45 + aWarmth * 0.7) + aPhase);
            gl_PointSize = min(9.0, aSize * vPulse * (82.0 / max(1.0, -mvPosition.z)));
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying float vWarmth;
          varying float vPulse;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float radius = length(p);
            if (radius > 0.5) discard;
            float core = smoothstep(0.5, 0.0, radius);
            float flareX = smoothstep(0.055, 0.0, abs(p.x)) * smoothstep(0.5, 0.05, abs(p.y));
            float flareY = smoothstep(0.055, 0.0, abs(p.y)) * smoothstep(0.5, 0.05, abs(p.x));
            vec3 color = mix(vec3(0.55, 0.72, 1.0), vec3(1.0, 0.42, 0.14), smoothstep(0.62, 1.0, vWarmth));
            gl_FragColor = vec4(color, (core * core + (flareX + flareY) * 0.16) * vPulse * 0.9);
          }
        `}
      />
    </points>
  );
}

function TransitionNebulae({ quality, active }: { quality: Quality; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = quality === 'high' ? 1200 : quality === 'medium' ? 700 : 300;
  const geometry = useMemo(() => {
    const random = seededRandom(442711);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const transition = index % (COSMIC_SYSTEMS.length - 1);
      const from = COSMIC_SYSTEMS[transition].position;
      const to = COSMIC_SYSTEMS[transition + 1].position;
      const centreX = (from[0] + to[0]) * 0.5;
      const centreY = (from[1] + to[1]) * 0.5;
      const centreZ = (from[2] + to[2]) * 0.5;
      const angle = random() * Math.PI * 2;
      const radial = Math.pow(random(), 0.64);
      positions[index * 3] = centreX + Math.cos(angle) * radial * 8 + (random() - 0.5) * 2;
      positions[index * 3 + 1] = centreY + Math.sin(angle) * radial * 5 + (random() - 0.5) * 1.5;
      positions[index * 3 + 2] = centreZ + (random() - 0.5) * 10;
      sizes[index] = 13 + random() * 40;
      tint[index] = (transition + random() * 0.5) / COSMIC_SYSTEMS.length;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    buffer.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    return buffer;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    if (!active) return;
    if (ref.current) ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.018) * 0.018;
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} renderOrder={-2}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aSize;
          attribute float aTint;
          uniform float uTime;
          varying float vTint;
          void main() {
            vec3 moved = position;
            moved.x += sin(uTime * 0.022 + position.z * 0.08) * 0.16;
            moved.y += cos(uTime * 0.018 + position.x * 0.12) * 0.11;
            vec4 mvPosition = modelViewMatrix * vec4(moved, 1.0);
            vTint = aTint;
            gl_PointSize = min(105.0, aSize * (78.0 / max(4.0, -mvPosition.z)));
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying float vTint;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float radius = length(p) * 2.0;
            if (radius > 1.0) discard;
            float cloud = pow(max(0.0, 1.0 - radius), 3.1);
            vec3 rust = vec3(0.95, 0.105, 0.018);
            vec3 blue = vec3(0.075, 0.24, 0.72);
            vec3 lime = vec3(0.38, 0.57, 0.055);
            vec3 color = vTint < 0.55 ? mix(rust, lime, vTint * 1.8) : mix(lime, blue, (vTint - 0.55) * 2.2);
            gl_FragColor = vec4(color, cloud * 0.11);
          }
        `}
      />
    </points>
  );
}

function ProceduralWorld({
  config,
  quality,
  starPosition,
}: {
  config: CosmicPlanetConfig;
  quality: Quality;
  starPosition: THREE.Vector3;
}) {
  const segments = quality === 'high' ? 64 : quality === 'medium' ? 44 : 30;
  const colorA = useMemo(() => new THREE.Color(config.colorA), [config.colorA]);
  const colorB = useMemo(() => new THREE.Color(config.colorB), [config.colorB]);
  const atmosphere = useMemo(() => new THREE.Color(config.atmosphere), [config.atmosphere]);

  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[config.radius, segments, Math.round(segments * 0.66)]} />
        <shaderMaterial
          uniforms={{
            uColorA: { value: colorA },
            uColorB: { value: colorB },
            uSeed: { value: config.seed },
            uStarPosition: { value: starPosition },
          }}
          vertexShader={`
            uniform float uSeed;
            varying vec3 vNormalView;
            varying vec3 vViewDirection;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vDirection;
            varying float vHeight;
            float hash31(vec3 p) {
              p = fract(p * 0.1031);
              p += dot(p, p.yzx + 33.33);
              return fract((p.x + p.y) * p.z);
            }
            float noise3(vec3 p) {
              vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
              return mix(
                mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x), mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
                mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x), mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
            }
            float fbm(vec3 p) {
              float value=0.0; float amp=0.52;
              for(int i=0;i<4;i++){ value += noise3(p)*amp; p=p*2.03+vec3(4.7,8.2,3.1); amp*=0.49; }
              return value;
            }
            void main() {
              vec3 direction = normalize(position);
              float broad = fbm(direction * 3.1 + uSeed);
              float detail = fbm(direction * 13.0 + uSeed * 2.7);
              float bands = sin(direction.y * (18.0 + mod(uSeed, 13.0)) + broad * 5.0) * 0.5 + 0.5;
              float height = (broad - 0.5) * 0.045 + (detail - 0.5) * 0.015 + bands * 0.006;
              vec3 displaced = position + normal * height;
              vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
              vNormalView = normalize(normalMatrix * normal);
              vViewDirection = normalize(-mvPosition.xyz);
              vWorldNormal = normalize(mat3(modelMatrix) * normal);
              vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
              vDirection = direction;
              vHeight = height;
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform float uSeed;
            uniform vec3 uStarPosition;
            varying vec3 vNormalView;
            varying vec3 vViewDirection;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vDirection;
            varying float vHeight;
            void main() {
              vec3 lightDirection = normalize(uStarPosition - vWorldPosition);
              float light = dot(vWorldNormal, lightDirection);
              float terminator = smoothstep(-0.18, 0.3, light);
              float band = sin(vDirection.y * (19.0 + mod(uSeed, 17.0)) + vDirection.x * 4.0) * 0.5 + 0.5;
              float mineral = sin((vDirection.x + vDirection.z) * 31.0 + uSeed) * 0.5 + 0.5;
              vec3 albedo = mix(uColorA, uColorB, clamp(band * 0.42 + mineral * 0.28 + vHeight * 5.0 + 0.25, 0.0, 1.0));
              float rim = pow(1.0 - max(0.0, dot(vNormalView, vViewDirection)), 3.2);
              vec3 color = albedo * (0.035 + terminator * (0.7 + max(0.0, light) * 0.65));
              color += uColorB * rim * terminator * 0.08;
              gl_FragColor = vec4(color, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[config.radius, Math.max(22, Math.round(segments * 0.6)), Math.max(16, Math.round(segments * 0.4))]} />
        <shaderMaterial
          uniforms={{ uAtmosphere: { value: atmosphere }, uStarPosition: { value: starPosition } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormalView; varying vec3 vViewDirection; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
            void main(){
              vec4 mv=modelViewMatrix*vec4(position,1.0);
              vNormalView=normalize(normalMatrix*normal);
              vViewDirection=normalize(-mv.xyz);
              vWorldNormal=normalize(mat3(modelMatrix)*normal);
              vWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;
              gl_Position=projectionMatrix*mv;
            }
          `}
          fragmentShader={`
            uniform vec3 uAtmosphere; uniform vec3 uStarPosition;
            varying vec3 vNormalView; varying vec3 vViewDirection; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
            void main(){
              float rim=pow(1.0-max(0.0,dot(vNormalView,vViewDirection)),3.7);
              float sunward=smoothstep(-0.2,0.45,dot(vWorldNormal,normalize(uStarPosition-vWorldPosition)));
              gl_FragColor=vec4(uAtmosphere,rim*(0.025+sunward*0.21));
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      {config.rings && (
        <mesh rotation={[Math.PI / 2.35, 0.18, 0]}>
          <ringGeometry args={[config.radius * 1.42, config.radius * 2.05, 96]} />
          <meshStandardMaterial color={config.colorB} emissive={config.colorB} emissiveIntensity={0.35} roughness={0.84} transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function OrbitingPlanet({
  planet,
  quality,
  journey,
  systemIndex,
  active,
  starPosition,
}: {
  planet: CosmicPlanetConfig;
  quality: Quality;
  journey: CosmicJourneyRef;
  systemIndex: number;
  active: boolean;
  starPosition: THREE.Vector3;
}) {
  const orbitRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!active || Math.abs(journey.current.current * 7 - systemIndex) > 1.75) return;
    if (orbitRef.current) orbitRef.current.rotation.y = planet.phase + state.clock.elapsedTime * planet.speed;
    if (spinRef.current) spinRef.current.rotation.y = state.clock.elapsedTime * planet.speed * 2.35 + planet.seed;
    if (moonRef.current) moonRef.current.rotation.y = state.clock.elapsedTime * (planet.speed > 0 ? 0.7 : -0.7) + planet.seed;
  });

  const moonConfig = useMemo<CosmicPlanetConfig>(() => ({
    radius: Math.max(0.08, planet.radius * 0.2), orbit: 0, speed: 0, inclination: 0, phase: 0,
    colorA: '#090807', colorB: '#81736b', atmosphere: planet.atmosphere, seed: planet.seed + 11,
  }), [planet]);

  return (
    <group rotation={[0, 0, planet.inclination]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[planet.orbit, 0.008, 4, 96]} />
        <meshBasicMaterial color={planet.atmosphere} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <group ref={orbitRef}>
        <group position={[planet.orbit, 0, 0]}>
          <group ref={spinRef}>
            <ProceduralWorld config={planet} quality={quality} starPosition={starPosition} />
          </group>
          {planet.moon && (
            <group ref={moonRef}>
              <group position={[planet.radius * 1.7, 0.08, 0]}>
                <ProceduralWorld config={moonConfig} quality={quality === 'high' ? 'medium' : 'low'} starPosition={starPosition} />
              </group>
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

function AsteroidBelt({
  count,
  quality,
  journey,
  systemIndex,
  active,
}: {
  count: number;
  quality: Quality;
  journey: CosmicJourneyRef;
  systemIndex: number;
  active: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const actualCount = quality === 'high' ? count : quality === 'medium' ? Math.round(count * 0.62) : Math.round(count * 0.34);
  useEffect(() => {
    if (!ref.current) return;
    const random = seededRandom(7801 + systemIndex * 997);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < actualCount; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 4.8 + (random() - 0.5) * 1.4;
      position.set(Math.cos(angle) * radius, (random() - 0.5) * 0.34, Math.sin(angle) * radius);
      rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      quaternion.setFromEuler(rotation);
      const amount = 0.022 + random() * 0.058;
      scale.set(amount * (0.7 + random()), amount, amount * (0.65 + random()));
      matrix.compose(position, quaternion, scale);
      ref.current.setMatrixAt(index, matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [actualCount, systemIndex]);

  useFrame((state) => {
    if (!active || !ref.current || Math.abs(journey.current.current * 7 - systemIndex) > 1.7) return;
    ref.current.rotation.y = state.clock.elapsedTime * (systemIndex % 2 ? -0.025 : 0.03);
    ref.current.rotation.z = Math.sin(systemIndex * 1.7) * 0.18;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, actualCount]} frustumCulled>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#4a291d" emissive="#160704" emissiveIntensity={0.18} roughness={0.93} metalness={0.08} />
    </instancedMesh>
  );
}

export function SystemCluster({
  config,
  index,
  quality,
  journey,
  active,
  local = false,
}: {
  config: CosmicSystemConfig;
  index: number;
  quality: Quality;
  journey: CosmicJourneyRef;
  active: boolean;
  local?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Group>(null);
  const binaryRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const starWorldPosition = useMemo(() => new THREE.Vector3(), []);
  const invalidate = useThree((state) => state.invalidate);
  const position = local ? [0, 0, 0] as const : config.position;

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(starWorldPosition);
    invalidate();
  }, [config.position, invalidate, local, starWorldPosition]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(starWorldPosition);
    if (!active) return;
    const distance = Math.abs(journey.current.current * 7 - index);
    groupRef.current.visible = local || distance < 1.7;
    if (!groupRef.current.visible) return;
    if (starRef.current) starRef.current.rotation.y = state.clock.elapsedTime * 0.16;
    if (binaryRef.current) binaryRef.current.rotation.y = state.clock.elapsedTime * 0.31;
    if (pulseRef.current) {
      const phase = (state.clock.elapsedTime * 0.24) % 1;
      pulseRef.current.scale.setScalar(1 + phase * 1.7);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.22;
    }
  });

  return (
    <group ref={groupRef} position={position} visible={local || index === 0}>
      <pointLight color={config.starColor} intensity={config.starIntensity} distance={13} decay={2} />
      <group ref={starRef}>
        <mesh>
          <icosahedronGeometry args={[config.starSize, quality === 'high' ? 6 : 4]} />
          <meshStandardMaterial color={config.starCore} emissive={config.starColor} emissiveIntensity={4.4} roughness={0.52} />
        </mesh>
        <mesh scale={1.18}>
          <icosahedronGeometry args={[config.starSize, 2]} />
          <meshBasicMaterial color={config.starColor} transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={pulseRef}>
          <sphereGeometry args={[config.starSize * 1.25, 24, 16]} />
          <meshBasicMaterial color={config.starColor} transparent opacity={0.055} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {config.pulsar && (
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[config.starSize * 2.1, 0.025, 6, 96]} /><meshBasicMaterial color={config.starColor} transparent opacity={0.6} depthWrite={false} /></mesh>
            <mesh position={[0, 2.8, 0]}><coneGeometry args={[0.16, 5.2, 18, 1, true]} /><meshBasicMaterial color={config.starColor} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
            <mesh position={[0, -2.8, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.16, 5.2, 18, 1, true]} /><meshBasicMaterial color={config.starColor} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          </>
        )}
      </group>
      {config.binary && (
        <group ref={binaryRef}>
          <group position={[config.starSize * 1.65, 0.15, 0]}>
            <pointLight color="#8bc6ff" intensity={6} distance={6} decay={2} />
            <mesh><icosahedronGeometry args={[config.starSize * 0.42, 4]} /><meshStandardMaterial color="#ffffff" emissive="#6faeff" emissiveIntensity={4} roughness={0.5} /></mesh>
          </group>
        </group>
      )}
      {config.planets.map((planet) => (
        <OrbitingPlanet
          key={`${config.name}-${planet.seed}`}
          planet={planet}
          quality={quality}
          journey={journey}
          systemIndex={index}
          active={active}
          starPosition={starWorldPosition}
        />
      ))}
      <AsteroidBelt count={config.debris} quality={quality} journey={journey} systemIndex={index} active={active} />
    </group>
  );
}

function TransitionGate({
  index,
  journey,
  active,
}: {
  index: number;
  journey: CosmicJourneyRef;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const from = COSMIC_SYSTEMS[index].position;
  const to = COSMIC_SYSTEMS[index + 1].position;
  const position = useMemo(
    () => new THREE.Vector3(
      (from[0] + to[0]) * 0.5,
      (from[1] + to[1]) * 0.5,
      (from[2] + to[2]) * 0.5 + 9.9,
    ),
    [from, to],
  );
  const target = useMemo(() => new THREE.Vector3(...to), [to]);

  useEffect(() => {
    groupRef.current?.lookAt(target);
  }, [target]);

  useFrame((state) => {
    if (!active || !groupRef.current) return;
    const distance = Math.abs(journey.current.current * 7 - (index + 0.5));
    groupRef.current.visible = distance < 1.05;
    if (!groupRef.current.visible) return;
    groupRef.current.children.forEach((child, childIndex) => {
      if (child.type === 'Mesh') child.rotation.z = state.clock.elapsedTime * (0.16 + childIndex * 0.07) * (childIndex % 2 ? -1 : 1);
    });
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      {[2.0, 2.45, 3.05].map((radius, ring) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, ring === 1 ? 0.035 : 0.018, 7, 128]} />
          <meshBasicMaterial color={ring === 1 ? '#d8ff4f' : '#ff5a1f'} transparent opacity={ring === 1 ? 0.48 : 0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <pointLight color={index % 2 ? '#6f9cff' : '#ff5a1f'} intensity={8} distance={8} decay={2} />
    </group>
  );
}

export function SystemCorridor({
  quality,
  journey,
  active,
}: {
  quality: Quality;
  journey: CosmicJourneyRef;
  active: boolean;
}) {
  return (
    <>
      <TravelingStarField quality={quality} active={active} />
      <TransitionNebulae quality={quality} active={active} />
      {COSMIC_SYSTEMS.map((system, index) => (
        <SystemCluster key={system.name} config={system} index={index} quality={quality} journey={journey} active={active} />
      ))}
      {COSMIC_SYSTEMS.slice(0, -1).map((system, index) => (
        <TransitionGate key={`${system.name}-gate`} index={index} journey={journey} active={active} />
      ))}
    </>
  );
}
