import * as THREE from 'three';
import type { SpaceEncounter } from './spaceTypes';
import { createSolarEncounterObject } from './solarObjects';
import {
  blackHoleFragment,
  cometTailFragment,
  grainFragment,
  grainVertex,
  ringFragment,
  surfaceFragment,
  surfaceVertex,
  volumeFragment,
} from './spaceShaders';

export interface EncounterObject {
  group: THREE.Group;
  /** Fetch only this encounter's observed maps before GPU preparation. */
  prepare?: (signal: AbortSignal) => Promise<void>;
  update: (time: number, delta: number) => void;
  dispose: () => void;
}

// Every client uses the same smooth geometry and shader sample counts. Cost is
// bounded by the encounter window, never by substituting a low quality model.
// Shared meshes have explicit reference counts, including off-scene prewarming.
const geometryPool = new Map<string, { geometry: THREE.BufferGeometry; users: number }>();
const sunlight = new THREE.Vector3(-0.88, 0.30, 0.32).normalize();

function borrowGeometry(
  key: string,
  make: () => THREE.BufferGeometry,
  releases: Array<() => void>,
) {
  let entry = geometryPool.get(key);
  if (!entry) {
    entry = { geometry: make(), users: 0 };
    geometryPool.set(key, entry);
  }
  entry.users++;
  const borrowed = entry;
  releases.push(() => {
    borrowed.users--;
    if (borrowed.users === 0) {
      borrowed.geometry.dispose();
      geometryPool.delete(key);
    }
  });
  return entry.geometry;
}

function randomSequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A closed annulus with top, bottom and radial walls, not a flat ring plane. */
function makeAnnulus() {
  const segments = 384;
  const rows = 20;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const inner = 1.30;
  const outer = 2.55;
  const halfThickness = 0.004;

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? 1 : -1;
    const base = positions.length / 3;
    for (let radial = 0; radial <= rows; radial++) {
      const radius = inner + ((outer - inner) * radial) / rows;
      for (let angular = 0; angular <= segments; angular++) {
        const angle = (angular / segments) * Math.PI * 2;
        positions.push(Math.cos(angle) * radius, halfThickness * sign, Math.sin(angle) * radius);
        normals.push(0, sign, 0);
      }
    }
    for (let radial = 0; radial < rows; radial++) {
      for (let angular = 0; angular < segments; angular++) {
        const a = base + radial * (segments + 1) + angular;
        const b = a + segments + 1;
        if (side === 0) indices.push(a, b + 1, b, a, a + 1, b + 1);
        else indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  for (const radius of [inner, outer]) {
    const base = positions.length / 3;
    const sign = radius === outer ? 1 : -1;
    for (let angular = 0; angular <= segments; angular++) {
      const angle = (angular / segments) * Math.PI * 2;
      for (const y of [-halfThickness, halfThickness]) {
        positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        normals.push(Math.cos(angle) * sign, 0, Math.sin(angle) * sign);
      }
    }
    for (let angular = 0; angular < segments; angular++) {
      const a = base + angular * 2;
      if (sign > 0) indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      else indices.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeRockGeometry(seed: number, segments = 128, rows = 96) {
  const geometry = new THREE.SphereGeometry(1, segments, rows);
  const positions = geometry.attributes.position;
  const p = new THREE.Vector3();
  const phase = (seed % 8192) * 0.017;
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i);
    // Continuous 3D displacements preserve smooth silhouettes and fine relief.
    const large = Math.sin(p.x * 3.3 + phase) * Math.sin(p.y * 4.1 + 1.2) * Math.cos(p.z * 3.9);
    const middle = Math.sin(p.x * 10.7 + p.y * 6.9 + phase) * Math.cos(p.z * 9.3 - p.y * 4.4);
    const small = Math.sin(p.x * 31.1 - p.y * 18.8) * Math.cos(p.z * 27.7 + phase);
    const radius = 0.88 + large * 0.15 + middle * 0.036 + small * 0.007;
    positions.setXYZ(i, p.x * radius * 1.14, p.y * radius * 0.83, p.z * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Resolved crater bowls and rims really displace the mesh; sub-pixel regolith
 * detail is subsequently shaded with the object-space height derivatives. */
function makeCraterGeometry(seed: number) {
  const geometry = new THREE.SphereGeometry(1, 192, 128);
  const random = randomSequence(seed ^ 0x742b);
  const craters = Array.from({ length: 18 }, () => {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radial = Math.sqrt(1 - y * y);
    return { center: new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial), size: 0.06 + random() * 0.12 };
  });
  const positions = geometry.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i);
    let elevation = Math.sin(p.x * 17 + seed % 51) * Math.cos(p.y * 21 + p.z * 13) * 0.0007;
    for (const crater of craters) {
      const distance = p.distanceTo(crater.center) / crater.size;
      if (distance > 1.45) continue;
      const bowl = -Math.max(0, 1 - distance * distance) * 0.11;
      const rim = Math.exp(-((distance - 1.0) ** 2) * 120) * 0.025;
      elevation += (bowl + rim) * crater.size;
    }
    positions.setXYZ(i, p.x * (1 + elevation), p.y * (1 + elevation), p.z * (1 + elevation));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Allocate one encounter. The caller schedules creation, compilation and eviction. */
export function createEncounterObject(encounter: SpaceEncounter): EncounterObject {
  if (encounter.solarBodyId) return createSolarEncounterObject(encounter);
  const group = new THREE.Group();
  group.name = `space-encounter-${encounter.index}-${encounter.kind}`;
  group.position.fromArray(encounter.position);
  group.scale.setScalar(encounter.radius);
  const axis = new THREE.Group();
  axis.rotation.z = encounter.axialTilt;
  group.add(axis);
  const spin = new THREE.Group();
  axis.add(spin);

  const releases: Array<() => void> = [];
  const materials: THREE.ShaderMaterial[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const motions: Array<(time: number) => void> = [];
  const random = randomSequence(encounter.seed);
  // Keeping the seed modest avoids loss of highp float noise precision.
  const seed = (encounter.seed % 65521) / 31;
  const colors = encounter.palette.map((value) => new THREE.Color(value));
  const identity = new THREE.Matrix4();

  function material(fragmentShader: string, extra: THREE.ShaderMaterialParameters = {}) {
    const result = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader,
      uniforms: {
        uCameraLocal: { value: new THREE.Vector3() },
        uSunLocal: { value: sunlight.clone() },
        uSeed: { value: seed },
        uTime: { value: 0 },
        uColorA: { value: colors[0] },
        uColorB: { value: colors[1] },
        uColorC: { value: colors[2] },
      },
      ...extra,
    });
    materials.push(result);
    return result;
  }

  function localUniforms(mesh: THREE.Mesh, shader: THREE.ShaderMaterial) {
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      // Floating-origin moves, axial tilt and per-body spin all live in the
      // actual matrix, so the volume rays never use stale world coordinates.
      identity.copy(mesh.matrixWorld).invert();
      if (shader.uniforms.uCameraLocal) {
        camera.getWorldPosition(shader.uniforms.uCameraLocal.value);
        shader.uniforms.uCameraLocal.value.applyMatrix4(identity);
      }
      if (shader.uniforms.uSunLocal) shader.uniforms.uSunLocal.value.copy(sunlight).transformDirection(identity);
    };
    return mesh;
  }

  const sphere = () => borrowGeometry('surface-sphere', () => new THREE.SphereGeometry(1, 128, 96), releases);
  const particleSphere = () => borrowGeometry('solid-grain-sphere', () => new THREE.SphereGeometry(1, 16, 12), releases);

  function addAtmosphere(stellar = false) {
    const rocky = encounter.kind === 'terrestrial';
    const outer = stellar ? 1.16 : rocky ? 1.028 : 1.045;
    const geometry = borrowGeometry(
      stellar ? 'corona-volume' : `atmosphere-volume-${outer}`,
      () => new THREE.SphereGeometry(outer, 96, 72),
      releases,
    );
    const shader = material(volumeFragment, { transparent: true, depthWrite: false });
    shader.uniforms.uOuter = { value: outer };
    shader.uniforms.uScaleHeight = { value: rocky ? 0.0032 : 0.0065 };
    shader.uniforms.uDensity = { value: rocky ? 8.0 : 6.0 };
    shader.uniforms.uTint = { value: new THREE.Color(stellar ? encounter.palette[0] : (encounter.atmosphere ?? '#91b5d1')) };
    // The current catalogue contains dry oxidized/basaltic terrestrial worlds.
    // Do not invent oceans or thick water clouds for these scientific classes.
    shader.uniforms.uClouds = { value: 0 };
    shader.uniforms.uStar = { value: stellar ? 1 : 0 };
    const mesh = localUniforms(new THREE.Mesh(geometry, shader), shader);
    mesh.name = stellar ? 'integrated-stellar-corona' : 'integrated-atmospheric-shell';
    mesh.renderOrder = 2;
    spin.add(mesh);
  }

  function addRingGrains() {
    const count = 320;
    const shader = material(grainFragment, { vertexShader: grainVertex });
    shader.uniforms.uColorA.value = new THREE.Color('#b4ab98');
    const grains = localUniforms(new THREE.InstancedMesh(particleSphere(), shader, count), shader) as THREE.InstancedMesh;
    const transform = new THREE.Object3D();
    const elements = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      let radius = 1.40 + random() * 1.08;
      if (Math.abs(radius - 2.16) < 0.045) radius += 0.07;
      transform.position.set(Math.cos(angle) * radius, (random() - 0.5) * 0.024, Math.sin(angle) * radius);
      const size = 0.0014 + Math.pow(random(), 3) * 0.006;
      elements.set([angle, radius, transform.position.y, size], i * 4);
      transform.scale.set(size, size * (0.8 + random() * 0.4), size);
      transform.updateMatrix();
      grains.setMatrixAt(i, transform.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
    grains.computeBoundingSphere();
    grains.name = 'solid-ice-ring-grains';
    axis.add(grains);
    grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    motions.push((time) => {
      for (let i = 0; i < count; i++) {
        const offset = i * 4;
        const radius = elements[offset + 1];
        // Keplerian shear: inner ice grains overtake the outer rings.
        const angle = elements[offset] + time * 0.32 / Math.pow(radius, 1.5);
        transform.position.set(Math.cos(angle) * radius, elements[offset + 2], Math.sin(angle) * radius);
        transform.scale.setScalar(elements[offset + 3]);
        transform.updateMatrix();
        grains.setMatrixAt(i, transform.matrix);
      }
      grains.instanceMatrix.needsUpdate = true;
    });
  }

  function addRings() {
    const geometry = borrowGeometry('closed-ice-annulus', makeAnnulus, releases);
    const shader = material(ringFragment, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
    shader.uniforms.uColorA.value = new THREE.Color('#9e9584');
    shader.uniforms.uColorB.value = new THREE.Color('#d2c7af');
    const rings = localUniforms(new THREE.Mesh(geometry, shader), shader);
    rings.name = 'finite-thickness-icy-rings';
    rings.renderOrder = 1;
    axis.add(rings);
    addRingGrains();
  }

  function addTail() {
    // Solar radiation and the solar wind point the tails away from the light.
    // The gas/ice medium is integrated in an ellipsoidal 3D volume; dust grains
    // are individual smooth closed meshes, instanced in one draw call.
    const antiSun = sunlight.clone().negate();
    const localAntiSun = antiSun.applyAxisAngle(new THREE.Vector3(0, 0, 1), -encounter.axialTilt);
    const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localAntiSun);
    for (const dust of [false, true]) {
      const shader = material(cometTailFragment, { transparent: true, depthWrite: false });
      shader.uniforms.uTint = { value: new THREE.Color(dust ? '#b5aaa0' : '#7898b3') };
      shader.uniforms.uDust = { value: dust ? 1 : 0 };
      const volume = borrowGeometry('tail-volume', () => new THREE.SphereGeometry(1, 80, 56), releases);
      const tail = localUniforms(new THREE.Mesh(volume, shader), shader);
      const length = dust ? 3.8 : 4.8;
      tail.scale.set(dust ? 1.15 : 0.65, dust ? 0.80 : 0.55, length);
      tail.position.copy(localAntiSun).multiplyScalar(length + 0.35);
      tail.quaternion.copy(orientation);
      tail.name = dust ? 'integrated-comet-dust-tail' : 'integrated-comet-ion-tail';
      tail.renderOrder = 2;
      axis.add(tail);
    }
    const count = 256;
    const shader = material(grainFragment, { vertexShader: grainVertex });
    shader.uniforms.uColorA.value = new THREE.Color('#8e8981');
    const grains = localUniforms(new THREE.InstancedMesh(particleSphere(), shader, count), shader) as THREE.InstancedMesh;
    const transform = new THREE.Object3D();
    const elements = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const along = Math.pow(random(), 1.7);
      const spread = 0.10 + along * 0.54;
      transform.position.set((random() - 0.5) * spread + along * along * 0.35, (random() - 0.5) * spread, 0.75 + along * 7.0);
      transform.position.applyQuaternion(orientation);
      const size = 0.0015 + Math.pow(random(), 3) * 0.013 * (1.0 - along * 0.55);
      elements.set([along, random() - 0.5, random() - 0.5, size], i * 4);
      transform.scale.setScalar(size);
      transform.updateMatrix();
      grains.setMatrixAt(i, transform.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
    grains.computeBoundingSphere();
    grains.name = 'solid-comet-dust-and-ice';
    axis.add(grains);
    grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    motions.push((time) => {
      for (let i = 0; i < count; i++) {
        const offset = i * 4;
        const along = (elements[offset] + time * 0.035) % 1;
        const spread = 0.10 + along * 0.54;
        transform.position.set(elements[offset + 1] * spread + along * along * 0.35,
          elements[offset + 2] * spread, 0.75 + along * 7.0).applyQuaternion(orientation);
        // Grains sublimate/fade at the tail's end before the emitter reuses them.
        const visibility = Math.min(1, along * 18, (1 - along) * 12);
        transform.scale.setScalar(elements[offset + 3] * visibility);
        transform.updateMatrix();
        grains.setMatrixAt(i, transform.matrix);
      }
      grains.instanceMatrix.needsUpdate = true;
    });
  }

  function addDebris() {
    const shader = material(grainFragment, { vertexShader: grainVertex });
    const geometry = borrowGeometry('solid-rock-debris', () => makeRockGeometry(72391, 20, 16), releases);
    const debris = localUniforms(new THREE.InstancedMesh(geometry, shader, 96), shader) as THREE.InstancedMesh;
    const transform = new THREE.Object3D();
    const elements = new Float32Array(96 * 5);
    for (let i = 0; i < 96; i++) {
      const y = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radial = Math.sqrt(1 - y * y);
      transform.position.set(Math.cos(angle) * radial, y, Math.sin(angle) * radial).multiplyScalar(1.06 + random() * 0.18);
      transform.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const size = 0.004 + Math.pow(random(), 2.5) * 0.025;
      elements.set([angle, 1.30 + random() * 0.26, (random() - 0.5) * 0.6, size, random() * 6.28], i * 5);
      transform.scale.set(size, size * (0.7 + random() * 0.5), size);
      transform.updateMatrix();
      debris.setMatrixAt(i, transform.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
    debris.computeBoundingSphere();
    debris.name = 'solid-rock-and-metal-fragments';
    axis.add(debris);
    debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    motions.push((time) => {
      for (let i = 0; i < 96; i++) {
        const offset = i * 5;
        const radius = elements[offset + 1];
        const angle = elements[offset] + time * 0.11 / Math.pow(radius, 1.5);
        const inclination = elements[offset + 2];
        transform.position.set(Math.cos(angle) * radius, Math.sin(angle) * Math.sin(inclination) * radius,
          Math.sin(angle) * Math.cos(inclination) * radius);
        transform.rotation.set(time * 0.04 + elements[offset + 4], time * 0.07, inclination);
        transform.scale.setScalar(elements[offset + 3]);
        transform.updateMatrix();
        debris.setMatrixAt(i, transform.matrix);
      }
      debris.instanceMatrix.needsUpdate = true;
    });
    debris.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.62);
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const shader of materials) shader.dispose();
    for (const geometry of ownedGeometries) geometry.dispose();
    for (const release of releases) release();
    group.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    group.clear();
    motions.length = 0;
  }

  // Allocation is transactional: even a construction failure before the
  // caller receives its resource releases every borrowed geometry reference.
  try {
    if (encounter.kind === 'black-hole') {
      axis.rotation.x = 0.14;
      axis.rotation.z = 0.08;
      const geometry = borrowGeometry('curved-ray-bound', () => new THREE.SphereGeometry(4.6, 96, 72), releases);
      const shader = material(blackHoleFragment, { transparent: true, depthWrite: false });
      const mesh = localUniforms(new THREE.Mesh(geometry, shader), shader);
      mesh.name = 'curved-ray-accretion-volume';
      axis.add(mesh);
    } else {
      const isRock = encounter.kind === 'asteroid' || encounter.kind === 'comet';
      const cratered = encounter.kind === 'airless' || encounter.kind === 'terrestrial';
      const geometry = isRock ? makeRockGeometry(encounter.seed) : cratered ? makeCraterGeometry(encounter.seed) : sphere();
      if (isRock || cratered) ownedGeometries.push(geometry);
      const kinds: Record<Exclude<SpaceEncounter['kind'], 'black-hole'>, number> = {
        terrestrial: 0, airless: 1, 'gas-giant': 2, 'ice-giant': 3,
        asteroid: 4, comet: 4, star: 5,
      };
      // Compile only this body's material. A monolithic dynamic branch can make
      // drivers optimize unrelated crater, cloud and stellar paths together.
      const shader = material(surfaceFragment, { defines: { SURFACE_KIND: kinds[encounter.kind] } });
      shader.uniforms.uOcean = { value: 0 };
      shader.uniforms.uRings = { value: encounter.rings ? 1 : 0 };
      const body = localUniforms(new THREE.Mesh(geometry, shader), shader);
      body.name = isRock ? 'displaced-rocky-nucleus' : 'procedural-spherical-surface';
      spin.add(body);
      if (encounter.kind === 'star') addAtmosphere(true);
      else if (encounter.atmosphere) addAtmosphere();
      if (encounter.rings) addRings();
      if (encounter.kind === 'comet') addTail();
      if (encounter.kind === 'asteroid') addDebris();
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    group,
    update(time: number, _delta: number) {
      if (disposed) return;
      spin.rotation.y = time * encounter.rotationSpeed;
      for (const shader of materials) shader.uniforms.uTime.value = time;
      for (const animate of motions) animate(time);
    },
    dispose,
  };
}
