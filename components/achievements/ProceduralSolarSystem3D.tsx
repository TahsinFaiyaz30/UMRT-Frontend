'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';

export interface ProceduralSolarSystem3DProps {
  quality: Quality;
  active: boolean;
  reduceMotion: boolean;
  topY: number;
  bottomY: number;
}

type PlanetDefinition = {
  name: string;
  kind: number;
  radius: number;
  colors: [string, string, string];
  roughness: number;
  specular: number;
  relief: number;
  axialTilt: number;
  rotationSpeed: number;
  orbitSpeed: number;
  eccentricity: number;
  longitude: number;
  initialAnomaly: number;
  atmosphere?: { color: string; density: number; scale: number };
  clouds?: { color: string; coverage: number; opacity: number; scale: number; speed: number };
  rings?: { color: string; opacity: number; tilt: number };
  moons: MoonDefinition[];
};

type MoonDefinition = {
  radius: number;
  distance: number;
  speed: number;
  inclination: number;
  phase: number;
  tint?: string;
};

type PlanetLayout = {
  rowY: number;
  flowPhase: number;
  flowRadius: number;
  flowDepthRadius: number;
  lateralRadius: number;
  depthRadius: number;
  basePosition: [number, number, number];
};

type DisposableResource = THREE.BufferGeometry | THREE.Material;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const SYSTEM_Z = -1.2;
const OUTER_RING_RADIUS = 2.08;
const LOCAL_ORBIT_SPEED_SCALE = 3.2;
const PREFERRED_SYSTEM_SCALE = 1.22;

/*
 * Astronomical periods are still used for each body's small local revolution,
 * while this shared scene-scale flow is intentionally time-compressed. Every
 * body advances through the same angular field, with its phase derived from
 * its serial row. The result is one rotating solar-system helix rather than a
 * collection of unrelated wobbles, and it is legible within a few seconds.
 */
const FLOW_ANGULAR_SPEED = 0.46;
const FLOW_INITIAL_PHASE = -Math.PI * 0.5;
const FLOW_ROW_PHASE_STEP = 0.88;
const SUN_FLOW_RADIUS = 0.82;
const SUN_FLOW_DEPTH_RADIUS = 0.34;
const SYSTEM_TRAVEL_Y = 0.7;
const SYSTEM_TRAVEL_Z = 1.05;
const SYSTEM_TRAVEL_X = 0.18;

/*
 * The proportions are deliberately compressed so every body remains legible
 * inside the gallery. Axial tilts, rotation direction, eccentricity ordering,
 * atmospheric character, and relative revolution speeds retain the important
 * physical relationships of the real solar system.
 */
const PLANETS: PlanetDefinition[] = [
  {
    name: 'Mercury', kind: 0, radius: 0.39, colors: ['#4b4741', '#8d877d', '#c4b9a8'],
    roughness: 0.96, specular: 0.06, relief: 0.018, axialTilt: 0.034 * DEG,
    rotationSpeed: 0.035, orbitSpeed: 0.026, eccentricity: 0.206, longitude: 0.15,
    initialAnomaly: -0.16, atmosphere: { color: '#b9a991', density: 0.035, scale: 1.018 }, moons: [],
  },
  {
    name: 'Venus', kind: 1, radius: 0.63, colors: ['#7a3e18', '#d68d34', '#ffe0a1'],
    roughness: 0.72, specular: 0.1, relief: 0.004, axialTilt: 177.4 * DEG,
    rotationSpeed: -0.022, orbitSpeed: 0.019, eccentricity: 0.007, longitude: 0.8,
    initialAnomaly: 0.11, atmosphere: { color: '#f6a84c', density: 0.38, scale: 1.075 },
    clouds: { color: '#ffe3a1', coverage: 0.28, opacity: 0.58, scale: 1.025, speed: -0.04 }, moons: [],
  },
  {
    name: 'Earth', kind: 2, radius: 0.67, colors: ['#071e43', '#1667a8', '#4f7b3e'],
    roughness: 0.58, specular: 0.46, relief: 0.006, axialTilt: 23.44 * DEG,
    rotationSpeed: 0.18, orbitSpeed: 0.0155, eccentricity: 0.017, longitude: 1.5,
    initialAnomaly: -0.07, atmosphere: { color: '#4ba6ff', density: 0.5, scale: 1.06 },
    clouds: { color: '#ffffff', coverage: 0.56, opacity: 0.74, scale: 1.018, speed: 0.23 },
    moons: [{ radius: 0.18, distance: 1.55, speed: 0.34, inclination: 5.1 * DEG, phase: 0.7 }],
  },
  {
    name: 'Mars', kind: 3, radius: 0.51, colors: ['#38130b', '#9b321a', '#e27745'],
    roughness: 0.91, specular: 0.08, relief: 0.014, axialTilt: 25.19 * DEG,
    rotationSpeed: 0.174, orbitSpeed: 0.0126, eccentricity: 0.093, longitude: 2.3,
    initialAnomaly: 0.14, atmosphere: { color: '#d7683c', density: 0.12, scale: 1.045 },
    clouds: { color: '#eab18e', coverage: 0.72, opacity: 0.16, scale: 1.014, speed: 0.12 },
    moons: [
      { radius: 0.075, distance: 1.42, speed: 0.72, inclination: 1.1 * DEG, phase: 1.4 },
      { radius: 0.055, distance: 1.78, speed: 0.38, inclination: 1.8 * DEG, phase: 3.2 },
    ],
  },
  {
    name: 'Jupiter', kind: 4, radius: 1.38, colors: ['#4f2d21', '#c58d60', '#f1d3a5'],
    roughness: 0.68, specular: 0.11, relief: 0.002, axialTilt: 3.13 * DEG,
    rotationSpeed: 0.43, orbitSpeed: 0.0068, eccentricity: 0.049, longitude: 2.95,
    initialAnomaly: -0.1, atmosphere: { color: '#d3a87e', density: 0.16, scale: 1.035 },
    clouds: { color: '#fff0d2', coverage: 0.43, opacity: 0.27, scale: 1.012, speed: 0.5 },
    moons: [
      { radius: 0.12, distance: 1.42, speed: 0.62, inclination: 0.04 * DEG, phase: 0.2, tint: '#d0a56a' },
      { radius: 0.11, distance: 1.7, speed: 0.43, inclination: 0.47 * DEG, phase: 1.9, tint: '#e6ded1' },
      { radius: 0.17, distance: 2.02, speed: 0.31, inclination: 0.2 * DEG, phase: 3.7, tint: '#8f8273' },
      { radius: 0.15, distance: 2.36, speed: 0.22, inclination: 0.28 * DEG, phase: 5.1, tint: '#6b5e55' },
    ],
  },
  {
    name: 'Saturn', kind: 5, radius: 1.17, colors: ['#706047', '#c9af79', '#f0dfad'],
    roughness: 0.74, specular: 0.09, relief: 0.001, axialTilt: 26.73 * DEG,
    rotationSpeed: 0.39, orbitSpeed: 0.0051, eccentricity: 0.057, longitude: 3.7,
    initialAnomaly: 0.08, atmosphere: { color: '#e7ce9a', density: 0.13, scale: 1.035 },
    clouds: { color: '#fff1c8', coverage: 0.38, opacity: 0.2, scale: 1.01, speed: 0.44 },
    rings: { color: '#d8c69d', opacity: 0.66, tilt: 0 },
    moons: [
      { radius: 0.12, distance: 2.35, speed: 0.25, inclination: 0.3 * DEG, phase: 1.1, tint: '#d4b37f' },
      { radius: 0.08, distance: 1.62, speed: 0.5, inclination: 0.02 * DEG, phase: 3.0, tint: '#e3ded2' },
      { radius: 0.07, distance: 1.86, speed: 0.39, inclination: 0.01 * DEG, phase: 4.3, tint: '#b7b2a6' },
    ],
  },
  {
    name: 'Uranus', kind: 6, radius: 0.89, colors: ['#27636d', '#75bdc4', '#c9f0e9'],
    roughness: 0.54, specular: 0.17, relief: 0.001, axialTilt: 97.77 * DEG,
    rotationSpeed: -0.24, orbitSpeed: 0.0036, eccentricity: 0.046, longitude: 4.45,
    initialAnomaly: -0.12, atmosphere: { color: '#70e1e1', density: 0.24, scale: 1.055 },
    clouds: { color: '#d7ffff', coverage: 0.31, opacity: 0.12, scale: 1.012, speed: -0.28 },
    rings: { color: '#93a7a2', opacity: 0.27, tilt: 0 },
    moons: [
      { radius: 0.08, distance: 1.58, speed: 0.32, inclination: 4.3 * DEG, phase: 0.6, tint: '#a6a09a' },
      { radius: 0.075, distance: 1.87, speed: 0.24, inclination: 0.1 * DEG, phase: 3.6, tint: '#cbc4b9' },
    ],
  },
  {
    name: 'Neptune', kind: 7, radius: 0.86, colors: ['#061e62', '#1253b6', '#5fa4ff'],
    roughness: 0.5, specular: 0.19, relief: 0.001, axialTilt: 28.32 * DEG,
    rotationSpeed: 0.27, orbitSpeed: 0.0029, eccentricity: 0.011, longitude: 5.2,
    initialAnomaly: 0.06, atmosphere: { color: '#2879ff', density: 0.34, scale: 1.06 },
    clouds: { color: '#bcdcff', coverage: 0.52, opacity: 0.18, scale: 1.013, speed: 0.33 },
    moons: [{ radius: 0.1, distance: 1.72, speed: -0.28, inclination: 157 * DEG, phase: 2.2, tint: '#c5c1b4' }],
  },
];

/*
 * A row reserves the complete vertical sweep of everything attached to the
 * planet, not merely the photosphere. This includes atmospheric shells,
 * oblique rings and the highest point reached by every moon orbit. Keeping
 * these envelopes disjoint makes overlap impossible even when Saturn's rings,
 * Uranus' near-vertical ring plane, and Neptune's retrograde Triton analogue
 * are all animated at once.
 */
function getPlanetVerticalEnvelope(definition: PlanetDefinition) {
  const shellScale = Math.max(
    1,
    definition.atmosphere?.scale ?? 1,
    definition.clouds?.scale ?? 1,
  );
  let envelope = definition.radius * shellScale;

  if (definition.rings) {
    const ringInclination = Math.min(
      1,
      Math.abs(Math.sin(definition.axialTilt)) + Math.abs(Math.sin(definition.rings.tilt)),
    );
    const ringSweep = definition.radius * (
      OUTER_RING_RADIUS * ringInclination + 0.025
    );
    envelope = Math.max(envelope, ringSweep);
  }

  definition.moons.forEach((moon) => {
    const moonSweep = definition.radius * (
      moon.distance * Math.abs(Math.sin(moon.inclination)) + moon.radius
    );
    envelope = Math.max(envelope, moonSweep);
  });

  return envelope + 0.035;
}

const PLANET_VERTICAL_ENVELOPES = PLANETS.map(getPlanetVerticalEnvelope);
const PLANET_VERTICAL_ENVELOPE_TOTAL = PLANET_VERTICAL_ENVELOPES.reduce(
  (total, envelope) => total + envelope,
  0,
);

const SURFACE_VERTEX_SHADER = /* glsl */ `
  uniform float uRelief;
  uniform float uSeed;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float reliefNoise(vec3 p) {
    float a = sin(dot(p, vec3(11.3, 17.1, 7.7)) + uSeed * 5.1);
    float b = sin(dot(p, vec3(31.7, -13.4, 23.9)) - uSeed * 3.7);
    float c = sin(dot(p, vec3(-53.1, 47.3, 19.2)) + uSeed * 8.3);
    return (a + b * .5 + c * .25) / 1.75;
  }

  void main() {
    vec3 unitPosition = normalize(position);
    vec3 displaced = position + normal * reliefNoise(unitPosition) * uRelief;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vLocalPosition = normalize(displaced);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float result = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      result += amplitude * valueNoise(p);
      p = p * 2.03 + vec3(5.2, 1.3, 7.1);
      amplitude *= 0.48;
    }
    return result;
  }
`;

const SURFACE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uKind;
  uniform float uSeed;
  uniform float uRoughness;
  uniform float uSpecular;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uSunPosition;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  ${NOISE_GLSL}

  vec3 surfaceColor(vec3 p) {
    float n = fbm(p * 3.0 + uSeed * 2.7);
    float detail = fbm(p * 10.0 - uSeed * 4.3);
    vec3 color = mix(uColorA, uColorB, smoothstep(.2, .72, n));

    if (uKind < .5) {
      float crater = smoothstep(.73, .86, detail) * (1.0 - smoothstep(.86, .94, detail));
      color = mix(color, uColorC, smoothstep(.56, .92, detail) * .42);
      color *= 1.0 - crater * .42;
    } else if (uKind < 1.5) {
      float sulfur = fbm(vec3(p.x * 4.0, p.y * 13.0, p.z * 4.0) + uTime * .006);
      color = mix(uColorB, uColorC, smoothstep(.32, .78, sulfur));
      color *= .78 + detail * .24;
    } else if (uKind < 2.5) {
      float continent = fbm(p * 2.65 + vec3(2.4, -1.2, 5.7));
      float coast = smoothstep(.48, .56, continent + p.y * .035);
      float forest = fbm(p * 8.0 + 11.0);
      vec3 ocean = mix(uColorA, uColorB, .34 + .42 * detail);
      vec3 land = mix(uColorC * .54, uColorC * 1.25, forest);
      color = mix(ocean, land, coast);
      float ice = smoothstep(.78, .94, abs(p.y) + fbm(p * 6.0) * .08);
      color = mix(color, vec3(.88, .94, .97), ice);
    } else if (uKind < 3.5) {
      float highlands = fbm(p * 5.4 + 9.0);
      float dust = fbm(vec3(p.x * 10.0, p.y * 4.0, p.z * 10.0));
      color = mix(uColorA, uColorC, smoothstep(.25, .8, highlands));
      color = mix(color, uColorB, dust * .32);
      float cap = smoothstep(.84, .96, abs(p.y) + detail * .035);
      color = mix(color, vec3(.9, .82, .72), cap);
    } else if (uKind < 4.5) {
      float latitude = p.y * 35.0 + fbm(p * 4.0) * 5.0;
      float bands = sin(latitude) * .5 + .5;
      color = mix(uColorA, uColorC, smoothstep(.12, .9, bands));
      color = mix(color, uColorB, smoothstep(.58, .76, fbm(p * 9.0)) * .35);
      vec2 stormP = vec2(atan(p.z, p.x) - .55, p.y + .2);
      float storm = 1.0 - smoothstep(.055, .12, length(stormP * vec2(.42, 1.0)));
      color = mix(color, vec3(.73, .22, .1), storm * smoothstep(0.0, 1.0, -p.z));
    } else if (uKind < 5.5) {
      float bands = sin(p.y * 48.0 + fbm(p * 5.0) * 2.8) * .5 + .5;
      color = mix(uColorA, uColorC, .24 + bands * .58);
      color *= .9 + fbm(p * 8.0) * .17;
    } else if (uKind < 6.5) {
      float bands = sin(p.y * 32.0 + fbm(p * 3.0) * 1.5) * .5 + .5;
      color = mix(uColorA, uColorC, .35 + bands * .27);
    } else {
      float bands = sin(p.y * 26.0 + fbm(p * 5.0) * 4.0) * .5 + .5;
      float storm = smoothstep(.67, .83, fbm(p * 11.0 + vec3(5.0, 2.0, 1.0)));
      color = mix(uColorA, uColorC, .24 + bands * .52);
      color = mix(color, vec3(.72, .86, 1.0), storm * .38);
    }
    return max(color, vec3(0.0));
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 toSun = uSunPosition - vWorldPosition;
    float sunDistance = max(length(toSun), .001);
    vec3 lightDirection = toSun / sunDistance;
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float diffuse = max(dot(normal, lightDirection), 0.0);
    // Compressed scene units, physically shaped inverse-square irradiance.
    // The constant represents stellar power after scaling astronomical
    // distances into the vertical gallery.
    float attenuation = clamp(1100.0 / (12.56637 * sunDistance * sunDistance), .04, 1.35);
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float shininess = mix(9.0, 100.0, 1.0 - uRoughness);
    float specular = pow(max(dot(normal, halfDirection), 0.0), shininess) * uSpecular;
    float nightRim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0) * .025;
    vec3 albedo = surfaceColor(normalize(vLocalPosition));
    vec3 lit = albedo * (.035 + diffuse * attenuation * 1.08);
    lit += vec3(1.0, .82, .62) * specular * diffuse * attenuation;
    lit += albedo * nightRim;
    gl_FragColor = vec4(lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SHELL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vLocalPosition = normalize(position);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunPosition;
  uniform float uDensity;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(uSunPosition - vWorldPosition);
    float limb = pow(1.0 - abs(dot(normal, viewDirection)), 2.15);
    float day = smoothstep(-.32, .78, dot(normal, lightDirection));
    float forwardScatter = pow(max(dot(viewDirection, -lightDirection), 0.0), 8.0);
    float alpha = limb * uDensity * (.28 + day * .72) + forwardScatter * uDensity * .14;
    vec3 color = uColor * (1.05 + day * .55);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, .88));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uCoverage;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uSunPosition;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  ${NOISE_GLSL}
  void main() {
    vec3 p = normalize(vLocalPosition);
    float warp = fbm(p * 4.0 + vec3(uTime * .012, 0.0, -uTime * .008) + uSeed);
    float clouds = fbm(vec3(p.x * 7.0, p.y * 15.0, p.z * 7.0) + warp * 2.2);
    float mask = smoothstep(uCoverage, min(.98, uCoverage + .16), clouds);
    vec3 normal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(uSunPosition - vWorldPosition);
    float day = .14 + max(dot(normal, lightDirection), 0.0) * .92;
    float grazing = pow(1.0 - max(dot(normal, normalize(cameraPosition - vWorldPosition)), 0.0), 2.0);
    float alpha = mask * uOpacity * (1.0 - grazing * .24);
    if (alpha < .012) discard;
    gl_FragColor = vec4(uColor * day, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SUN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocalPosition;
  ${NOISE_GLSL}
  void main() {
    vec3 p = normalize(vLocalPosition);
    float cells = fbm(p * 7.0 + vec3(uTime * .018, -uTime * .011, uTime * .014));
    float granules = fbm(p * 24.0 - vec3(uTime * .025));
    float filaments = sin((p.y + cells * .2) * 46.0 + uTime * .18) * .5 + .5;
    vec3 deep = vec3(1.5, .12, .005);
    vec3 orange = vec3(3.0, .52, .025);
    vec3 yellow = vec3(4.4, 1.65, .25);
    vec3 color = mix(deep, orange, smoothstep(.16, .72, cells));
    color = mix(color, yellow, smoothstep(.52, .92, granules) * .68 + filaments * .12);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CORONA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFrequency;
  varying vec3 vLocalPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  ${NOISE_GLSL}
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float limb = pow(1.0 - abs(dot(normal, viewDirection)), 1.7);
    float plasma = fbm(normalize(vLocalPosition) * uFrequency + vec3(uTime * .025, -uTime * .018, 0.0));
    float alpha = limb * uOpacity * (.42 + plasma * .9);
    gl_FragColor = vec4(uColor * (1.0 + plasma * 1.3), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const MOON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSunPosition;
  uniform vec3 uTint;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  ${NOISE_GLSL}
  void main() {
    vec3 normal = normalize(vWorldNormal);
    float terrain = fbm(normalize(vLocalPosition) * 9.0);
    float pits = smoothstep(.7, .84, fbm(normalize(vLocalPosition) * 22.0));
    vec3 albedo = uTint * (.42 + terrain * .62 - pits * .25);
    float light = max(dot(normal, normalize(uSunPosition - vWorldPosition)), 0.0);
    gl_FragColor = vec4(albedo * (.045 + light * .96), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec3 vRingPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vRingPosition = position;
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunPosition;
  uniform vec3 uPlanetPosition;
  uniform float uPlanetRadius;
  uniform float uRingKind;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vRingPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float band(float radius, float center, float halfWidth, float feather) {
    return 1.0 - smoothstep(
      max(0.0, halfWidth - feather),
      halfWidth,
      abs(radius - center)
    );
  }

  float saturnDensity(float radius) {
    // Broad C, B and A rings separated by the Cassini Division, plus the
    // tenuous F ring. Fine striae suggest countless independently orbiting
    // particles without allocating thousands of meshes.
    float cRing = band(radius, .115, .105, .025) * .24;
    float bRing = band(radius, .385, .205, .018) * .96;
    float aRing = band(radius, .765, .165, .015) * .68;
    float fRing = band(radius, .968, .012, .005) * .22;
    float density = max(max(cRing, bRing), max(aRing, fRing));
    float cassiniDivision = band(radius, .585, .038, .007);
    float enckeGap = band(radius, .817, .007, .0025);
    density *= 1.0 - cassiniDivision * .97;
    density *= 1.0 - enckeGap * .83;
    float striae = sin(radius * 690.0 + sin(radius * 83.0) * 2.1) * .5 + .5;
    return density * (.72 + striae * .28);
  }

  float uranusDensity(float radius) {
    // Uranus has a much darker, sparser system of narrow bands embedded in a
    // nearly invisible dust sheet.
    float density = band(radius, .11, .018, .008) * .25;
    density = max(density, band(radius, .265, .014, .006) * .38);
    density = max(density, band(radius, .405, .022, .008) * .46);
    density = max(density, band(radius, .56, .014, .006) * .34);
    density = max(density, band(radius, .715, .027, .009) * .55);
    density = max(density, band(radius, .855, .016, .006) * .42);
    density = max(density, band(radius, .942, .028, .009) * .72);
    float dust = band(radius, .52, .46, .06) * .028;
    return max(density, dust);
  }

  float planetOcclusion(vec3 lightDirection) {
    vec3 originFromCenter = vWorldPosition - uPlanetPosition;
    float projected = dot(originFromCenter, lightDirection);
    float discriminant = projected * projected
      - (dot(originFromCenter, originFromCenter) - uPlanetRadius * uPlanetRadius);
    if (discriminant <= 0.0) return 1.0;
    float nearHit = -projected - sqrt(discriminant);
    return nearHit > 0.0 ? .12 : 1.0;
  }

  void main() {
    const float INNER_RADIUS = 1.22;
    const float OUTER_RADIUS = 2.08;
    float normalizedRadius = clamp(
      (length(vRingPosition.xz) - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS),
      0.0,
      1.0
    );
    float density = uRingKind < .5
      ? saturnDensity(normalizedRadius)
      : uranusDensity(normalizedRadius);

    float azimuth = atan(vRingPosition.z, vRingPosition.x);
    float differentialDrift = azimuth
      + uTime * mix(.065, .018, normalizedRadius);
    float clumps = sin(differentialDrift * 37.0 + normalizedRadius * 211.0) * .5 + .5;
    float grain = hash21(vec2(
      floor(normalizedRadius * 720.0),
      floor((differentialDrift + 3.14159265) * 96.0)
    ));
    density *= .7 + clumps * .12 + grain * .24;
    if (density < .008) discard;

    vec3 normal = normalize(vWorldNormal);
    vec3 toSun = uSunPosition - vWorldPosition;
    float sunDistance = max(length(toSun), .001);
    vec3 lightDirection = toSun / sunDistance;
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float incidence = abs(dot(normal, lightDirection));
    float attenuation = clamp(1100.0 / (12.56637 * sunDistance * sunDistance), .04, 1.2);
    float shadow = planetOcclusion(lightDirection);
    float forwardScatter = pow(max(dot(viewDirection, -lightDirection), 0.0), 9.0);
    float backScatter = pow(max(dot(viewDirection, lightDirection), 0.0), 12.0);
    float radialTone = .82 + sin(normalizedRadius * 52.0 + uRingKind * 1.7) * .09;
    if (uRingKind > .5) radialTone *= .64;
    vec3 albedo = uColor * radialTone;
    vec3 lit = albedo * (.028 + incidence * attenuation * shadow * .94);
    lit += albedo * attenuation * (forwardScatter * .22 + backScatter * .08);
    float viewFacing = abs(dot(normal, viewDirection));
    float alpha = density * uOpacity * mix(1.0, .72, viewFacing);
    gl_FragColor = vec4(lit, clamp(alpha, 0.0, .82));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeAnnularRingGeometry(quality: Quality) {
  const angularSegments = quality === 'high' ? 160 : quality === 'medium' ? 112 : 72;
  const radialSegments = quality === 'high' ? 28 : quality === 'medium' ? 20 : 12;
  const innerRadius = 1.22;
  const outerRadius = OUTER_RING_RADIUS;
  const halfThickness = quality === 'low' ? 0.009 : 0.012;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
  };

  // Separately indexed upper and lower faces retain correct normals and a
  // genuine, albeit very thin, ring volume at grazing camera angles.
  [1, -1].forEach((normalY) => {
    const offset = positions.length / 3;
    for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex += 1) {
      const radialProgress = radialIndex / radialSegments;
      const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, radialProgress);
      for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex += 1) {
        const angularProgress = angularIndex / angularSegments;
        const angle = angularProgress * TAU;
        pushVertex(
          Math.cos(angle) * radius,
          normalY * halfThickness,
          Math.sin(angle) * radius,
          0,
          normalY,
          0,
          radialProgress,
          angularProgress,
        );
      }
    }

    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      for (let angularIndex = 0; angularIndex < angularSegments; angularIndex += 1) {
        const rowWidth = angularSegments + 1;
        const a = offset + radialIndex * rowWidth + angularIndex;
        const b = a + rowWidth;
        const c = b + 1;
        const d = a + 1;
        if (normalY > 0) indices.push(a, c, b, a, d, c);
        else indices.push(a, b, c, a, c, d);
      }
    }
  });

  [
    { radius: innerRadius, normalSign: -1 },
    { radius: outerRadius, normalSign: 1 },
  ].forEach(({ radius, normalSign }) => {
    const offset = positions.length / 3;
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex += 1) {
      const angularProgress = angularIndex / angularSegments;
      const angle = angularProgress * TAU;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      pushVertex(
        cosine * radius,
        -halfThickness,
        sine * radius,
        cosine * normalSign,
        0,
        sine * normalSign,
        normalSign > 0 ? 1 : 0,
        angularProgress,
      );
      pushVertex(
        cosine * radius,
        halfThickness,
        sine * radius,
        cosine * normalSign,
        0,
        sine * normalSign,
        normalSign > 0 ? 1 : 0,
        angularProgress,
      );
    }

    for (let angularIndex = 0; angularIndex < angularSegments; angularIndex += 1) {
      const a = offset + angularIndex * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      if (normalSign > 0) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.name = 'ProceduralParticulateAnnularRingVolume';
  return geometry;
}

const disposalRegistry = new WeakMap<DisposableResource, { users: number; timer: ReturnType<typeof setTimeout> | null }>();

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

function makeSurfaceMaterial(definition: PlanetDefinition) {
  return new THREE.ShaderMaterial({
    name: `${definition.name}ProceduralSurface`,
    vertexShader: SURFACE_VERTEX_SHADER,
    fragmentShader: SURFACE_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uKind: { value: definition.kind },
      uSeed: { value: definition.kind * 1.731 + 0.41 },
      uColorA: { value: new THREE.Color(definition.colors[0]) },
      uColorB: { value: new THREE.Color(definition.colors[1]) },
      uColorC: { value: new THREE.Color(definition.colors[2]) },
      uRoughness: { value: definition.roughness },
      uSpecular: { value: definition.specular },
      uRelief: { value: definition.relief },
      uSunPosition: { value: new THREE.Vector3() },
    },
  });
}

function makeAtmosphereMaterial(definition: PlanetDefinition) {
  const atmosphere = definition.atmosphere;
  if (!atmosphere) return null;
  return new THREE.ShaderMaterial({
    name: `${definition.name}VolumetricAtmosphere`,
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: new THREE.Color(atmosphere.color) },
      uDensity: { value: atmosphere.density },
      uSunPosition: { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeCloudMaterial(definition: PlanetDefinition) {
  const clouds = definition.clouds;
  if (!clouds) return null;
  return new THREE.ShaderMaterial({
    name: `${definition.name}ProceduralCloudDeck`,
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: definition.kind * 2.13 + 0.8 },
      uCoverage: { value: clouds.coverage },
      uOpacity: { value: clouds.opacity },
      uColor: { value: new THREE.Color(clouds.color) },
      uSunPosition: { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite: false,
  });
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    eccentricAnomaly -= (
      eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly
    ) / (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function localOrbitPosition(
  definition: PlanetDefinition,
  layout: Pick<
    PlanetLayout,
    'rowY' | 'flowPhase' | 'flowRadius' | 'flowDepthRadius' | 'lateralRadius' | 'depthRadius'
  >,
  elapsed: number,
): [number, number, number] {
  const meanAnomaly = definition.initialAnomaly
    + elapsed * definition.orbitSpeed * LOCAL_ORBIT_SPEED_SCALE;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, definition.eccentricity);
  const radial = Math.cos(eccentricAnomaly) - definition.eccentricity;
  const transverse = Math.sqrt(1 - definition.eccentricity ** 2) * Math.sin(eccentricAnomaly);
  const orbitX = radial * layout.lateralRadius;
  const orbitZ = transverse * layout.depthRadius;
  const cosLongitude = Math.cos(definition.longitude);
  const sinLongitude = Math.sin(definition.longitude);
  const flowAngle = FLOW_INITIAL_PHASE
    + elapsed * FLOW_ANGULAR_SPEED
    + layout.flowPhase;

  return [
    Math.cos(flowAngle) * layout.flowRadius
      + orbitX * cosLongitude
      - orbitZ * sinLongitude,
    layout.rowY,
    SYSTEM_Z
      + Math.sin(flowAngle) * layout.flowDepthRadius
      + orbitX * sinLongitude
      + orbitZ * cosLongitude,
  ];
}

function sunFlowPosition(sunY: number, elapsed: number): [number, number, number] {
  const flowAngle = FLOW_INITIAL_PHASE + elapsed * FLOW_ANGULAR_SPEED;
  return [
    Math.cos(flowAngle) * SUN_FLOW_RADIUS,
    sunY,
    SYSTEM_Z + Math.sin(flowAngle) * SUN_FLOW_DEPTH_RADIUS,
  ];
}

function RingSystem({
  definition,
  geometry,
  material,
}: {
  definition: PlanetDefinition;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
}) {
  const rings = definition.rings;
  if (!rings) return null;
  return (
    <group rotation={[rings.tilt, 0, 0]}>
      <mesh
        geometry={geometry}
        material={material}
        renderOrder={4}
      />
    </group>
  );
}

function PlanetMesh({
  definition,
  index,
  quality,
  sphereGeometry,
  moonGeometry,
  ringGeometry,
  surfaceMaterial,
  atmosphereMaterial,
  cloudMaterial,
  moonMaterial,
  ringMaterial,
  layout,
  visualScale,
  setPlanetRef,
  setSurfaceRef,
  setCloudRef,
  setMoonRef,
}: {
  definition: PlanetDefinition;
  index: number;
  quality: Quality;
  sphereGeometry: THREE.SphereGeometry;
  moonGeometry: THREE.SphereGeometry;
  ringGeometry: THREE.BufferGeometry;
  surfaceMaterial: THREE.ShaderMaterial;
  atmosphereMaterial: THREE.ShaderMaterial | null;
  cloudMaterial: THREE.ShaderMaterial | null;
  moonMaterial: THREE.ShaderMaterial;
  ringMaterial: THREE.ShaderMaterial | null;
  layout: PlanetLayout;
  visualScale: number;
  setPlanetRef: (index: number, node: THREE.Group | null) => void;
  setSurfaceRef: (index: number, node: THREE.Mesh | null) => void;
  setCloudRef: (index: number, node: THREE.Mesh | null) => void;
  setMoonRef: (key: string, node: THREE.Group | null) => void;
}) {
  const moonLimit = quality === 'high' ? definition.moons.length : quality === 'medium'
    ? Math.min(2, definition.moons.length)
    : Math.min(index === 2 || index >= 4 ? 1 : 0, definition.moons.length);
  const visibleMoons = definition.moons.slice(0, moonLimit);

  return (
    <group
      ref={(node) => setPlanetRef(index, node)}
      position={layout.basePosition}
      scale={visualScale}
      name={`${definition.name}-orbital-body`}
    >
      <group rotation={[0, 0, definition.axialTilt]} scale={definition.radius}>
        <mesh ref={(node) => setSurfaceRef(index, node)} geometry={sphereGeometry} material={surfaceMaterial} />
        {cloudMaterial && definition.clouds ? (
          <mesh
            ref={(node) => setCloudRef(index, node)}
            geometry={sphereGeometry}
            material={cloudMaterial}
            scale={definition.clouds.scale}
            renderOrder={2}
          />
        ) : null}
        {atmosphereMaterial && definition.atmosphere ? (
          <mesh
            geometry={sphereGeometry}
            material={atmosphereMaterial}
            scale={definition.atmosphere.scale}
            renderOrder={3}
          />
        ) : null}
        {ringMaterial ? (
          <RingSystem definition={definition} geometry={ringGeometry} material={ringMaterial} />
        ) : null}
      </group>

      {visibleMoons.map((moon, moonIndex) => {
        const key = `${index}:${moonIndex}`;
        return (
          <group
            key={key}
            ref={(node) => setMoonRef(key, node)}
            rotation={[moon.inclination, moon.phase, 0]}
          >
            <mesh
              geometry={moonGeometry}
              material={moonMaterial}
              position={[moon.distance * definition.radius, 0, 0]}
              scale={moon.radius * definition.radius}
              onBeforeRender={(_renderer, _scene, _camera, _geometry, material) => {
                const shader = material as THREE.ShaderMaterial;
                (shader.uniforms.uTint.value as THREE.Color).set(moon.tint ?? '#aaa49a');
              }}
            />
          </group>
        );
      })}
    </group>
  );
}

export default function ProceduralSolarSystem3D({
  quality,
  active,
  reduceMotion,
  topY,
  bottomY,
}: ProceduralSolarSystem3DProps) {
  const systemFlowRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Group>(null);
  const sunSurfaceRef = useRef<THREE.Mesh>(null);
  const planetRefs = useRef<Array<THREE.Group | null>>([]);
  const surfaceRefs = useRef<Array<THREE.Mesh | null>>([]);
  const cloudRefs = useRef<Array<THREE.Mesh | null>>([]);
  const moonRefs = useRef(new Map<string, THREE.Group>());
  const elapsedRef = useRef(0);
  const worldSunPosition = useMemo(() => new THREE.Vector3(), []);
  const worldPlanetPosition = useMemo(() => new THREE.Vector3(), []);
  const worldPlanetScale = useMemo(() => new THREE.Vector3(), []);
  const flowWorldOffset = useMemo(() => new THREE.Vector3(), []);
  const inverseParentQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const baseSunRadius = quality === 'low' ? 1.72 : quality === 'medium' ? 1.94 : 2.12;
  const verticalSpan = Math.max(0.1, topY - bottomY);
  const reservedRowGap = Math.min(0.32, verticalSpan / (PLANETS.length * 4));
  const naturalSunEnvelope = baseSunRadius * 1.27;
  const naturalSystemDepth = naturalSunEnvelope + PLANET_VERTICAL_ENVELOPE_TOTAL * 2;
  const scaleDenominator = Math.max(0.01, naturalSystemDepth - baseSunRadius * 0.58);
  const systemScale = Math.min(
    PREFERRED_SYSTEM_SCALE,
    Math.max(
      0.01,
      (verticalSpan - reservedRowGap * PLANETS.length) / scaleDenominator,
    ),
  );
  const sunRadius = baseSunRadius * systemScale;
  const sunY = topY + sunRadius * 0.58;
  const sunEnvelope = naturalSunEnvelope * systemScale;
  const planetEnvelopeTotal = PLANET_VERTICAL_ENVELOPE_TOTAL * systemScale;
  const rowGap = Math.max(
    0,
    (sunY - bottomY - sunEnvelope - planetEnvelopeTotal * 2) / PLANETS.length,
  );

  const sphereWidthSegments = quality === 'high' ? 64 : quality === 'medium' ? 48 : 30;
  const sphereHeightSegments = quality === 'high' ? 40 : quality === 'medium' ? 30 : 18;
  const moonWidthSegments = quality === 'high' ? 20 : quality === 'medium' ? 16 : 10;
  const moonHeightSegments = quality === 'high' ? 14 : quality === 'medium' ? 10 : 7;
  const sphereGeometry = useMemo(
    () => new THREE.SphereGeometry(1, sphereWidthSegments, sphereHeightSegments),
    [sphereHeightSegments, sphereWidthSegments],
  );
  const moonGeometry = useMemo(
    () => new THREE.SphereGeometry(1, moonWidthSegments, moonHeightSegments),
    [moonHeightSegments, moonWidthSegments],
  );
  const ringGeometry = useMemo(
    () => makeAnnularRingGeometry(quality),
    [quality],
  );
  const prominenceGeometry = useMemo(
    () => new THREE.TorusGeometry(1.06, 0.028, quality === 'high' ? 8 : 6, quality === 'high' ? 64 : quality === 'medium' ? 44 : 28, Math.PI * 1.28),
    [quality],
  );

  const surfaceMaterials = useMemo(() => PLANETS.map(makeSurfaceMaterial), []);
  const atmosphereMaterials = useMemo(() => PLANETS.map(makeAtmosphereMaterial), []);
  const cloudMaterials = useMemo(() => PLANETS.map(makeCloudMaterial), []);
  const sunMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'ProceduralSolarPhotosphere',
    vertexShader: SURFACE_VERTEX_SHADER,
    fragmentShader: SUN_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uRelief: { value: quality === 'low' ? 0.003 : 0.008 },
      uSeed: { value: 9.4 },
    },
  }), [quality]);
  const coronaMaterials = useMemo(() => [
    { scale: 1.055, opacity: 0.25, color: '#ff771f', frequency: 8 },
    { scale: 1.12, opacity: 0.12, color: '#ff9c3a', frequency: 5 },
    { scale: 1.24, opacity: 0.055, color: '#ffd080', frequency: 3 },
  ].slice(0, quality === 'low' ? 1 : quality === 'medium' ? 2 : 3).map((layer, index) => ({
    ...layer,
    material: new THREE.ShaderMaterial({
      name: `SolarCoronaLayer${index}`,
      vertexShader: SHELL_VERTEX_SHADER,
      fragmentShader: CORONA_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(layer.color) },
        uOpacity: { value: layer.opacity },
        uFrequency: { value: layer.frequency },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  })), [quality]);
  const prominenceMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    name: 'SolarProminencePlasma',
    color: '#c92c0c',
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const moonMaterial = useMemo(() => new THREE.ShaderMaterial({
    name: 'ProceduralSatelliteSurface',
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: MOON_FRAGMENT_SHADER,
    uniforms: {
      uSunPosition: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Color('#aaa49a') },
    },
  }), []);
  const ringMaterials = useMemo(() => PLANETS.map((definition) => {
    if (!definition.rings) return null;
    return new THREE.ShaderMaterial({
      name: `${definition.name}ParticulateRingVolume`,
      vertexShader: RING_VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(definition.rings.color) },
        uOpacity: { value: definition.rings.opacity },
        uSunPosition: { value: new THREE.Vector3() },
        uPlanetPosition: { value: new THREE.Vector3() },
        uPlanetRadius: { value: 1 },
        uRingKind: { value: definition.kind === 5 ? 0 : 1 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }), []);

  const layouts = useMemo<PlanetLayout[]>(() => {
    let lowerEdge = sunY - sunEnvelope;

    return PLANETS.map((definition, index) => {
      const envelope = PLANET_VERTICAL_ENVELOPES[index] * systemScale;
      const rowY = lowerEdge - rowGap - envelope;
      const layout = {
        rowY,
        flowPhase: (index + 1) * FLOW_ROW_PHASE_STEP,
        flowRadius: 1.34 + (index % 3) * 0.16,
        flowDepthRadius: 0.38 + ((index + 1) % 3) * 0.055,
        lateralRadius: 0.28 + (index % 3) * 0.065,
        depthRadius: 0.13 + ((index + 1) % 3) * 0.035,
      };
      lowerEdge = rowY - envelope;

      return {
        ...layout,
        basePosition: localOrbitPosition(definition, layout, 0),
      };
    });
  }, [rowGap, sunEnvelope, sunY, systemScale]);

  const disposableResources = useMemo<DisposableResource[]>(() => [
    sphereGeometry,
    moonGeometry,
    ringGeometry,
    prominenceGeometry,
    ...surfaceMaterials,
    ...atmosphereMaterials.filter((material): material is THREE.ShaderMaterial => material !== null),
    ...cloudMaterials.filter((material): material is THREE.ShaderMaterial => material !== null),
    sunMaterial,
    ...coronaMaterials.map((entry) => entry.material),
    prominenceMaterial,
    moonMaterial,
    ...ringMaterials.filter((material): material is THREE.ShaderMaterial => material !== null),
  ], [
    atmosphereMaterials,
    cloudMaterials,
    coronaMaterials,
    moonGeometry,
    moonMaterial,
    prominenceGeometry,
    prominenceMaterial,
    ringGeometry,
    ringMaterials,
    sphereGeometry,
    sunMaterial,
    surfaceMaterials,
  ]);
  useManagedDisposal(disposableResources);

  useFrame((_state, delta) => {
    const shouldAnimate = active && !reduceMotion;
    const safeDelta = shouldAnimate ? Math.min(delta, 1 / 20) : 0;
    if (shouldAnimate) elapsedRef.current += safeDelta;
    const elapsed = elapsedRef.current;
    const travelPhase = elapsed * FLOW_ANGULAR_SPEED;

    /*
     * Camera-facing directional loop: its near half always rises and its
     * return half falls farther from the camera. It therefore reads as a
     * continuous upward migration without an unbounded offset or a visible
     * teleport. The offset is converted into the rotating helix parent's
     * local coordinates so scroll rotation cannot reverse that depth cue.
     */
    const flowRoot = systemFlowRef.current;
    if (flowRoot) {
      flowWorldOffset.set(
        Math.sin(travelPhase * 2) * SYSTEM_TRAVEL_X,
        Math.sin(travelPhase) * SYSTEM_TRAVEL_Y,
        Math.cos(travelPhase) * SYSTEM_TRAVEL_Z,
      );
      const parent = flowRoot.parent;
      if (parent) {
        parent.getWorldQuaternion(inverseParentQuaternion).invert();
        flowWorldOffset.applyQuaternion(inverseParentQuaternion);
        // Keep the corkscrew aligned with the camera/world axis while the
        // surrounding achievement-card helix rotates on scroll.
        flowRoot.quaternion.copy(inverseParentQuaternion);
      }
      flowRoot.position.copy(flowWorldOffset);
    }

    if (sunRef.current) {
      sunRef.current.position.set(...sunFlowPosition(sunY, elapsed));
    }

    PLANETS.forEach((definition, index) => {
      const group = planetRefs.current[index];
      const surface = surfaceRefs.current[index];
      const cloud = cloudRefs.current[index];
      if (group) group.position.set(...localOrbitPosition(definition, layouts[index], elapsed));

      if (shouldAnimate) {
        if (surface) surface.rotation.y += safeDelta * definition.rotationSpeed;
        if (cloud && definition.clouds) cloud.rotation.y += safeDelta * definition.clouds.speed;
        definition.moons.forEach((moon, moonIndex) => {
          const pivot = moonRefs.current.get(`${index}:${moonIndex}`);
          if (pivot) pivot.rotation.y += safeDelta * moon.speed;
        });
      }

      surfaceMaterials[index].uniforms.uTime.value = elapsed;
      if (cloudMaterials[index]) cloudMaterials[index]!.uniforms.uTime.value = elapsed;
    });

    if (shouldAnimate && sunSurfaceRef.current) {
      sunSurfaceRef.current.rotation.y += safeDelta * 0.026;
    }
    sunMaterial.uniforms.uTime.value = elapsed;
    coronaMaterials.forEach((entry, index) => {
      entry.material.uniforms.uTime.value = elapsed * (1 + index * 0.17);
    });

    if (sunRef.current) sunRef.current.getWorldPosition(worldSunPosition);
    surfaceMaterials.forEach((material) => material.uniforms.uSunPosition.value.copy(worldSunPosition));
    atmosphereMaterials.forEach((material) => material?.uniforms.uSunPosition.value.copy(worldSunPosition));
    cloudMaterials.forEach((material) => material?.uniforms.uSunPosition.value.copy(worldSunPosition));
    ringMaterials.forEach((material, index) => {
      if (!material) return;
      material.uniforms.uSunPosition.value.copy(worldSunPosition);
      material.uniforms.uTime.value = elapsed;
      const planet = planetRefs.current[index];
      if (!planet) return;
      planet.getWorldPosition(worldPlanetPosition);
      planet.getWorldScale(worldPlanetScale);
      material.uniforms.uPlanetPosition.value.copy(worldPlanetPosition);
      material.uniforms.uPlanetRadius.value = PLANETS[index].radius * Math.max(
        Math.abs(worldPlanetScale.x),
        Math.abs(worldPlanetScale.y),
        Math.abs(worldPlanetScale.z),
      );
    });
    moonMaterial.uniforms.uSunPosition.value.copy(worldSunPosition);
  });

  const setPlanetRef = (index: number, node: THREE.Group | null) => {
    planetRefs.current[index] = node;
  };
  const setSurfaceRef = (index: number, node: THREE.Mesh | null) => {
    surfaceRefs.current[index] = node;
  };
  const setCloudRef = (index: number, node: THREE.Mesh | null) => {
    cloudRefs.current[index] = node;
  };
  const setMoonRef = (key: string, node: THREE.Group | null) => {
    if (node) moonRefs.current.set(key, node);
    else moonRefs.current.delete(key);
  };

  const prominenceCount = quality === 'high' ? 5 : quality === 'medium' ? 3 : 2;

  return (
    <group
      ref={systemFlowRef}
      dispose={null}
      position={[0, 0, SYSTEM_TRAVEL_Z]}
      name="procedural-three-dimensional-solar-system"
    >
      <group ref={sunRef} position={sunFlowPosition(sunY, 0)} scale={sunRadius} name="Sun">
        <pointLight
          color="#ffd0a0"
          intensity={quality === 'low' ? 9000 : 16000}
          decay={2}
          distance={0}
        />
        <mesh ref={sunSurfaceRef} geometry={sphereGeometry} material={sunMaterial} />
        {coronaMaterials.map((entry, index) => (
          <mesh
            key={index}
            geometry={sphereGeometry}
            material={entry.material}
            scale={entry.scale}
            renderOrder={5 + index}
          />
        ))}
        {Array.from({ length: prominenceCount }, (_, index) => (
          <mesh
            key={index}
            geometry={prominenceGeometry}
            material={prominenceMaterial}
            position={[
              Math.cos(index * 2.39) * 0.78,
              Math.sin(index * 1.73) * 0.58,
              Math.sin(index * 2.81) * 0.3,
            ]}
            rotation={[index * 1.07, index * 2.03, index * 0.67]}
            scale={0.23 + (index % 3) * 0.035}
            renderOrder={9}
          />
        ))}
      </group>

      {PLANETS.map((definition, index) => (
        <PlanetMesh
          key={definition.name}
          definition={definition}
          index={index}
          quality={quality}
          sphereGeometry={sphereGeometry}
          moonGeometry={moonGeometry}
          ringGeometry={ringGeometry}
          surfaceMaterial={surfaceMaterials[index]}
          atmosphereMaterial={atmosphereMaterials[index]}
          cloudMaterial={cloudMaterials[index]}
          moonMaterial={moonMaterial}
          ringMaterial={ringMaterials[index]}
          layout={layouts[index]}
          visualScale={systemScale}
          setPlanetRef={setPlanetRef}
          setSurfaceRef={setSurfaceRef}
          setCloudRef={setCloudRef}
          setMoonRef={setMoonRef}
        />
      ))}
    </group>
  );
}
