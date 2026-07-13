'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';

type CelestialBackdropProps = {
  quality: Quality;
  sunDirection: readonly [number, number, number];
  sunColor: string;
  reduceMotion?: boolean;
};

type Star = {
  position: THREE.Vector3;
  scale: number;
  color: THREE.Color;
};

// Set along the opening camera's upper-left sightline, not in camera space.
// It remains a real world-space body (and therefore moves correctly with the
// scroll orbit) while entering the hero at roughly a half-degree apparent
// diameter instead of sitting outside the initial vertical frustum.
const PLANET_POSITION: [number, number, number] = [-64, 8, -64];

/** Deterministic PRNG so the sky does not rearrange itself after remounting. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function starCountFor(quality: Quality) {
  if (quality === 'low') return 96;
  if (quality === 'medium') return 164;
  return 268;
}

function createStars(quality: Quality): Star[] {
  const random = mulberry32(0x4d415253);
  const count = starCountFor(quality);
  const warm = new THREE.Color('#ffd7ad');
  const neutral = new THREE.Color('#fff4df');
  const cool = new THREE.Color('#c9dcff');

  return Array.from({ length: count }, () => {
    // Uniform sampling in Y creates an even solid-angle distribution over the
    // useful sky dome. The small negative margin lets a few stars reach the
    // horizon while the terrain naturally occludes everything below it.
    const y = THREE.MathUtils.lerp(-0.12, 0.94, random());
    const azimuth = random() * Math.PI * 2;
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * horizontal,
      y,
      Math.sin(azimuth) * horizontal,
    );

    // Three separated ranges create genuine translational parallax rather
    // than moving a flat star texture with the camera.
    const depthBand = Math.floor(random() * 3);
    const radius = depthBand === 0
      ? THREE.MathUtils.lerp(76, 91, random())
      : depthBand === 1
        ? THREE.MathUtils.lerp(108, 126, random())
        : THREE.MathUtils.lerp(146, 168, random());
    const luminosity = Math.pow(random(), 5.2);
    const angularRadius = THREE.MathUtils.lerp(0.00017, 0.00034, random())
      + luminosity * 0.00034;
    const temperature = random();
    const color = temperature < 0.16
      ? warm.clone()
      : temperature > 0.84
        ? cool.clone()
        : neutral.clone();

    // Most stars remain sub-pixel point sources. Only the rare high-luminosity
    // samples grow enough to resolve as tiny spheres at a desktop render DPR.
    color.multiplyScalar(THREE.MathUtils.lerp(0.48, 0.86, random()) + luminosity * 0.28);
    return {
      position: direction.multiplyScalar(radius),
      scale: radius * angularRadius,
      color,
    };
  });
}

function SparseStarDome({ quality }: { quality: Quality }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const stars = useMemo(() => createStars(quality), [quality]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();

    stars.forEach((star, index) => {
      transform.position.copy(star.position);
      transform.scale.setScalar(star.scale);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, star.color);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [stars]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, stars.length]}
      frustumCulled={false}
      renderOrder={-24}
      name="procedural-star-dome"
    >
      <icosahedronGeometry args={[1, quality === 'high' ? 1 : 0]} />
      <meshBasicMaterial
        color="#ffffff"
        fog={false}
        toneMapped={false}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

const PLANET_VERTEX_SHADER = `
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vObjectNormal = normalize(normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const PLANET_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  float hash3(vec3 point) {
    point = fract(point * 0.1031);
    point += dot(point, point.yzx + 33.33);
    return fract((point.x + point.y) * point.z);
  }

  float noise3(vec3 point) {
    vec3 cell = floor(point);
    vec3 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(
        mix(hash3(cell), hash3(cell + vec3(1.0, 0.0, 0.0)), fraction.x),
        mix(hash3(cell + vec3(0.0, 1.0, 0.0)), hash3(cell + vec3(1.0, 1.0, 0.0)), fraction.x),
        fraction.y
      ),
      mix(
        mix(hash3(cell + vec3(0.0, 0.0, 1.0)), hash3(cell + vec3(1.0, 0.0, 1.0)), fraction.x),
        mix(hash3(cell + vec3(0.0, 1.0, 1.0)), hash3(cell + vec3(1.0, 1.0, 1.0)), fraction.x),
        fraction.y
      ),
      fraction.z
    );
  }

  float fbm3(vec3 point) {
    float value = 0.0;
    float amplitude = 0.52;
    float normalization = 0.0;
    for (int octave = 0; octave < 4; octave++) {
      value += noise3(point) * amplitude;
      normalization += amplitude;
      point = point * 2.03 + vec3(7.17, 3.91, 5.33);
      amplitude *= 0.5;
    }
    return value / normalization;
  }

  vec3 rotateY(vec3 point, float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return vec3(
      cosine * point.x + sine * point.z,
      point.y,
      -sine * point.x + cosine * point.z
    );
  }

  void main() {
    vec3 objectNormal = normalize(vObjectNormal);
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(uSunDirection);
    float normalToLight = dot(normal, lightDirection);
    float dayMask = smoothstep(-0.055, 0.085, normalToLight);
    float lambert = max(normalToLight, 0.0);

    // Sampling a 3D field with the sphere normal produces a seamless volume-
    // derived surface: no equirectangular image, no UV seam, and no flat card.
    float continentField = fbm3(objectNormal * 2.85 + vec3(2.4, 6.8, 1.7));
    continentField += (fbm3(objectNormal * 6.4 - vec3(8.3, 1.4, 4.1)) - 0.5) * 0.28;
    float continent = smoothstep(0.515, 0.585, continentField);
    float relief = fbm3(objectNormal * 18.0 + vec3(3.1, 9.2, 5.6));
    vec3 ocean = mix(vec3(0.005, 0.017, 0.05), vec3(0.012, 0.07, 0.14), relief);
    vec3 lowland = vec3(0.075, 0.105, 0.062);
    vec3 highland = vec3(0.22, 0.19, 0.105);
    vec3 land = mix(lowland, highland, smoothstep(0.44, 0.72, relief));
    vec3 albedo = mix(ocean, land, continent);

    float polarLatitude = abs(objectNormal.y);
    float ice = smoothstep(0.79, 0.93, polarLatitude)
      * smoothstep(0.43, 0.68, fbm3(objectNormal * 9.0 + vec3(4.8)));
    albedo = mix(albedo, vec3(0.72, 0.79, 0.82), ice * 0.84);

    // The cloud field rotates independently by a tiny amount, providing slow
    // atmospheric drift without sliding a texture around the sphere.
    vec3 cloudPoint = rotateY(objectNormal, uTime * 0.0024);
    float cloudField = fbm3(cloudPoint * 7.6 + vec3(11.2, 3.4, 8.7));
    cloudField += (fbm3(cloudPoint * 15.1 - vec3(2.5, 7.8, 1.9)) - 0.5) * 0.22;
    float clouds = smoothstep(0.625, 0.735, cloudField) * (1.0 - ice * 0.25);
    albedo = mix(albedo, vec3(0.78, 0.82, 0.85), clouds * 0.68);

    float sunLuminance = dot(uSunColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 incidentColor = mix(uSunColor, vec3(sunLuminance), 0.16);
    vec3 night = albedo * vec3(0.004, 0.008, 0.017);
    vec3 day = albedo * incidentColor * (0.075 + lambert * 1.12);

    vec3 halfwayDirection = normalize(lightDirection + viewDirection);
    float oceanMask = (1.0 - continent) * (1.0 - clouds);
    float specular = pow(max(dot(normal, halfwayDirection), 0.0), 120.0)
      * oceanMask * dayMask * 0.72;
    vec3 color = mix(night, day, dayMask);
    color += incidentColor * specular;

    // Rayleigh-dominant limb light remains constrained to the illuminated
    // edge; the night-facing rim therefore does not become an emissive outline.
    float viewFresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 4.2);
    float litLimb = smoothstep(-0.18, 0.26, normalToLight);
    vec3 rayleigh = vec3(0.10, 0.31, 0.9) * mix(vec3(0.36), uSunColor, 0.64);
    color += rayleigh * viewFresnel * litLimb * 0.34;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(uSunDirection);
    float viewCosine = max(dot(normal, viewDirection), 0.0);
    float lightCosine = dot(normal, lightDirection);
    float tangentPath = pow(1.0 - viewCosine, 3.4);
    float litFraction = smoothstep(-0.24, 0.34, lightCosine);
    float forwardScatter = pow(max(dot(viewDirection, lightDirection), 0.0), 7.0);
    vec3 rayleigh = vec3(0.08, 0.31, 1.0) * mix(vec3(0.32), uSunColor, 0.68);
    vec3 mie = uSunColor * forwardScatter * 0.24;
    float alpha = tangentPath * litFraction * 0.34;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(rayleigh * 0.76 + mie, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function DistantPlanet({
  quality,
  sunDirection,
  sunColor,
  reduceMotion,
}: CelestialBackdropProps) {
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
    uSunColor: { value: new THREE.Color('#ffc18a') },
  }), []);

  useEffect(() => {
    uniforms.uSunDirection.value.set(...sunDirection).normalize();
    uniforms.uSunColor.value.set(sunColor);
  }, [sunColor, sunDirection, uniforms]);

  useFrame((state, delta) => {
    uniforms.uTime.value = reduceMotion ? 0 : state.clock.elapsedTime;
    if (groupRef.current && !reduceMotion) {
      groupRef.current.rotation.y += Math.min(delta, 0.05) * 0.0026;
    }
  });

  const geometryDetail = quality === 'low' ? 2 : quality === 'medium' ? 3 : 4;

  return (
    <group
      ref={groupRef}
      position={PLANET_POSITION}
      rotation={[0.08, -0.42, -0.12]}
      name="procedural-distant-planet"
    >
      <mesh renderOrder={-22}>
        <icosahedronGeometry args={[0.68, geometryDetail]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={PLANET_VERTEX_SHADER}
          fragmentShader={PLANET_FRAGMENT_SHADER}
          fog={false}
          depthWrite
          depthTest
        />
      </mesh>
      <mesh scale={1.055} renderOrder={-21}>
        <icosahedronGeometry args={[0.68, geometryDetail]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={ATMOSPHERE_VERTEX_SHADER}
          fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
          fog={false}
          transparent
          depthWrite={false}
          depthTest
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * Procedural deep-sky layer for the Mars hero. It intentionally contains no
 * canvas, sprite, image or UV texture: stars are instanced solid geometry and
 * the planet is a shaded sphere with a separate volumetric-looking shell.
 */
export function CelestialBackdrop(props: CelestialBackdropProps) {
  return (
    <group name="celestial-backdrop">
      <SparseStarDome quality={props.quality} />
      <DistantPlanet {...props} />
    </group>
  );
}
