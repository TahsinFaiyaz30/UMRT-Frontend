'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { flightState } from './spaceFlightState';

// Only the three cells around the flight are resident. Their coordinates and
// spectral populations come from the cell index, never a repeating sky texture.
const CELL_LENGTH = 12_000;
const CELL_HALF_WIDTH = 7_000;
const STARS_PER_CELL = 1_600;
const BUILD_BATCH = 256;
const FAR_FADE_START = 9_000;
const FAR_FADE_END = 11_000;

const stellarVertexShader = /* glsl */ `
  varying vec3 vStellarColor;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vStellarColor = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const stellarFragmentShader = /* glsl */ `
  uniform float uReveal;
  uniform vec2 uHorizon;
  varying vec3 vStellarColor;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = cameraPosition - vWorldPosition;
    float distanceToStar = length(viewDirection);
    float visibility = 1.0 - smoothstep(uHorizon.x, uHorizon.y, distanceToStar);
    if (visibility < 0.001) discard;

    // An opaque, spherical photosphere with limb darkening. There is no time
    // noise: atmospheric scintillation does not occur in the vacuum of space.
    float mu = max(dot(normalize(vWorldNormal), normalize(viewDirection)), 0.0);
    float photosphere = 0.42 + 0.58 * pow(mu, 0.65);
    gl_FragColor = vec4(vStellarColor * photosphere, visibility * uReveal);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type StellarCell = {
  index: number;
  mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  random: () => number;
  count: number;
  reveal: number;
};

type StellarField = {
  geometry: THREE.SphereGeometry;
  cells: Map<number, StellarCell>;
  matrix: THREE.Matrix4;
  color: THREE.Color;
};

function cellRandom(index: number) {
  // Include both integer words so the universe does not tile every 2^32 cells.
  const low = index >>> 0;
  const high = Math.floor(index / 0x1_0000_0000) >>> 0;
  let seed = Math.imul(low ^ 0x7f4a7c15, 0x85ebca6b) ^ Math.imul(high, 0xc2b2ae35);
  seed ^= seed >>> 16;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Approximate visible-light blackbody colors, converted into linear RGB. */
function stellarColor(temperature: number, target: THREE.Color) {
  const t = temperature / 100;
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return target.setRGB(
    THREE.MathUtils.clamp(red / 255, 0, 1),
    THREE.MathUtils.clamp(green / 255, 0, 1),
    THREE.MathUtils.clamp(blue / 255, 0, 1),
    THREE.SRGBColorSpace,
  );
}

function createCell(index: number, geometry: THREE.SphereGeometry): StellarCell {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uReveal: { value: 0 },
      uHorizon: { value: new THREE.Vector2(FAR_FADE_START, FAR_FADE_END) },
    },
    vertexShader: stellarVertexShader,
    fragmentShader: stellarFragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, STARS_PER_CELL);
  mesh.name = `stellar-cell-${index}`;
  // Draw the distant background before transparent encounter volumes. Sorting
  // an entire instanced cell by its centre otherwise puts some background
  // stars over a black hole's opaque captured-ray shadow.
  mesh.renderOrder = -10;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Allocate the color attribute before shader compilation selects its defines.
  mesh.setColorAt(0, new THREE.Color());
  mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, -CELL_LENGTH / 2),
    Math.hypot(CELL_HALF_WIDTH, CELL_HALF_WIDTH, CELL_LENGTH / 2) + 10,
  );
  return { index, mesh, random: cellRandom(index), count: 0, reveal: 0 };
}

function disposeCell(cell: StellarCell) {
  cell.mesh.removeFromParent();
  cell.mesh.dispose();
  cell.mesh.material.dispose();
}

function buildCellBatch(cell: StellarCell, field: StellarField) {
  const end = Math.min(cell.count + BUILD_BATCH, STARS_PER_CELL);
  const first = cell.count;
  const random = cell.random;
  for (; cell.count < end; cell.count++) {
    let x: number;
    let y: number;
    do {
      x = (random() * 2 - 1) * CELL_HALF_WIDTH;
      y = (random() * 2 - 1) * CELL_HALF_WIDTH;
    } while (x * x + y * y < 1_400 * 1_400);
    const z = -random() * CELL_LENGTH;
    const radius = 1.7 + Math.pow(random(), 6) * 4.1;
    field.matrix.makeScale(radius, radius, radius).setPosition(x, y, z);
    cell.mesh.setMatrixAt(cell.count, field.matrix);

    const spectralClass = random();
    const temperature = spectralClass < 0.2
      ? 2_800 + random() * 1_900
      : spectralClass < 0.8
        ? 4_700 + random() * 3_200
        : 7_900 + random() * 18_000;
    stellarColor(temperature, field.color).multiplyScalar(0.8 + Math.pow(random(), 4) * 2.6);
    cell.mesh.setColorAt(cell.count, field.color);
  }
  cell.mesh.count = cell.count;
  cell.mesh.instanceMatrix.addUpdateRange(first * 16, (end - first) * 16);
  cell.mesh.instanceMatrix.needsUpdate = true;
  cell.mesh.instanceColor!.addUpdateRange(first * 3, (end - first) * 3);
  cell.mesh.instanceColor!.needsUpdate = true;
}

/**
 * A bounded, streaming population of actual stellar spheres. Every star has a
 * fixed position in the journey's 3D world and perspective parallax. Floating
 * origin shifts change coordinates only; neither stars nor a sky dome follow
 * the camera. Distances/radii are compressed for a readable artistic voyage.
 */
export function RealisticStarfield() {
  const group = useRef<THREE.Group>(null);
  const field = useRef<StellarField | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const resources: StellarField = {
      // Smooth normals and the same geometry on every device. These distant
      // photospheres occupy approximately a pixel; no billboard substitutes.
      geometry: new THREE.SphereGeometry(1, 12, 8),
      cells: new Map(),
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(),
    };
    field.current = resources;
    invalidate();
    return () => {
      for (const cell of resources.cells.values()) disposeCell(cell);
      resources.cells.clear();
      resources.geometry.dispose();
      field.current = null;
    };
  }, [invalidate]);

  useFrame((_, delta) => {
    const resources = field.current;
    if (!resources || !group.current) return;

    const current = Math.floor(flightState.worldDistance / CELL_LENGTH);
    for (const [index, cell] of resources.cells) {
      if (Math.abs(index - current) > 1) {
        disposeCell(cell);
        resources.cells.delete(index);
      }
    }

    // Prepare only one cell's next small batch per frame, including at startup.
    // The unseen next cell has a full horizon of empty travel to finish loading.
    let pendingIndex: number | undefined;
    for (let priority = 0; priority < 3; priority++) {
      const index = current + (priority === 0 ? 0 : priority === 1 ? 1 : -1);
      if ((resources.cells.get(index)?.count ?? 0) < STARS_PER_CELL) {
        pendingIndex = index;
        break;
      }
    }
    if (pendingIndex !== undefined) {
      let cell = resources.cells.get(pendingIndex);
      if (!cell) {
        cell = createCell(pendingIndex, resources.geometry);
        resources.cells.set(pendingIndex, cell);
        group.current.add(cell.mesh);
      }
      buildCellBatch(cell, resources);
    }

    let revealing = false;
    for (const cell of resources.cells.values()) {
      cell.mesh.position.z = -cell.index * CELL_LENGTH + flightState.origin;
      cell.reveal = Math.min(1, cell.reveal + Math.min(delta, 0.05) * 2.5);
      cell.mesh.material.uniforms.uReveal.value = THREE.MathUtils.smoothstep(cell.reveal, 0, 1);
      revealing ||= cell.reveal < 1;
    }
    if (pendingIndex !== undefined || revealing) invalidate();
  });

  return <group ref={group} name="streamed-stellar-photospheres" dispose={null} />;
}
