'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';

export interface CosmicPhenomena3DProps {
  quality: Quality;
  active: boolean;
  reduceMotion: boolean;
  scrollState: { current: number };
}

type QualityProfile = {
  stars: number;
  nebulae: number;
  asteroids: number;
  accretionRings: number;
};

type StarSeed = {
  position: THREE.Vector3;
  scale: number;
  color: THREE.Color;
};

type NebulaSeed = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation: THREE.Vector3;
  color: THREE.Color;
};

type AsteroidSeed = {
  period: number;
  flightDuration: number;
  phaseOffset: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  bow: THREE.Vector3;
  scale: number;
  rotation: THREE.Vector3;
  spin: THREE.Vector3;
};

type DisposableResource = THREE.BufferGeometry | THREE.Material;

const TAU = Math.PI * 2;
const SPACE_CYCLE = 1.2;
const AUTONOMOUS_PROGRESS_PER_SECOND = 0.0024;
const NEBULA_WINDOW = 0.34;
const PHENOMENON_WINDOW = 0.22;
const OBJECT_UP = new THREE.Vector3(0, 1, 0);

const PROFILES: Record<Quality, QualityProfile> = {
  low: {
    stars: 8,
    nebulae: 5,
    asteroids: 2,
    accretionRings: 2,
  },
  medium: {
    stars: 12,
    nebulae: 5,
    asteroids: 3,
    accretionRings: 3,
  },
  high: {
    stars: 18,
    nebulae: 5,
    asteroids: 4,
    accretionRings: 4,
  },
};

const DIRECTIONAL_PLASMA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPosition;

  void main() {
    vec4 localPosition = vec4(position, 1.0);

    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif

    vec4 viewPosition = modelViewMatrix * localPosition;
    vLocalPosition = position;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const DIRECTIONAL_PLASMA_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform float uBidirectional;
  uniform vec3 uColor;
  varying vec3 vLocalPosition;

  void main() {
    float radial = length(vLocalPosition.xz);
    float core = pow(max(0.0, 1.0 - radial), 2.8);
    float trail = smoothstep(-0.98, 0.62, vLocalPosition.y)
                * (1.0 - smoothstep(0.72, 1.0, vLocalPosition.y));
    float beam = smoothstep(0.08, 0.68, abs(vLocalPosition.y))
               * (1.0 - smoothstep(0.82, 1.0, abs(vLocalPosition.y)));
    float axial = mix(trail, beam, uBidirectional);
    float striation = 0.78 + 0.22 * sin(
      vLocalPosition.y * 17.0 + vLocalPosition.x * 5.0
    );
    float alpha = uOpacity * core * axial * striation;
    gl_FragColor = vec4(uColor * (1.35 + core * 1.65), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const NEBULA_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uCycleLength;
  uniform float uWindow;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying vec3 vRayOrigin;
  varying vec3 vRayDirection;
  varying float vPhase;
  varying float vDepth;
  varying float vLifecycleFade;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vColor = vec3(0.45);
    float sourceZ = 0.0;
    vec3 localCamera = cameraPosition;
    vLifecycleFade = 1.0;

    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
      // Matrix Y stores the volume's arrival point in the long-form archive.
      // The shader turns that schedule into a depth-correct, top-to-bottom
      // world-space crossing without rewriting any instance buffers per frame.
      float arrival = instanceMatrix[3].y;
      sourceZ = instanceMatrix[3].z;
      float rawProgress = uProgress
        + uTime * ${AUTONOMOUS_PROGRESS_PER_SECOND.toFixed(4)};
      float cycleProgress = mod(rawProgress, uCycleLength);
      float cycleDelta = mod(
        cycleProgress - arrival + uCycleLength * 0.5,
        uCycleLength
      ) - uCycleLength * 0.5;
      float lifePhase = 0.5 + cycleDelta / uWindow;
      vLifecycleFade = smoothstep(0.0, 0.1, lifePhase)
        * (1.0 - smoothstep(0.9, 1.0, lifePhase));

      vec3 axisX = instanceMatrix[0].xyz;
      vec3 axisY = instanceMatrix[1].xyz;
      vec3 axisZ = instanceMatrix[2].xyz;
      float worldRadiusY = length(vec3(axisX.y, axisY.y, axisZ.y));
      float viewHalfHeight = max(16.0, (cameraPosition.z - sourceZ) * 0.36);
      float verticalExtent = viewHalfHeight + worldRadiusY * 1.02 + 5.0;
      float stagedY = mix(verticalExtent, -verticalExtent, clamp(lifePhase, 0.0, 1.0));
      localPosition.y += stagedY - arrival;

      // The nearer cloud responds more than the far cloud. This is real
      // perspective separation inside the 3D field, not a shared 2D pan.
      float depthParallax = mix(
        0.24,
        1.0,
        clamp((175.0 + sourceZ) / 135.0, 0.0, 1.0)
      );
      vec3 parallaxOffset = vec3(
        uPointer.x * 2.35 * depthParallax
          + sin(uTime * 0.026 + abs(sourceZ) * 0.019) * 0.46 * depthParallax,
        uPointer.y * 0.82 * depthParallax,
        0.0
      );
      localPosition.xyz += parallaxOffset;

      // Invert the instance's orthogonal rotation/scale analytically. This
      // puts the camera and surface into the seed sphere's object space, where
      // the fragment shader can integrate through the complete ellipsoid.
      vec3 translation = instanceMatrix[3].xyz;
      translation.y = stagedY;
      translation += parallaxOffset;
      vec3 relativeCamera = cameraPosition - translation;
      localCamera = vec3(
        dot(relativeCamera, axisX) / max(dot(axisX, axisX), 0.0001),
        dot(relativeCamera, axisY) / max(dot(axisY, axisY), 0.0001),
        dot(relativeCamera, axisZ) / max(dot(axisZ, axisZ), 0.0001)
      );
      float cycleIndex = floor(rawProgress / uCycleLength);
      vPhase = fract(
        abs(sourceZ) * 0.031
        + instanceMatrix[3].x * 0.017
        + cycleIndex * 0.6180339
      );

      // Inactive volumes stay on the GPU but outside every useful frustum.
      // At most two adjacent volumes ever incur fragment-shader work.
      if (lifePhase <= 0.0 || lifePhase >= 1.0) {
        localPosition.xyz = vec3(0.0, -1000.0, -250.0);
        vLifecycleFade = 0.0;
      }
    #endif

    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif

    vec4 viewPosition = modelViewMatrix * localPosition;
    vRayOrigin = position;
    vRayDirection = normalize(localCamera - position);
    vDepth = clamp((-sourceZ - 55.0) / 150.0, 0.0, 1.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const NEBULA_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSteps;
  uniform float uOctaves;
  uniform vec3 uColdColor;
  varying vec3 vColor;
  varying vec3 vRayOrigin;
  varying vec3 vRayDirection;
  varying float vPhase;
  varying float vDepth;
  varying float vLifecycleFade;

  float hashValue(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise3d(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hashValue(cell), hashValue(cell + vec3(1.0, 0.0, 0.0)), f.x),
        mix(
          hashValue(cell + vec3(0.0, 1.0, 0.0)),
          hashValue(cell + vec3(1.0, 1.0, 0.0)),
          f.x
        ),
        f.y
      ),
      mix(
        mix(
          hashValue(cell + vec3(0.0, 0.0, 1.0)),
          hashValue(cell + vec3(1.0, 0.0, 1.0)),
          f.x
        ),
        mix(
          hashValue(cell + vec3(0.0, 1.0, 1.0)),
          hashValue(cell + vec3(1.0, 1.0, 1.0)),
          f.x
        ),
        f.y
      ),
      f.z
    );
  }

  float nebulaFbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.58;
    for (int octave = 0; octave < 3; octave += 1) {
      if (float(octave) >= uOctaves) break;
      value += valueNoise3d(p) * amplitude;
      p = mat3(
        0.00, 0.80, 0.60,
        -0.80, 0.36, -0.48,
        -0.60, -0.48, 0.64
      ) * p * 2.03 + vec3(1.71, -2.13, 0.93);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec3 rayDirection = normalize(vRayDirection);
    // The current fragment lies on the far surface (BackSide rendering).
    // Solving the unit-sphere chord gives the exact distance through the
    // ellipsoid in object space, so the haze has real interior depth.
    float chord = max(0.0, -2.0 * dot(vRayOrigin, rayDirection));
    float silhouetteFade = smoothstep(0.08, 1.16, chord);
    float veilNoise = valueNoise3d(
      vRayOrigin * vec3(2.65, 1.72, 2.28)
        + vec3(vPhase * 4.7, -vPhase * 2.6, 1.3)
    );
    float veilMask = smoothstep(0.36, 0.72, veilNoise);
    // Reject empty projected cavities and the soft ellipsoid rim before the
    // raymarch. Most black background pixels therefore pay for one cheap
    // noise lookup instead of the complete volume integration.
    if (veilMask < 0.002 || silhouetteFade < 0.002) discard;
    float stepLength = chord / max(uSteps, 1.0);
    vec3 stepVector = rayDirection * stepLength;
    vec3 samplePosition = vRayOrigin + stepVector * 0.5;
    float accumulatedDensity = 0.0;
    float peakDensity = 0.0;
    float weightedTemperature = 0.0;
    float drift = uTime * mix(0.008, 0.014, vPhase);

    for (int stepIndex = 0; stepIndex < 12; stepIndex += 1) {
      if (float(stepIndex) >= uSteps) break;
      float interior = max(0.0, 1.0 - dot(samplePosition, samplePosition));
      vec3 domain = samplePosition * vec3(3.2, 2.4, 3.0);
      // Sampling upward makes the resulting gaseous structures advect slowly
      // downward, opposite the rising planetary procession.
      domain.y += drift;
      domain.xz += vec2(
        sin(domain.y * 0.79 + vPhase * 6.2831),
        cos(domain.x * 0.67 - vPhase * 4.1)
      ) * 0.22;
      float cloud = nebulaFbm(domain + vPhase * 3.7);
      float erosion = valueNoise3d(
        domain * 2.43 + vec3(vPhase * 5.1, -1.7, 2.9)
      );
      float sweep = samplePosition.y
        + sin(samplePosition.x * 2.2 + vPhase * 5.4) * 0.26
        + sin(samplePosition.z * 1.7 - vPhase * 3.1) * 0.18;
      float plume = 1.0 - smoothstep(0.18, 0.78, abs(sweep));
      float localDensity = smoothstep(0.47, 0.77, cloud + (erosion - 0.5) * 0.18)
                         * smoothstep(0.23, 0.64, erosion)
                         * mix(0.07, 1.0, plume)
                         * pow(interior, 0.68);
      peakDensity = max(peakDensity, localDensity);
      float density = localDensity * stepLength * 1.22;
      accumulatedDensity += (1.0 - accumulatedDensity) * density * 0.88;
      weightedTemperature += cloud * density;
      samplePosition += stepVector;
    }

    float depthFade = mix(1.0, 0.84, vDepth);
    // Peak emission preserves the turbulent structures found at individual
    // depths; the optical integral still supplies the soft volumetric body.
    float shapedDensity = pow(
      mix(accumulatedDensity, peakDensity, 0.05),
      1.12
    );
    float alpha = uOpacity
                * shapedDensity
                * veilMask
                * silhouetteFade
                * depthFade
                * vLifecycleFade;
    if (alpha < 0.0008) discard;

    float temperature = smoothstep(
      0.26,
      0.78,
      weightedTemperature / max(accumulatedDensity, 0.001)
    );
    // Every volume keeps its own thermal identity; temperature only shifts
    // the hotter knots. Near rust and far blue therefore stay perceptually
    // separable even where their densities overlap.
    vec3 color = mix(uColdColor, vColor, 0.34 + temperature * 0.66);
    color *= 1.64 + accumulatedDensity * 0.92;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const STAR_VERTEX_SHADER = /* glsl */ `
  uniform float uDrift;
  uniform float uFieldNearZ;
  uniform float uBaseHalfSpan;
  uniform float uDepthHalfSpanScale;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vec3 localNormal = normal;
    vColor = vec3(1.0);

    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
      localNormal = mat3(instanceMatrix) * localNormal;
      float sourceY = instanceMatrix[3].y;
      float sourceDepth = max(0.0, uFieldNearZ - instanceMatrix[3].z);
      // Match each depth slice's seeded Y volume. Every wrap happens well
      // outside that slice's camera frustum, while its density remains even.
      float halfSpan = uBaseHalfSpan + sourceDepth * uDepthHalfSpanScale;
      float wrappedY = mod(sourceY + uDrift + halfSpan, halfSpan * 2.0) - halfSpan;
      localPosition.y += wrappedY - sourceY;
      float parallaxWeight = mix(
        0.16,
        1.0,
        1.0 - clamp(sourceDepth / 150.0, 0.0, 1.0)
      );
      localPosition.xy += uPointer * vec2(0.72, 0.28) * parallaxWeight;
    #endif

    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif

    vec4 viewPosition = modelViewMatrix * localPosition;
    vViewNormal = normalize(normalMatrix * localNormal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const STAR_CORE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  varying vec3 vColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    float facing = max(0.0, dot(normalize(vViewNormal), vViewDirection));
    vec3 body = vColor * (0.58 + facing * 0.34);
    float softLimb = smoothstep(0.08, 0.62, facing);
    gl_FragColor = vec4(body, uOpacity * softLimb);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const STAR_GLOW_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  varying vec3 vColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    // The glow is a real sphere shell. It fades toward its silhouette, so the
    // few remaining stars stay softly astronomical rather than white pixels.
    float facing = max(0.0, dot(normalize(vViewNormal), vViewDirection));
    float glow = pow(facing, 3.4);
    gl_FragColor = vec4(vColor * 0.72, uOpacity * glow);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const PHENOMENON_SHELL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vLocalPosition = position;
    vViewNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const SUPERNOVA_REMNANT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uHotColor;
  uniform vec3 uCoolColor;
  varying vec3 vLocalPosition;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 p = normalize(vLocalPosition);
    float facing = abs(dot(normalize(vViewNormal), vViewDirection));
    float limb = 0.09 + 0.91 * pow(max(0.0, 1.0 - facing), 1.45);
    float filamentA = 0.5 + 0.5 * sin(
      p.x * 21.0 + p.y * 13.0 + sin(p.z * 9.0) * 2.8 + uTime * 0.025
    );
    float filamentB = 0.5 + 0.5 * sin(
      p.z * 25.0 - p.y * 8.0 + sin(p.x * 12.0) * 2.1 - uTime * 0.018
    );
    float shockedFilaments = smoothstep(
      0.56,
      0.91,
      filamentA * 0.58 + filamentB * 0.42
    );
    float brokenShell = 0.18 + 0.82 * smoothstep(
      0.18,
      0.73,
      0.5 + 0.5 * sin(p.x * 5.7 - p.y * 7.1 + p.z * 4.3)
    );
    float emission = limb * (0.2 + shockedFilaments * 0.8) * brokenShell;
    float alpha = uOpacity * (0.045 + emission * 0.955) * brokenShell;
    if (alpha < 0.001) discard;
    vec3 color = mix(uCoolColor, uHotColor, shockedFilaments);
    color *= 2.15 + shockedFilaments * 2.1;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const BIPOLAR_NEBULA_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uIonColor;
  uniform vec3 uDustColor;
  varying vec3 vLocalPosition;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 p = normalize(vLocalPosition);
    float facing = abs(dot(normalize(vViewNormal), vViewDirection));
    float cavityWall = 0.24 + 0.76 * pow(max(0.0, 1.0 - facing), 1.75);
    float longitude = atan(p.z, p.x);
    float ribs = 0.5 + 0.5 * sin(
      longitude * 11.0 + p.y * 7.5 + sin(p.z * 8.0) * 1.8 + uTime * 0.019
    );
    float wisps = smoothstep(0.46, 0.9, ribs);
    float polarFlow = 0.32 + 0.68 * smoothstep(0.08, 0.82, abs(p.y));
    float alpha = uOpacity
      * cavityWall
      * polarFlow
      * (0.24 + wisps * 0.76);
    if (alpha < 0.001) discard;
    vec3 color = mix(uDustColor, uIonColor, polarFlow * (0.58 + wisps * 0.42));
    color *= 2.0 + wisps * 1.9;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const disposalRegistry = new WeakMap<
  DisposableResource,
  { users: number; timer: ReturnType<typeof setTimeout> | null }
>();

function useManagedDisposal(resources: DisposableResource[]) {
  useEffect(() => {
    resources.forEach((resource) => {
      const current = disposalRegistry.get(resource);
      if (current) {
        current.users += 1;
        if (current.timer) clearTimeout(current.timer);
        current.timer = null;
      } else {
        disposalRegistry.set(resource, { users: 1, timer: null });
      }
    });

    return () => {
      resources.forEach((resource) => {
        const current = disposalRegistry.get(resource);
        if (!current) return;
        current.users -= 1;
        if (current.users > 0) return;
        current.timer = setTimeout(() => {
          const latest = disposalRegistry.get(resource);
          if (!latest || latest.users > 0) return;
          resource.dispose();
          disposalRegistry.delete(resource);
        }, 80);
      });
    };
  }, [resources]);
}

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createStarSeeds(count: number): StarSeed[] {
  const random = mulberry32(0x51a7f13d);
  const palette = ['#6d6a60', '#5d6e75', '#75614f', '#627078', '#786f61'];

  return Array.from({ length: count }, () => {
    // Only a handful of smooth stellar bodies inhabit the deep frustum. Their
    // physical radii grow with distance to preserve a restrained angular size.
    const depth = 38 + random() * 135;
    const spread = 18 + depth * 0.34;
    const x = (random() - 0.5) * spread * 2;
    const y = (random() - 0.5) * (42 + depth * 0.42) * 2;
    const z = 12 - depth;
    const angularSize = 0.00024 + random() * 0.00032;

    return {
      position: new THREE.Vector3(x, y, z),
      scale: depth * angularSize,
      color: new THREE.Color(palette[Math.floor(random() * palette.length)]),
    };
  });
}

function createNebulaSeeds(count: number): NebulaSeed[] {
  // The Y component is a cyclic arrival point, not a world-space coordinate.
  // Five distinct volumes form a restrained sequence: molecular dust, an
  // ionised cavity, a turbulent violet fan, an eroded amber cloud and a far
  // blue veil. The vertex shader moves only adjacent volumes through view.
  const seeds: NebulaSeed[] = [
    {
      position: new THREE.Vector3(-18, 0.06, -52),
      scale: new THREE.Vector3(27, 16, 15),
      rotation: new THREE.Vector3(0.16, -0.34, -0.31),
      color: new THREE.Color('#a84a2d'),
    },
    {
      position: new THREE.Vector3(24, 0.30, -104),
      scale: new THREE.Vector3(45, 27, 24),
      rotation: new THREE.Vector3(-0.12, 0.31, 0.23),
      color: new THREE.Color('#287483'),
    },
    {
      position: new THREE.Vector3(-25, 0.54, -76),
      scale: new THREE.Vector3(34, 20, 18),
      rotation: new THREE.Vector3(0.21, 0.18, -0.37),
      color: new THREE.Color('#6e416f'),
    },
    {
      position: new THREE.Vector3(28, 0.78, -136),
      scale: new THREE.Vector3(53, 30, 28),
      rotation: new THREE.Vector3(-0.18, -0.27, 0.16),
      color: new THREE.Color('#9a6339'),
    },
    {
      position: new THREE.Vector3(-9, 1.02, -178),
      scale: new THREE.Vector3(76, 43, 39),
      rotation: new THREE.Vector3(0.11, 0.36, -0.19),
      color: new THREE.Color('#345c8a'),
    },
  ];
  return seeds.slice(0, count);
}

function createRemnantGeometry(detail: number) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).normalize();
    const rippling = 1
      + Math.sin(point.x * 8.7 + point.y * 3.1) * 0.055
      + Math.sin(point.z * 11.3 - point.y * 5.2) * 0.038;
    point.multiplyScalar(rippling);
    positions.setXYZ(index, point.x, point.y, point.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function cyclicLifePhase(progress: number, arrival: number, window: number) {
  const cycleProgress = THREE.MathUtils.euclideanModulo(progress, SPACE_CYCLE);
  const delta = THREE.MathUtils.euclideanModulo(
    cycleProgress - arrival + SPACE_CYCLE * 0.5,
    SPACE_CYCLE,
  ) - SPACE_CYCLE * 0.5;
  return 0.5 + delta / window;
}

function lifecycleFade(lifePhase: number) {
  const entering = THREE.MathUtils.smoothstep(lifePhase, 0, 0.12);
  const leaving = 1 - THREE.MathUtils.smoothstep(lifePhase, 0.88, 1);
  return entering * leaving;
}

function placeScheduledPhenomenon(
  group: THREE.Group | null,
  progress: number,
  elapsed: number,
  arrival: number,
  x: number,
  z: number,
  verticalPadding: number,
  lateralScale: number,
) {
  if (!group) return 0;
  const lifePhase = cyclicLifePhase(progress, arrival, PHENOMENON_WINDOW);
  const visible = lifePhase > 0 && lifePhase < 1;
  group.visible = visible;
  if (!visible) return 0;

  const viewHalfHeight = Math.max(16, (17.5 - z) * 0.36);
  const extent = viewHalfHeight + verticalPadding;
  group.position.set(
    x * lateralScale
      + Math.sin(elapsed * 0.027 + arrival * 19) * 0.34 * lateralScale,
    THREE.MathUtils.lerp(extent, -extent, lifePhase),
    z,
  );
  return lifecycleFade(lifePhase);
}

function createAsteroidGeometry(detail: number) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);
    const irregularity = 0.80
      + Math.sin(point.x * 6.31 + point.y * 2.17) * 0.095
      + Math.sin(point.z * 8.73 - point.x * 3.11) * 0.065;
    point.normalize().multiplyScalar(irregularity);
    point.x *= 1.18;
    point.y *= 0.82;
    positions.setXYZ(index, point.x, point.y, point.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createAsteroidSeeds(count: number): AsteroidSeed[] {
  const random = mulberry32(0xa57e101d);

  return Array.from({ length: count }, (_, index) => {
    const fromLeft = index % 2 === 0;
    const startX = fromLeft ? -22 - random() * 14 : 22 + random() * 14;
    const endX = fromLeft ? 12 + random() * 20 : -12 - random() * 20;
    const period = 12.5 + index * 3.9 + random() * 4.5;
    const flightDuration = 3.1 + random() * 2.4;

    return {
      period,
      flightDuration,
      // Offsets deliberately avoid a permanent asteroid stream: most cycles
      // contain empty sky and at most one substantial foreground crossing.
      phaseOffset: index === 0 ? 0.7 : 5.5 + index * 4.7,
      start: new THREE.Vector3(startX, -20 - random() * 10, 6 - random() * 24),
      end: new THREE.Vector3(endX, 22 + random() * 14, -8 - random() * 42),
      bow: new THREE.Vector3(
        (random() - 0.5) * 6,
        2 + random() * 5,
        (random() - 0.5) * 12,
      ),
      scale: 0.12 + random() * 0.24,
      rotation: new THREE.Vector3(random() * TAU, random() * TAU, random() * TAU),
      spin: new THREE.Vector3(
        (random() - 0.5) * 1.1,
        (random() - 0.5) * 1.35,
        (random() - 0.5) * 0.9,
      ),
    };
  });
}

function placeAsteroidInstances(
  mesh: THREE.InstancedMesh,
  tailMesh: THREE.InstancedMesh,
  seeds: AsteroidSeed[],
  elapsed: number,
  dummy: THREE.Object3D,
  position: THREE.Vector3,
  direction: THREE.Vector3,
) {
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const phase = (elapsed + seed.phaseOffset) % seed.period;
    if (phase >= seed.flightDuration) {
      dummy.position.set(0, -500 - index, -200);
      dummy.scale.setScalar(0.0001);
      dummy.rotation.set(0, 0, 0);
      dummy.quaternion.identity();
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      tailMesh.setMatrixAt(index, dummy.matrix);
    } else {
      const linear = phase / seed.flightDuration;
      const eased = linear * linear * (3 - 2 * linear);
      position.lerpVectors(seed.start, seed.end, eased);
      // A gentle ballistic bow prevents the flyby from reading as a UI tween.
      position.addScaledVector(seed.bow, Math.sin(linear * Math.PI));
      dummy.position.copy(position);
      dummy.rotation.set(
        seed.rotation.x + elapsed * seed.spin.x,
        seed.rotation.y + elapsed * seed.spin.y,
        seed.rotation.z + elapsed * seed.spin.z,
      );
      const edgeFade = Math.sin(linear * Math.PI);
      dummy.scale.setScalar(seed.scale * Math.max(0.08, edgeFade));
      dummy.quaternion.setFromEuler(dummy.rotation);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      direction.copy(seed.end).sub(seed.start);
      direction.addScaledVector(seed.bow, Math.cos(linear * Math.PI) * Math.PI);
      direction.normalize();
      const tailLength = (1.55 + seed.scale * 4.2) * Math.max(0.08, edgeFade);
      dummy.position.copy(position).addScaledVector(direction, -tailLength * 0.5);
      dummy.quaternion.setFromUnitVectors(OBJECT_UP, direction);
      dummy.scale.set(
        0.18 + seed.scale * 0.22,
        tailLength / 2.4,
        0.18 + seed.scale * 0.22,
      );
      dummy.updateMatrix();
      tailMesh.setMatrixAt(index, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  tailMesh.instanceMatrix.needsUpdate = true;
}

function hideAsteroidInstances(
  mesh: THREE.InstancedMesh,
  tailMesh: THREE.InstancedMesh,
  count: number,
  dummy: THREE.Object3D,
) {
  for (let index = 0; index < count; index += 1) {
    dummy.position.set(0, -500 - index, -200);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    tailMesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  tailMesh.instanceMatrix.needsUpdate = true;
}

export default function CosmicPhenomena3D({
  quality,
  active,
  reduceMotion,
  scrollState,
}: CosmicPhenomena3DProps) {
  const profile = PROFILES[quality];
  const nebulaRef = useRef<THREE.InstancedMesh>(null);
  const starFieldRef = useRef<THREE.InstancedMesh>(null);
  const starGlowRef = useRef<THREE.InstancedMesh>(null);
  const asteroidRef = useRef<THREE.InstancedMesh>(null);
  const asteroidTailRef = useRef<THREE.InstancedMesh>(null);
  const accretionRef = useRef<THREE.Group>(null);
  const accretionRingsRef = useRef<THREE.InstancedMesh>(null);
  const pulsarRef = useRef<THREE.Group>(null);
  const supernovaRef = useRef<THREE.Group>(null);
  const bipolarNebulaRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workPosition = useMemo(() => new THREE.Vector3(), []);
  const workDirection = useMemo(() => new THREE.Vector3(), []);
  const nebulaSeeds = useMemo(
    () => createNebulaSeeds(profile.nebulae),
    [profile.nebulae],
  );
  const starSeeds = useMemo(() => createStarSeeds(profile.stars), [profile.stars]);
  const asteroidSeeds = useMemo(
    () => createAsteroidSeeds(profile.asteroids),
    [profile.asteroids],
  );

  const nebulaGeometry = useMemo(
    () => new THREE.SphereGeometry(
      1,
      quality === 'high' ? 28 : quality === 'medium' ? 22 : 16,
      quality === 'high' ? 18 : quality === 'medium' ? 14 : 10,
    ),
    [quality],
  );
  const starGeometry = useMemo(
    () => new THREE.SphereGeometry(1, 8, 6),
    [],
  );
  const bodyGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(1, quality === 'low' ? 1 : 2),
    [quality],
  );
  const asteroidGeometry = useMemo(
    () => createAsteroidGeometry(quality === 'high' ? 2 : 1),
    [quality],
  );
  const asteroidTailGeometry = useMemo(
    () => new THREE.SphereGeometry(
      1,
      quality === 'high' ? 12 : 8,
      quality === 'high' ? 8 : 6,
    ),
    [quality],
  );
  const accretionGeometry = useMemo(
    () => new THREE.TorusGeometry(
      1,
      0.11,
      quality === 'low' ? 6 : 9,
      quality === 'high' ? 48 : quality === 'medium' ? 36 : 24,
    ),
    [quality],
  );
  const pulsarBeamGeometry = useMemo(
    () => new THREE.SphereGeometry(
      1,
      quality === 'high' ? 14 : 10,
      quality === 'high' ? 10 : 7,
    ),
    [quality],
  );
  const supernovaGeometry = useMemo(
    () => createRemnantGeometry(quality === 'high' ? 3 : quality === 'medium' ? 2 : 1),
    [quality],
  );
  const bipolarLobeGeometry = useMemo(
    () => new THREE.SphereGeometry(
      1,
      quality === 'high' ? 20 : quality === 'medium' ? 16 : 12,
      quality === 'high' ? 14 : quality === 'medium' ? 11 : 8,
    ),
    [quality],
  );

  const nebulaMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'DistantProceduralNebulaVolumes',
    vertexShader: NEBULA_VERTEX_SHADER,
    fragmentShader: NEBULA_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uCycleLength: { value: SPACE_CYCLE },
      uWindow: { value: NEBULA_WINDOW },
      uPointer: { value: new THREE.Vector2() },
      uOpacity: {
        value: quality === 'high' ? 1.28 : quality === 'medium' ? 1.06 : 0.88,
      },
      // Two FBM octaves plus the independent erosion field retain the broad
      // gaseous structure while cutting the former worst-case noise work by
      // roughly forty percent on large, fill-rate-bound canvases.
      uSteps: { value: quality === 'high' ? 8 : quality === 'medium' ? 6 : 4 },
      uOctaves: { value: 2 },
      uColdColor: { value: new THREE.Color('#173a4d') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    // Ionised gas emits into the otherwise black field. Additive energy keeps
    // low-density pockets luminous instead of turning them into grey smudges.
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  }), [quality]);
  const starCoreMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'SubtlePhysicalStellarBodies',
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_CORE_FRAGMENT_SHADER,
    uniforms: {
      uDrift: { value: 0 },
      uFieldNearZ: { value: 12 },
      uBaseHalfSpan: { value: 42 },
      uDepthHalfSpanScale: { value: 0.42 },
      uPointer: { value: new THREE.Vector2() },
      uOpacity: { value: 0.32 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
  }), []);
  const starGlowMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'SubtlePhysicalStellarAtmospheres',
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_GLOW_FRAGMENT_SHADER,
    uniforms: {
      uDrift: { value: 0 },
      uFieldNearZ: { value: 12 },
      uBaseHalfSpan: { value: 42 },
      uDepthHalfSpanScale: { value: 0.42 },
      uPointer: { value: new THREE.Vector2() },
      uOpacity: { value: 0.055 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
  }), []);
  const asteroidMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'IrregularFlybyAsteroids',
    color: '#5a514a',
    roughness: 0.98,
    metalness: 0.025,
    emissive: '#080706',
    emissiveIntensity: 0.22,
  }), []);
  const asteroidTailMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'DirectionalMeteorPlasmaWake',
    vertexShader: DIRECTIONAL_PLASMA_VERTEX_SHADER,
    fragmentShader: DIRECTIONAL_PLASMA_FRAGMENT_SHADER,
    uniforms: {
      uOpacity: { value: quality === 'low' ? 0.045 : 0.068 },
      uBidirectional: { value: 0 },
      uColor: { value: new THREE.Color('#b78d6d') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [quality]);
  const blackHoleMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'BlackHoleEventHorizon',
    color: '#000000',
  }), []);
  const accretionMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'DistantVolumetricAccretionBands',
    color: '#a27655',
    transparent: true,
    opacity: quality === 'low' ? 0.065 : 0.098,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  }), [quality]);
  const photonRingMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'BlackHolePhotonTorus',
    color: '#c2976b',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  }), []);
  const pulsarMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'DistantPulsar',
    color: '#c7d7e5',
    toneMapped: false,
  }), []);
  const pulsarBeamMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'PulsarDirectionalPlasmaBeam',
    vertexShader: DIRECTIONAL_PLASMA_VERTEX_SHADER,
    fragmentShader: DIRECTIONAL_PLASMA_FRAGMENT_SHADER,
    uniforms: {
      uOpacity: { value: quality === 'low' ? 0.24 : 0.34 },
      uBidirectional: { value: 1 },
      uColor: { value: new THREE.Color('#9bc9df') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [quality]);
  const supernovaMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'ThreeDimensionalSupernovaEjectaShell',
    vertexShader: PHENOMENON_SHELL_VERTEX_SHADER,
    fragmentShader: SUPERNOVA_REMNANT_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uHotColor: { value: new THREE.Color('#c77a45') },
      uCoolColor: { value: new THREE.Color('#426d86') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const bipolarNebulaMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'ThreeDimensionalBipolarIonisedLobes',
    vertexShader: PHENOMENON_SHELL_VERTEX_SHADER,
    fragmentShader: BIPOLAR_NEBULA_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uIonColor: { value: new THREE.Color('#64c7d7') },
      uDustColor: { value: new THREE.Color('#b16d4e') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const planetaryWaistMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'BipolarNebulaDustWaist',
    color: '#aa7959',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const planetaryCoreMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'BipolarNebulaCentralWhiteDwarf',
    color: '#d9edf1',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), []);

  const resources = useMemo<DisposableResource[]>(() => [
    nebulaGeometry,
    nebulaMaterial,
    starGeometry,
    bodyGeometry,
    asteroidGeometry,
    asteroidTailGeometry,
    accretionGeometry,
    pulsarBeamGeometry,
    supernovaGeometry,
    bipolarLobeGeometry,
    starCoreMaterial,
    starGlowMaterial,
    asteroidMaterial,
    asteroidTailMaterial,
    blackHoleMaterial,
    accretionMaterial,
    photonRingMaterial,
    pulsarMaterial,
    pulsarBeamMaterial,
    supernovaMaterial,
    bipolarNebulaMaterial,
    planetaryWaistMaterial,
    planetaryCoreMaterial,
  ], [
    accretionGeometry,
    accretionMaterial,
    asteroidGeometry,
    asteroidMaterial,
    asteroidTailGeometry,
    asteroidTailMaterial,
    blackHoleMaterial,
    bipolarLobeGeometry,
    bipolarNebulaMaterial,
    bodyGeometry,
    nebulaGeometry,
    nebulaMaterial,
    photonRingMaterial,
    planetaryCoreMaterial,
    planetaryWaistMaterial,
    pulsarBeamGeometry,
    pulsarBeamMaterial,
    pulsarMaterial,
    supernovaGeometry,
    supernovaMaterial,
    starGeometry,
    starCoreMaterial,
    starGlowMaterial,
  ]);
  useManagedDisposal(resources);

  useLayoutEffect(() => {
    const nebula = nebulaRef.current;
    if (!nebula) return;
    nebulaSeeds.forEach((seed, index) => {
      dummy.position.copy(seed.position);
      dummy.rotation.set(seed.rotation.x, seed.rotation.y, seed.rotation.z);
      dummy.scale.copy(seed.scale);
      dummy.updateMatrix();
      nebula.setMatrixAt(index, dummy.matrix);
      nebula.setColorAt(index, seed.color);
    });
    nebula.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    nebula.instanceMatrix.needsUpdate = true;
    if (nebula.instanceColor) nebula.instanceColor.needsUpdate = true;
  }, [dummy, nebulaSeeds]);

  useLayoutEffect(() => {
    const core = starFieldRef.current;
    const glow = starGlowRef.current;
    if (!core || !glow) return;
    starSeeds.forEach((star, index) => {
      dummy.position.copy(star.position);
      dummy.rotation.set(index * 0.31, index * 0.47, index * 0.19);
      dummy.scale.setScalar(star.scale);
      dummy.updateMatrix();
      core.setMatrixAt(index, dummy.matrix);
      core.setColorAt(index, star.color);
      dummy.scale.setScalar(star.scale * 3.2);
      dummy.updateMatrix();
      glow.setMatrixAt(index, dummy.matrix);
      glow.setColorAt(index, star.color);
    });
    core.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    glow.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    core.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
  }, [dummy, starSeeds]);

  useLayoutEffect(() => {
    const rings = accretionRingsRef.current;
    if (!rings) return;
    for (let index = 0; index < profile.accretionRings; index += 1) {
      const radius = 1.25 + index * 0.28;
      dummy.position.set(0, 0, (index - profile.accretionRings * 0.5) * 0.018);
      dummy.rotation.set(0, 0, index * 0.37);
      dummy.scale.set(radius, radius * (0.96 + (index % 2) * 0.04), 1);
      dummy.updateMatrix();
      rings.setMatrixAt(index, dummy.matrix);
    }
    rings.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rings.instanceMatrix.needsUpdate = true;
  }, [dummy, profile.accretionRings]);

  useLayoutEffect(() => {
    if (asteroidRef.current && asteroidTailRef.current) {
      if (reduceMotion) {
        hideAsteroidInstances(
          asteroidRef.current,
          asteroidTailRef.current,
          asteroidSeeds.length,
          dummy,
        );
      } else {
        placeAsteroidInstances(
          asteroidRef.current,
          asteroidTailRef.current,
          asteroidSeeds,
          elapsedRef.current,
          dummy,
          workPosition,
          workDirection,
        );
      }
      asteroidRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      asteroidTailRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, [
    asteroidSeeds,
    dummy,
    reduceMotion,
    workDirection,
    workPosition,
  ]);

  useLayoutEffect(() => {
    const instances = [
      nebulaRef.current,
      starFieldRef.current,
      starGlowRef.current,
      asteroidRef.current,
      asteroidTailRef.current,
      accretionRingsRef.current,
    ];
    return () => {
      // `dispose={null}` leaves resource ownership with this component. Retire
      // InstancedMesh's private matrix/color buffers explicitly as well; the
      // layout initialisers above repopulate them during React Strict Mode's
      // development-only setup/cleanup replay.
      instances.forEach((instance) => instance?.dispose());
    };
  }, [quality]);

  useFrame((state, delta) => {
    if (!active) return;
    const safeDelta = Math.min(delta, 1 / 20);
    if (!reduceMotion) elapsedRef.current += safeDelta;
    const elapsed = elapsedRef.current;
    const scrollProgress = THREE.MathUtils.clamp(scrollState.current, 0, 1);
    const stagedProgress = scrollProgress
      + elapsed * AUTONOMOUS_PROGRESS_PER_SECOND;
    const lateralScale = THREE.MathUtils.clamp(
      (state.size.width / Math.max(1, state.size.height)) / 1.55,
      0.3,
      1,
    );

    // Scroll moves every deep layer down while the helix-bound solar system
    // rises. Depth-aware shader wrapping keeps the sparse stars bounded, while
    // scheduled volumes enter from above and retire below the camera.
    const starDrift = -(scrollProgress * 56 + elapsed * 0.22);
    starCoreMaterial.uniforms.uDrift.value = starDrift;
    starGlowMaterial.uniforms.uDrift.value = starDrift;
    nebulaMaterial.uniforms.uTime.value = elapsed;
    nebulaMaterial.uniforms.uProgress.value = scrollProgress;
    supernovaMaterial.uniforms.uTime.value = elapsed;
    bipolarNebulaMaterial.uniforms.uTime.value = elapsed;

    if (!reduceMotion) {
      const pointerAlpha = Math.min(1, safeDelta * 2.2);
      const nebulaPointer = nebulaMaterial.uniforms.uPointer.value as THREE.Vector2;
      nebulaPointer.x += (state.pointer.x - nebulaPointer.x) * pointerAlpha;
      nebulaPointer.y += (state.pointer.y - nebulaPointer.y) * pointerAlpha;
      const starPointer = starCoreMaterial.uniforms.uPointer.value as THREE.Vector2;
      starPointer.copy(nebulaPointer);
      (starGlowMaterial.uniforms.uPointer.value as THREE.Vector2).copy(nebulaPointer);
    }

    if (starFieldRef.current) {
      // Perspective supplies the depth parallax; the tiny lateral sway keeps
      // the field atmospheric without turning it into visual snow.
      const starSway = Math.sin(elapsed * 0.041) * 0.04;
      starFieldRef.current.position.x = starSway;
      if (starGlowRef.current) starGlowRef.current.position.x = starSway;
    }
    if (!reduceMotion && asteroidRef.current && asteroidTailRef.current) {
      placeAsteroidInstances(
        asteroidRef.current,
        asteroidTailRef.current,
        asteroidSeeds,
        elapsed + scrollProgress * 18,
        dummy,
        workPosition,
        workDirection,
      );
    }
    placeScheduledPhenomenon(
      pulsarRef.current,
      stagedProgress,
      elapsed,
      0.20,
      -36,
      -68,
      7,
      lateralScale,
    );
    const supernovaFade = placeScheduledPhenomenon(
      supernovaRef.current,
      stagedProgress,
      elapsed,
      0.50,
      55,
      -112,
      10,
      lateralScale,
    );
    placeScheduledPhenomenon(
      accretionRef.current,
      stagedProgress,
      elapsed,
      0.64,
      -34,
      -64,
      8,
      lateralScale,
    );
    const bipolarFade = placeScheduledPhenomenon(
      bipolarNebulaRef.current,
      stagedProgress,
      elapsed,
      0.93,
      48,
      -102,
      13,
      lateralScale,
    );

    supernovaMaterial.uniforms.uOpacity.value = supernovaFade
      * (quality === 'low' ? 0.24 : 0.34);
    bipolarNebulaMaterial.uniforms.uOpacity.value = bipolarFade
      * (quality === 'low' ? 0.32 : 0.46);
    planetaryWaistMaterial.opacity = bipolarFade * 0.16;
    planetaryCoreMaterial.opacity = bipolarFade * 0.82;

    if (!reduceMotion && accretionRef.current?.visible) {
      accretionRef.current.rotation.z += safeDelta * 0.026;
    }
    if (!reduceMotion && pulsarRef.current?.visible) {
      pulsarRef.current.rotation.x = 0.28 + Math.sin(elapsed * 0.09) * 0.13;
      pulsarRef.current.rotation.z += safeDelta * 0.18;
    }
    if (!reduceMotion && supernovaRef.current?.visible) {
      supernovaRef.current.rotation.x = 0.18 + Math.sin(elapsed * 0.021) * 0.08;
      supernovaRef.current.rotation.y += safeDelta * 0.014;
      supernovaRef.current.rotation.z -= safeDelta * 0.009;
    }
    if (!reduceMotion && bipolarNebulaRef.current?.visible) {
      bipolarNebulaRef.current.rotation.y += safeDelta * 0.011;
      bipolarNebulaRef.current.rotation.z = -0.34 + Math.sin(elapsed * 0.018) * 0.07;
    }
  });

  return (
    <group dispose={null} name="physical-deep-space-phenomena">
      <instancedMesh
        ref={nebulaRef}
        args={[nebulaGeometry, nebulaMaterial, profile.nebulae]}
        frustumCulled={false}
        renderOrder={-60}
        name="depth-separated-three-dimensional-nebula-volumes"
      />

      <instancedMesh
        ref={starFieldRef}
        args={[starGeometry, starCoreMaterial, profile.stars]}
        frustumCulled={false}
        renderOrder={-20}
        name="sparse-subtle-stellar-bodies"
      />
      <instancedMesh
        ref={starGlowRef}
        args={[starGeometry, starGlowMaterial, profile.stars]}
        frustumCulled={false}
        renderOrder={-21}
        name="sparse-three-dimensional-stellar-atmospheres"
      />

      <instancedMesh
        ref={asteroidRef}
        args={[asteroidGeometry, asteroidMaterial, profile.asteroids]}
        frustumCulled={false}
        name="intermittent-three-dimensional-asteroid-flybys"
      />
      <instancedMesh
        ref={asteroidTailRef}
        args={[asteroidTailGeometry, asteroidTailMaterial, profile.asteroids]}
        frustumCulled={false}
        renderOrder={-2}
        name="intermittent-three-dimensional-meteor-wakes"
      />

      <group
        ref={accretionRef}
        position={[-34, 0, -64]}
        rotation={[1.18, -0.24, 0.18]}
        scale={2.05}
        visible={false}
        name="distant-black-hole-system"
      >
        <mesh geometry={bodyGeometry} material={blackHoleMaterial} scale={1.16} />
        <instancedMesh
          ref={accretionRingsRef}
          args={[accretionGeometry, accretionMaterial, profile.accretionRings]}
          frustumCulled={false}
        />
        <mesh geometry={accretionGeometry} material={photonRingMaterial} scale={1.32} />
      </group>

      <group
        ref={pulsarRef}
        position={[-36, 0, -68]}
        rotation={[0.28, 0.14, -0.36]}
        scale={1.45}
        visible={false}
        name="distant-pulsar"
      >
        <mesh
          geometry={starGeometry}
          material={starGlowMaterial}
          scale={0.82}
          renderOrder={-7}
        />
        <mesh geometry={bodyGeometry} material={pulsarMaterial} scale={0.22} />
        <mesh
          geometry={pulsarBeamGeometry}
          material={pulsarBeamMaterial}
          scale={[0.34, 6.8, 0.34]}
        />
      </group>

      <group
        ref={supernovaRef}
        position={[55, 0, -112]}
        rotation={[0.18, -0.26, 0.14]}
        visible={false}
        name="expanding-three-dimensional-supernova-remnant"
      >
        <mesh
          geometry={supernovaGeometry}
          material={supernovaMaterial}
          scale={[6.4, 5.75, 6.05]}
          renderOrder={-12}
        />
        <mesh
          geometry={supernovaGeometry}
          material={supernovaMaterial}
          rotation={[0.31, -0.42, 0.18]}
          scale={[4.85, 4.4, 4.65]}
          renderOrder={-13}
        />
      </group>

      <group
        ref={bipolarNebulaRef}
        position={[48, 0, -102]}
        rotation={[0.13, 0.31, -0.34]}
        visible={false}
        name="three-dimensional-bipolar-planetary-nebula"
      >
        <mesh
          geometry={bipolarLobeGeometry}
          material={bipolarNebulaMaterial}
          position={[0, 3.05, 0]}
          rotation={[0.12, 0.22, 0.06]}
          scale={[3.05, 5.7, 2.65]}
          renderOrder={-10}
        />
        <mesh
          geometry={bipolarLobeGeometry}
          material={bipolarNebulaMaterial}
          position={[0, -3.05, 0]}
          rotation={[-0.14, -0.18, -0.08]}
          scale={[2.9, 5.55, 2.55]}
          renderOrder={-10}
        />
        <mesh
          geometry={accretionGeometry}
          material={planetaryWaistMaterial}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[2.45, 2.45, 1]}
          renderOrder={-9}
        />
        <mesh
          geometry={bodyGeometry}
          material={planetaryCoreMaterial}
          scale={0.19}
          renderOrder={-8}
        />
      </group>
    </group>
  );
}
