'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';
import { particleCountFor } from '@/lib/performance';
import { ModelRig, type ModelRigHandle } from './ModelRig';
import { DismantleRig } from './DismantleRig';
import { SoilInteraction } from './SoilInteraction';
import { CelestialBackdrop } from './CelestialBackdrop';
import {
  solarDaylightFactorFromPosition,
  solarLightingFromSettings,
  useSolarCalibrationSettings,
  writeAutomaticMarsSunPosition,
  type SolarLightingValues,
} from '@/lib/solarCalibration';
import { disposeTexture } from '@/lib/threeDisposal';

const GROUND_TEXTURES: string[] = [
  '/textures/mars-ground/albedo.jpg',
  '/textures/mars-ground/normal.png',
];

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
  const { scene } = useThree();
  const groundRef = useRef<THREE.Mesh>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight>(null);
  const solarSettings = useSolarCalibrationSettings();
  const solar = useMemo(() => solarLightingFromSettings(solarSettings), [solarSettings]);
  const liveSunPositionRef = useRef<[number, number, number]>([...solar.position]);
  const liveSunDaylightRef = useRef(1);
  const autoSunScratchRef = useRef({
    azimuth: solarSettings.azimuth,
    elevation: solarSettings.elevation,
    localSolarTimeHours: 0,
  });
  const [environmentSettings, setEnvironmentSettings] = useState(solarSettings);
  const [dismantleMounted, setDismantleMounted] = useState(Boolean(dismantleActive));
  const environmentSolar = useMemo(
    () => solarLightingFromSettings(environmentSettings),
    [environmentSettings],
  );
  const environmentEnergy = environmentSolar.intensity / 3.25;

  useEffect(() => {
    if (solarSettings.autoSunCycle) return;
    const livePosition = liveSunPositionRef.current;
    livePosition[0] = solar.position[0];
    livePosition[1] = solar.position[1];
    livePosition[2] = solar.position[2];
  }, [solar.position, solarSettings.autoSunCycle]);

  useEffect(() => () => {
    scene.environmentIntensity = 1;
  }, [scene]);

  useFrame(() => {
    const livePosition = liveSunPositionRef.current;
    if (solarSettings.autoSunCycle) {
      writeAutomaticMarsSunPosition(
        performance.now(),
        livePosition,
        autoSunScratchRef.current,
      );
    }

    // Direct light, shader direction, and environment exposure all follow one
    // allocation-free position. The expensive environment cube map remains
    // cached instead of being regenerated throughout the automatic cycle.
    const daylight = solarSettings.autoSunCycle
      ? solarDaylightFactorFromPosition(livePosition)
      : 1;
    liveSunDaylightRef.current = daylight;
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = solar.intensity * 0.07 * (0.18 + daylight * 0.82);
    }
    if (hemisphereLightRef.current) {
      hemisphereLightRef.current.intensity = solar.intensity * 0.2 * (0.14 + daylight * 0.86);
    }
    scene.environmentIntensity = 0.2 + daylight * 0.8;
  });

  // Rebuilding a cube-map environment for every pointer sample from the solar
  // joystick creates a rapid stream of half-float render targets and shader
  // recompiles. Direct lights and visible atmospheric uniforms still update
  // immediately; only the reflection capture waits until the control settles.
  useEffect(() => {
    const timeout = window.setTimeout(() => setEnvironmentSettings(solarSettings), 180);
    return () => window.clearTimeout(timeout);
  }, [solarSettings]);

  // Keep the assembled rover alive while the temporary teardown is visible so
  // crossing the timeline boundary does not repeatedly clone and compile the
  // whole GLTF. The teardown itself gets a short reuse window, then unmounts
  // and releases its resources when the user has genuinely left that phase.
  useEffect(() => {
    if (dismantleActive) {
      setDismantleMounted(true);
      return undefined;
    }
    if (!dismantleMounted) return undefined;
    const timeout = window.setTimeout(() => setDismantleMounted(false), 4_000);
    return () => window.clearTimeout(timeout);
  }, [dismantleActive, dismantleMounted]);

  const environmentKey = [
    environmentSettings.temperature,
    environmentEnergy.toFixed(2),
    environmentSettings.azimuth,
    environmentSettings.elevation,
  ].join('-');
  return (
    <>
      <color attach="background" args={['#050201']} />
      <fog attach="fog" args={['#160604', 18, 58]} />

      <Environment key={environmentKey} resolution={256} frames={1} background={false}>
        <Lightformer
          form="ring"
          color={environmentSolar.color}
          intensity={4.2 * environmentEnergy}
          scale={12}
          position={environmentSolar.position.map((value) => value * 0.46) as [number, number, number]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          color={environmentSolar.color}
          intensity={1.35 * environmentEnergy}
          scale={[8, 4, 1]}
          position={environmentSolar.position.map((value, index) => index === 1
            ? Math.max(4, value * 0.2)
            : -value * 0.22) as [number, number, number]}
          target={[0, 0.8, 0]}
        />
        <Lightformer
          form="rect"
          color="#602012"
          intensity={1.2 * Math.sqrt(environmentEnergy)}
          scale={[10, 5, 1]}
          position={[-8, 3, 10]}
          target={[0, 0.5, 0]}
        />
      </Environment>

      <ambientLight ref={ambientLightRef} intensity={solar.intensity * 0.07} color={solar.color} />
      <hemisphereLight ref={hemisphereLightRef} args={[solar.color, '#120503', solar.intensity * 0.2]} />
      <CalibratedSun
        solar={solar}
        quality={quality}
        sunPositionRef={liveSunPositionRef}
        sunDaylightRef={liveSunDaylightRef}
      />
      <CelestialBackdrop
        quality={quality}
        sunDirectionRef={liveSunPositionRef}
        sunColor={solar.color}
      />

      <DustStorm
        quality={quality}
        sunDirectionRef={liveSunPositionRef}
        sunDaylightRef={liveSunDaylightRef}
        sunColor={solar.color}
        sunGlow={solar.glow}
        sunStrength={solar.intensity / 3.25}
      />
      <CinematicGround quality={quality} groundRef={groundRef} />
      <SoilInteraction
        groundRef={groundRef}
        quality={quality}
        sunDirectionRef={liveSunPositionRef}
        sunDaylightRef={liveSunDaylightRef}
        sunColor={solar.color}
        sunStrength={solar.intensity / 3.25}
      />
      <SignalRings />
      <DustField
        count={particleCountFor(quality)}
        sunDirectionRef={liveSunPositionRef}
        sunDaylightRef={liveSunDaylightRef}
        sunColor={solar.color}
        sunGlow={solar.glow}
        sunStrength={solar.intensity / 3.25}
      />

      <group visible={!dismantleActive}>
        <ModelRig ref={ref} running={false} />
      </group>
      {dismantleMounted && dismantleProgressRef && (
        <group visible={Boolean(dismantleActive)}>
          <DismantleRig progressRef={dismantleProgressRef} timelineRef={dismantleTimelineRef} />
        </group>
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

const TERRAIN_LOW_COLOR = '#571a0f';
const TERRAIN_HIGH_COLOR = '#a9472c';
// Shared compacted-regolith average. Both the terrain vertex palette and
// suspended dust derive from these same local iron-oxide endpoints.
const TERRAIN_REGOLITH_AVERAGE = new THREE.Color(TERRAIN_LOW_COLOR)
  .lerp(new THREE.Color(TERRAIN_HIGH_COLOR), 0.52);
// Loose airborne fines scatter through pore space and present far more surface
// area than compacted ground. Keep the terrain hue, but lift it toward the
// brighter ferric fraction so solar-lit dust remains visible without becoming
// an emissive orange overlay.
const SUSPENDED_DUST_REFLECTANCE = TERRAIN_REGOLITH_AVERAGE.clone()
  .lerp(new THREE.Color('#c97852'), 0.58);

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

function dustFragmentShaderFor(quality: Quality) {
  // The atmosphere is silhouette-critical behind the rover's mast and sensor
  // head. Medium/high tiers therefore retain the four-octave structure that
  // gave the original scene its crisp billows; only the low tier drops one
  // octave. This is deliberately independent from the interactive soil dust.
  const octaves = quality === 'low' ? 3 : 4;

  return `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uRegolithReflectance;
  uniform float uSunGlow;
  uniform float uSunStrength;
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
    float normalization = 0.0;
    for (int i = 0; i < ${octaves}; i++) {
      value += amplitude * noise3(p);
      normalization += amplitude;
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.5;
    }
    return value / max(normalization, 0.001);
  }

  float detailNoise3(vec3 p) {
    // Two compact octaves are sufficient for erosion at the cloud rim. The
    // broad volume still uses the full FBM stack, while this cheaper branch
    // avoids paying for four additional octaves over the entire viewport.
    float primary = noise3(p);
    float secondary = noise3(p * 2.07 + vec3(4.7, 11.3, 2.9));
    return primary * 0.68 + secondary * 0.32;
  }

  vec2 analyticCurl(vec2 p, float time) {
    return vec2(
      sin(p.y * 0.83 + time * 0.071)
        + 0.43 * sin(p.x * 1.37 - time * 0.047),
      cos(p.x * 0.79 - time * 0.063)
        - 0.39 * cos(p.y * 1.21 + time * 0.052)
    ) * 0.23;
  }

  float henyeyGreenstein(float cosTheta, float anisotropy) {
    float anisotropySquared = anisotropy * anisotropy;
    float denominator = max(
      1.0 + anisotropySquared - 2.0 * anisotropy * cosTheta,
      0.001
    );
    return (1.0 - anisotropySquared)
      / (12.5663706144 * pow(denominator, 1.5));
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = direction.y;
    if (height < -0.2 || height > 0.52) discard;

    // Hybrid atmosphere: retain the current coherent curl/advection field,
    // but advect full 3D domain-warped FBM instead of projecting noise onto a
    // narrow spherical strip. The latter was responsible for the stretched,
    // nearly empty sky. Two differently moving volumes keep the billows alive
    // without making their silhouettes boil or slide as one flat layer.
    vec2 sphericalPlane = direction.xz * (5.4 + max(height, 0.0) * 2.8);
    vec2 curl = analyticCurl(sphericalPlane * 0.7 + vec2(3.8, -6.1), uTime);
    vec3 curlWarp = vec3(curl.x, (curl.x + curl.y) * 0.18, curl.y);
    vec3 lowDrift = vec3(uTime * 0.018, -uTime * 0.0025, uTime * 0.009);
    vec3 detailDrift = vec3(-uTime * 0.027, uTime * 0.0035, uTime * 0.014);
    float warp = fbm3(
      direction * 2.35
      + lowDrift * 0.42
      + curlWarp * 0.72
      + vec3(9.4, 1.8, 6.7)
    );
    vec3 domainWarp = vec3(1.25, -0.74, 0.92) * (warp - 0.5) * 2.1
      + curlWarp * 0.58;
    float broad = fbm3(
      direction * 6.2
      + domainWarp
      + lowDrift
      + vec3(4.3, 9.7, 2.1)
    );
    float detail = fbm3(
      direction * 14.2
      - domainWarp * 0.68
      + detailDrift
      + vec3(17.1, 2.4, 11.8)
    );
    float highWisp = detailNoise3(
      direction * 28.0
      + domainWarp * 0.32
      + vec3(-detailDrift.z, detailDrift.x, detailDrift.y) * 0.72
      + vec3(2.8, 14.1, 21.7)
    );

    // Density is deliberately sparse. Fine noise erodes the broad body and
    // breaks its rim instead of adding a second blanket of opacity. This keeps
    // real black sky between cells while preserving detailed illuminated
    // tendrils at their edges.
    float billow = smoothstep(0.54, 0.73, broad * 0.84 + detail * 0.24);
    float edgeCarving = smoothstep(0.4, 0.72, detail * 0.68 + highWisp * 0.38);
    billow *= mix(0.28, 1.0, edgeCarving);
    float detachedWisp = smoothstep(0.64, 0.8, detail * 0.7 + highWisp * 0.34);
    float bottomFade = smoothstep(-0.18, 0.015, height);
    float topFade = 1.0 - smoothstep(0.08, 0.36, height);
    float horizonBand = exp(-pow((height - 0.075) * 3.15, 2.0));
    float middleBand = smoothstep(0.02, 0.1, height)
      * (1.0 - smoothstep(0.25, 0.44, height));
    float aerosolDensity = (
      billow * mix(0.46, 0.76, horizonBand)
      + detachedWisp * middleBand * 0.055
    ) * bottomFade * topFade;

    // Preserve the current physical response to the calibration panel:
    // Beer-Lambert extinction controls coverage while HG scattering controls
    // how strongly the same cloud is illuminated toward the movable sun.
    float horizonPath = 0.72 + 1.12 * exp(-abs(height - 0.035) * 8.5);
    // Treat the quality opacity as a density calibration, then use the actual
    // Beer-Lambert transmittance for compositing. Multiplying the final alpha
    // by an artistic opacity let bright stars remain unnaturally crisp through
    // optically thick dust even though the scattering color looked dense.
    float densityCalibration = 0.82 + uOpacity * 0.5;
    float opticalDepth = clamp(
      aerosolDensity * horizonPath * densityCalibration,
      0.0,
      2.2
    );
    float transmittance = exp(-opticalDepth);
    float alpha = 1.0 - transmittance;

    const float anisotropy = 0.673;
    const float singleScatteringAlbedo = 0.95;
    float cosTheta = dot(direction, normalize(uSunDirection));
    float phase = henyeyGreenstein(cosTheta, anisotropy);
    float forwardLobe = smoothstep(0.35, 1.0, cosTheta);
    float illumination = clamp(uSunStrength, 0.0, 2.5);
    float solarLuminance = dot(uSunColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 diffuseSpectrum = mix(uSunColor, vec3(solarLuminance), 0.14);
    vec3 diffuseIrradiance = diffuseSpectrum * sqrt(illumination) * 0.38;
    vec3 directIrradiance = uSunColor
      * illumination
      * singleScatteringAlbedo
      * (0.32 + phase * (1.95 + uSunGlow * forwardLobe * 0.34));
    float selfShadow = exp(-opticalDepth * 1.65);
    vec3 fineDustReflectance = pow(
      max(uRegolithReflectance, vec3(0.001)),
      vec3(0.72)
    );
    vec3 color = fineDustReflectance * (diffuseIrradiance + directIrradiance)
      * mix(0.46, 1.0, selfShadow);
    color += fineDustReflectance * uSunColor
      * forwardLobe * phase * uSunGlow * illumination * 0.34;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
}

function updateDustSolarUniforms(
  material: THREE.ShaderMaterial | null,
  sunDirection: readonly [number, number, number],
  sunColor: string,
  sunGlow: number,
  sunStrength: number,
) {
  if (!material) return;
  const materialUniforms = material.uniforms;
  (materialUniforms.uSunDirection.value as THREE.Vector3).set(...sunDirection).normalize();
  (materialUniforms.uSunColor.value as THREE.Color).set(sunColor);
  materialUniforms.uSunGlow.value = sunGlow;
  materialUniforms.uSunStrength.value = sunStrength;
}

function DustStorm({
  quality,
  sunDirectionRef,
  sunDaylightRef,
  sunColor,
  sunGlow,
  sunStrength,
}: {
  quality: Quality;
  sunDirectionRef: RefObject<readonly [number, number, number]>;
  sunDaylightRef: RefObject<number>;
  sunColor: string;
  sunGlow: number;
  sunStrength: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const fragmentShader = useMemo(() => dustFragmentShaderFor(quality), [quality]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: quality === 'high' ? 0.74 : quality === 'medium' ? 0.66 : 0.56 },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffb078') },
    uRegolithReflectance: { value: SUSPENDED_DUST_REFLECTANCE.clone() },
    uSunGlow: { value: 1 },
    uSunStrength: { value: 1 },
  }), [quality]);

  useEffect(() => {
    updateDustSolarUniforms(
      materialRef.current,
      sunDirectionRef.current,
      sunColor,
      sunGlow,
      sunStrength * sunDaylightRef.current,
    );
    if (materialRef.current) {
      materialRef.current.uniforms.uOpacity.value = quality === 'high'
        ? 0.74
        : quality === 'medium'
          ? 0.66
          : 0.56;
    }
  }, [quality, sunColor, sunDaylightRef, sunDirectionRef, sunGlow, sunStrength]);

  useFrame((state) => {
    if (!materialRef.current) return;
    const materialUniforms = materialRef.current.uniforms;
    const sunDirection = sunDirectionRef.current;
    materialUniforms.uTime.value = state.clock.elapsedTime;
    (materialUniforms.uSunDirection.value as THREE.Vector3).set(...sunDirection).normalize();
    materialUniforms.uSunStrength.value = sunStrength * sunDaylightRef.current;
  });

  return (
    <mesh position={[0, 0, 0]} renderOrder={-6}>
      <icosahedronGeometry args={[52, quality === 'low' ? 4 : 5]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
        fog={false}
        side={THREE.BackSide}
        vertexShader={DUST_VERTEX_SHADER}
        fragmentShader={fragmentShader}
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
  const [albedo, normal] = useTexture(GROUND_TEXTURES);

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

  const surfaceGeometry = useMemo(() => {
    // The rendered ground and the interactive ground must be the same mesh.
    // The former 36 m patch sat over an 86 m visual-only base, which created
    // large dead zones after orbiting or panning. A single adaptive surface
    // keeps every visible soil pixel deformable without a seam or proxy hit.
    // Overscan beyond the largest supported camera frustum so orbiting and
    // panning never reveal a visual-only strip at the terrain boundary.
    const size = 112;
    // Scale tessellation with the 112 m overscan so the deformation grid
    // retains approximately the original 86 m surface's spatial resolution.
    const segments = quality === 'low' ? 400 : quality === 'medium' ? 560 : 704;
    const plane = new THREE.PlaneGeometry(size, size, segments, segments);
    const position = plane.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const baseHeights = new Float32Array(position.count);
    const deformations = new Float32Array(position.count);
    const low = new THREE.Color(TERRAIN_LOW_COLOR);
    const high = new THREE.Color(TERRAIN_HIGH_COLOR);
    const shade = new THREE.Color();

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const distance = Math.sqrt(x * x + y * y);
      const height = terrainHeight(x, y);
      position.setZ(index, height);
      baseHeights[index] = height;

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
    plane.computeBoundingBox();
    plane.computeBoundingSphere();
    return plane;
  }, [quality]);

  useEffect(() => () => {
    const meta = surfaceGeometry.userData.surfaceMeta as Record<string, unknown> | undefined;
    if (meta) {
      Object.keys(meta).forEach((key) => delete meta[key]);
      delete surfaceGeometry.userData.surfaceMeta;
    }
    surfaceGeometry.dispose();
  }, [surfaceGeometry]);

  useEffect(() => () => {
    const disposed = new Set<THREE.Texture>();
    disposeTexture(albedo, disposed);
    disposeTexture(normal, disposed);
    useTexture.clear(GROUND_TEXTURES);
  }, [albedo, normal]);

  return (
    <mesh
      ref={groundRef}
      name="mars-ground-surface"
      geometry={surfaceGeometry}
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
  );
}

function CalibratedSun({
  solar,
  quality,
  sunPositionRef,
  sunDaylightRef,
}: {
  solar: SolarLightingValues;
  quality: Quality;
  sunPositionRef: RefObject<readonly [number, number, number]>;
  sunDaylightRef: RefObject<number>;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const glowMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const coreMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return new THREE.CanvasTexture(canvas);
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.045, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.11, 'rgba(255,255,255,0.94)');
    gradient.addColorStop(0.24, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.52, 'rgba(255,255,255,0.16)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame((state) => {
    const sunPosition = sunPositionRef.current;
    const daylight = sunDaylightRef.current;
    lightRef.current?.position.set(...sunPosition);
    sunGroupRef.current?.position.set(...sunPosition);
    if (lightRef.current) lightRef.current.intensity = solar.intensity * daylight;
    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = Math.min(1, solar.glow * 0.92 * visualStrength) * daylight;
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = Math.min(
        1,
        (0.72 + solar.glow * 0.14) * visualStrength,
      ) * daylight;
    }
    if (!glowRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.38) * 0.018;
    const outerScale = 3.2 + solar.glow * 3;
    glowRef.current.scale.set(outerScale * pulse, outerScale * pulse, 1);
  });

  const outerScale = 3.2 + solar.glow * 3;
  const coreScale = 1 + solar.glow * 0.35;
  const visualStrength = Math.sqrt(THREE.MathUtils.clamp(solar.intensity / 3.25, 0, 2.5));
  const sunPosition: [number, number, number] = [...solar.position];

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={sunPosition}
        intensity={solar.intensity}
        color={solar.color}
        castShadow
        shadow-mapSize-width={quality === 'low' ? 1024 : 2048}
        shadow-mapSize-height={quality === 'low' ? 1024 : 2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={0.5}
        shadow-camera-far={72}
        shadow-bias={-0.00018}
        shadow-normalBias={0.006}
      />
      <group ref={sunGroupRef} position={sunPosition}>
      <sprite ref={glowRef} scale={[outerScale, outerScale, 1]} renderOrder={-8}>
        <spriteMaterial
          ref={glowMaterialRef}
          map={glowTexture}
          color={solar.color}
          transparent
          opacity={Math.min(1, solar.glow * 0.92 * visualStrength)}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      <sprite scale={[coreScale, coreScale, 1]} renderOrder={-5}>
        <spriteMaterial
          ref={coreMaterialRef}
          map={glowTexture}
          color={solar.color}
          transparent
          opacity={Math.min(1, (0.72 + solar.glow * 0.14) * visualStrength)}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      </group>
    </>
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

  useEffect(() => () => geometry.dispose(), [geometry]);

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

const DUST_FIELD_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec3 uSunDirection;
  attribute float aAgeOffset;
  attribute float aScale;
  attribute float aLayer;
  attribute float aTone;
  varying float vCosTheta;
  varying float vAnisotropy;
  varying float vOpticalDepth;
  varying float vTone;
  varying float vVisibility;

  void main() {
    vec3 advectedPosition = position;
    vec2 windDirection = normalize(vec2(0.93, 0.37));
    const float lifeTime = 9.2;
    float age = mod(uTime + aAgeOffset * lifeTime, lifeTime);
    float windSpeed = mix(4.25, 5.35, aLayer);
    vec2 wind = windDirection * age * windSpeed;

    // An Eulerian curl field bends all particles through the same air mass;
    // random birth age only staggers injection, never the wind direction.
    vec2 flowSample = position.xz + wind;
    vec2 curl = vec2(
      sin(flowSample.y * 0.17 + uTime * 0.16)
        + 0.46 * sin(flowSample.x * 0.11 - uTime * 0.09),
      cos(flowSample.x * 0.15 - uTime * 0.13)
        + 0.42 * cos(flowSample.y * 0.09 + uTime * 0.07)
    );
    advectedPosition.xz += wind + curl * mix(0.12, 0.58, aLayer);

    const float fieldRadius = 31.5;
    advectedPosition.x = mod(advectedPosition.x + fieldRadius, fieldRadius * 2.0) - fieldRadius;
    advectedPosition.z = mod(advectedPosition.z + fieldRadius, fieldRadius * 2.0) - fieldRadius;
    float verticalEddy = sin(
      flowSample.x * 0.21 + flowSample.y * 0.16 + uTime * mix(0.18, 0.34, aLayer)
    );
    verticalEddy += 0.43 * cos(flowSample.y * 0.29 - uTime * 0.12);
    advectedPosition.y += verticalEddy * mix(0.018, 0.19, aLayer);
    advectedPosition.y -= age * mix(0.012, 0.0018, aLayer);
    // Re-evaluate a cheap local floor after advection. The previous birth-
    // position floor travelled with the particle and buried most motes as
    // they crossed uneven terrain.
    float advectedFloor = -0.105
      + sin(advectedPosition.x * 0.31) * 0.035
      + cos(advectedPosition.z * 0.27) * 0.028
      + sin((advectedPosition.x + advectedPosition.z) * 0.11) * 0.022;
    advectedPosition.y = max(advectedPosition.y, advectedFloor + 0.025);

    vec4 worldPosition = modelMatrix * vec4(advectedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    float viewDepth = max(0.01, -viewPosition.z);
    vec3 viewRay = normalize(worldPosition.xyz - cameraPosition);
    vCosTheta = dot(viewRay, normalize(uSunDirection));
    vAnisotropy = mix(0.42, 0.67, aLayer);
    vTone = aTone;
    vOpticalDepth = mix(0.24, 0.11, aLayer) * mix(0.82, 1.16, aTone);
    float lifeFade = smoothstep(0.0, 0.42, age)
      * (1.0 - smoothstep(8.35, lifeTime, age));
    vVisibility = lifeFade
      * smoothstep(0.8, 3.0, viewDepth)
      * (1.0 - smoothstep(28.0, 48.0, viewDepth));

    gl_PointSize = clamp(aScale * (245.0 / viewDepth), 1.0, 5.5);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const DUST_FIELD_FRAGMENT_SHADER = `
  uniform vec3 uSunColor;
  uniform vec3 uRegolithReflectance;
  uniform float uSunGlow;
  uniform float uSunStrength;
  varying float vCosTheta;
  varying float vAnisotropy;
  varying float vOpticalDepth;
  varying float vTone;
  varying float vVisibility;

  float henyeyGreenstein(float cosTheta, float anisotropy) {
    float anisotropySquared = anisotropy * anisotropy;
    float denominator = max(
      1.0 + anisotropySquared - 2.0 * anisotropy * cosTheta,
      0.001
    );
    return (1.0 - anisotropySquared)
      / (12.5663706144 * pow(denominator, 1.5));
  }

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float radiusSquared = dot(point, point);
    if (radiusSquared > 1.0) discard;

    float radialDensity = exp(-radiusSquared * 3.8)
      * (1.0 - smoothstep(0.68, 1.0, sqrt(radiusSquared)));
    float opticalDepth = vOpticalDepth * radialDensity;
    float alpha = (1.0 - exp(-opticalDepth)) * vVisibility;

    const float singleScatteringAlbedo = 0.95;
    float phase = henyeyGreenstein(vCosTheta, vAnisotropy);
    float forwardLobe = smoothstep(0.35, 1.0, vCosTheta);
    float illumination = clamp(uSunStrength, 0.0, 2.5);
    vec3 regolithReflectance = uRegolithReflectance * mix(0.82, 1.13, vTone);
    float solarLuminance = dot(uSunColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 diffuseSpectrum = mix(uSunColor, vec3(solarLuminance), 0.16);
    vec3 diffuseIrradiance = diffuseSpectrum * sqrt(illumination) * 0.29;
    vec3 directIrradiance = uSunColor
      * illumination
      * singleScatteringAlbedo
      * (0.27 + phase * (1.55 + uSunGlow * forwardLobe * 0.2));
    float selfShadow = exp(-opticalDepth * 5.0);
    vec3 color = regolithReflectance * (diffuseIrradiance + directIrradiance)
      * mix(0.48, 1.0, selfShadow);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.3));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function DustField({
  count,
  sunDirectionRef,
  sunDaylightRef,
  sunColor,
  sunGlow,
  sunStrength,
}: {
  count: number;
  sunDirectionRef: RefObject<readonly [number, number, number]>;
  sunDaylightRef: RefObject<number>;
  sunColor: string;
  sunGlow: number;
  sunStrength: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffb078') },
    uRegolithReflectance: { value: SUSPENDED_DUST_REFLECTANCE.clone() },
    uSunGlow: { value: 1 },
    uSunStrength: { value: 1 },
  }), []);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const ageOffsets = new Float32Array(count);
    const scales = new Float32Array(count);
    const layers = new Float32Array(count);
    const tones = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const angle = hash2(index + 3.1, 7.4) * Math.PI * 2;
      const radius = 1.8 + Math.sqrt(hash2(index + 8.3, 19.7)) * 29;
      const altitudeSeed = hash2(index + 11.7, 3.9);
      const layer = altitudeSeed < 0.78
        ? Math.pow(altitudeSeed / 0.78, 2.4) * 0.38
        : 0.38 + ((altitudeSeed - 0.78) / 0.22) * 0.62;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const terrainFloor = terrainHeight(x, -z) - 0.079;
      positions[index * 3] = x;
      positions[index * 3 + 1] = terrainFloor + 0.035 + Math.pow(layer, 1.7) * 4.8;
      positions[index * 3 + 2] = z;
      ageOffsets[index] = hash2(index + 29.3, 41.7);
      scales[index] = 0.065 + Math.pow(hash2(index + 71.2, 5.4), 1.85) * 0.14;
      layers[index] = layer;
      tones[index] = hash2(index + 17.9, 83.1);
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('aAgeOffset', new THREE.BufferAttribute(ageOffsets, 1));
    buffer.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    buffer.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
    buffer.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));
    return buffer;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    updateDustSolarUniforms(
      materialRef.current,
      sunDirectionRef.current,
      sunColor,
      sunGlow,
      sunStrength * sunDaylightRef.current,
    );
  }, [sunColor, sunDaylightRef, sunDirectionRef, sunGlow, sunStrength]);

  useFrame((state) => {
    if (materialRef.current) {
      const materialUniforms = materialRef.current.uniforms;
      const sunDirection = sunDirectionRef.current;
      materialUniforms.uTime.value = state.clock.elapsedTime;
      (materialUniforms.uSunDirection.value as THREE.Vector3).set(...sunDirection).normalize();
      materialUniforms.uSunStrength.value = sunStrength * sunDaylightRef.current;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={DUST_FIELD_VERTEX_SHADER}
        fragmentShader={DUST_FIELD_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
