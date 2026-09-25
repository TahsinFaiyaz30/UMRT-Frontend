import * as THREE from 'three';
import type { EncounterObject } from './encounterObjects';
import type { SpaceEncounter } from './spaceTypes';
import { ASTRONOMICAL_UNIT_KM, createOrbitalMotion, getSolarSystemBody } from './orbitalMotion';
import { SOLAR_SIMULATION_SECONDS_PER_SECOND } from './solarSystemCatalog';
import { acquireSolarTexture, type SolarTextureLease } from './solarTextures';
import { solarAtmosphereFragment, solarCloudFragment, solarRingFragment, solarSunFragment, solarSurfaceFragment, solarVertex } from './solarShaders';
import { solarAtmosphereVertex } from './solarAtmosphereShader';
import { flightState } from './spaceFlightState';
import { createSolarPlasma } from './solarPlasma';
import { createSolarCorona } from './solarCorona';
import { SOLAR_OBSERVATION_REGIONS } from './solarObservation';

// Independent scene-distance compression preserves satellite eccentricities,
// inclination, prograde/retrograde direction and relative orbital periods.
const MOON_ORBITS: Record<string, number> = {
  moon: 4.2, phobos: 2.2, deimos: 3.4, io: 2.6, europa: 3.6,
  ganymede: 4.7, callisto: 6.1, rhea: 3.3, titan: 4.9, iapetus: 6.2,
  titania: 3.5, oberon: 4.6, triton: 3.8, charon: 3.0,
};
const OBLATENESS: Record<string, number> = { jupiter: .935, saturn: .902, uranus: .977, neptune: .983, earth: .9966 };
const INITIAL_LONGITUDE: Record<string, number> = { earth: 2.2, jupiter: 1.0, mars: .65, moon: 0, pluto: -1.82 };
const RELIEF: Record<string, { scale: number; bias: number; radius: number }> = {
  mercury: { scale: .5, bias: -10000, radius: 2439400 },
  moon: { scale: .5, bias: -10000, radius: 1737400 },
  mars: { scale: 1, bias: -12000, radius: 3396000 },
};
// Heights are kilometres above the visible surface/cloud deck. Earth uses
// terrestrial molecular/aerosol scale heights; other haze fits are illustrative,
// not retrieved local weather or full multiple-scattering atmosphere models.
const ATMOSPHERES: Record<string, { top: number; scale: [number, number]; rayleigh: [number, number, number]; mie: [number, number, number]; g: number }> = {
  earth: { top: 80, scale: [8.5, 1.2], rayleigh: [.0058, .0135, .0331], mie: [.004, .004, .004], g: .76 },
  mars: { top: 55, scale: [11.1, 9], rayleigh: [.00008, .00016, .00034], mie: [.014, .011, .008], g: .68 },
  venus: { top: 70, scale: [7, 4], rayleigh: [.0004, .0009, .002], mie: [.024, .021, .014], g: .8 },
  jupiter: { top: 180, scale: [27, 12], rayleigh: [.0003, .0006, .0013], mie: [.001, .0009, .0007], g: .75 },
  saturn: { top: 250, scale: [59, 20], rayleigh: [.00016, .00035, .0007], mie: [.001, .0009, .0006], g: .75 },
  uranus: { top: 150, scale: [27, 14], rayleigh: [.00025, .00065, .0011], mie: [.0003, .0006, .0007], g: .75 },
  neptune: { top: 130, scale: [20, 12], rayleigh: [.0003, .0008, .0014], mie: [.0003, .0006, .0008], g: .75 },
  titan: { top: 160, scale: [40, 30], rayleigh: [.0001, .0003, .0007], mie: [.005, .0034, .0015], g: .8 },
};
let sharedSphere: THREE.SphereGeometry | null = null;
let sphereUsers = 0;

function sphereLease() {
  if (!sharedSphere) sharedSphere = new THREE.SphereGeometry(1, 256, 192);
  sphereUsers++;
  const geometry = sharedSphere;
  let released = false;
  return { geometry, release() {
    if (released) return;
    released = true;
    if (--sphereUsers === 0) { geometry.dispose(); sharedSphere = null; }
  } };
}

/** A genuinely closed, thin ring volume. Cassini and Encke gaps remain in the
 * opacity model, while occultations and ring shadows use world-space rays. */
function ringGeometry(inner: number, outer: number) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  // Half-thickness ~9 m at Saturn's equatorial radius, not an exaggerated slab.
  const segments = 384, rows = 24, thickness = .00000015;
  for (let side = 0; side < 2; side++) {
    const sign = side ? -1 : 1, base = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const radius = inner + (outer - inner) * row / rows;
      for (let i = 0; i <= segments; i++) {
        const angle = i / segments * Math.PI * 2;
        positions.push(Math.cos(angle) * radius, sign * thickness, Math.sin(angle) * radius);
        normals.push(0, sign, 0);
      }
    }
    for (let row = 0; row < rows; row++) for (let i = 0; i < segments; i++) {
      const a = base + row * (segments + 1) + i, b = a + segments + 1;
      if (side) indices.push(a, b, b + 1, a, b + 1, a + 1);
      else indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  for (const radius of [inner, outer]) {
    const base = positions.length / 3, sign = radius === outer ? 1 : -1;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      for (const y of [-thickness, thickness]) {
        positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        normals.push(Math.cos(angle) * sign, 0, Math.sin(angle) * sign);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
      if (sign > 0) indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      else indices.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  // ShaderMaterial's shared vertex declares UV even though ring radii use xyz.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSolarEncounterObject(encounter: SpaceEncounter): EncounterObject {
  const body = getSolarSystemBody(encounter.solarBodyId ?? '');
  if (!body) throw new Error(`Unknown solar body ${encounter.solarBodyId}`);
  for (const id of encounter.moons ?? []) {
    if (!getSolarSystemBody(id)) throw new Error(`Unknown moon ${id}`);
  }
  const group = new THREE.Group();
  group.name = `space-encounter-${encounter.index}-${body.id}`;
  group.position.fromArray(encounter.position);
  group.scale.setScalar(encounter.radius);
  group.userData.solarBodyId = body.id;
  group.userData.moons = encounter.moons ?? [];
  const axis = new THREE.Group();
  // Pluto's tour is viewed from its observed northern hemisphere. Changing
  // pole azimuth preserves obliquity/retrograde spin without presenting the
  // unobserved south pole as a blank photographed surface.
  axis.rotation.z = (body.id === 'pluto' ? -1 : 1) * body.spinAxisTiltDeg * Math.PI / 180;
  // Pole azimuth is an illustrative initial viewing phase, not a change to
  // Pluto's obliquity. A ~25-degree northern view shows the mapped encounter
  // hemisphere instead of looking almost directly down the unresolved pole.
  if (body.id === 'pluto') axis.rotation.y = .48;
  group.add(axis);
  const spin = new THREE.Group();
  axis.add(spin);
  const sphere = sphereLease();
  const materials: THREE.ShaderMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const leases: SolarTextureLease[] = [];
  const loads: Array<{ id: string; data: boolean; material: THREE.ShaderMaterial; uniform: string }> = [];
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const sunlight = new THREE.Vector3(...(encounter.sunDirection ?? [-.62, .3, .72])).normalize();
  const parentCenter = new THREE.Vector3();
  const ringNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(axis.quaternion);
  const parentMotion = createOrbitalMotion(body);
  const parentOccluders = Array.from({ length: 4 }, () => new THREE.Vector4());
  const moonOccluders = Array.from({ length: 4 }, () => new THREE.Vector4());
  let disposed = false;
  let prepared: Promise<void> | null = null;
  let externalSignal: AbortSignal | undefined;
  let externalAbort: (() => void) | undefined;
  let plasma: ReturnType<typeof createSolarPlasma> | undefined;
  let corona: ReturnType<typeof createSolarCorona> | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (externalSignal && externalAbort) externalSignal.removeEventListener('abort', externalAbort);
    for (const lease of leases) lease.release();
    leases.length = 0;
    for (const entry of materials) entry.dispose();
    for (const geometry of geometries) geometry.dispose();
    plasma?.dispose();
    corona?.dispose();
    white.dispose();
    sphere.release();
    group.removeFromParent();
    group.clear();
  };

  try {

  const material = (fragmentShader: string, extras: Record<string, THREE.IUniform> = {}, transparent = false) => {
    const result = new THREE.ShaderMaterial({ vertexShader: solarVertex, fragmentShader, uniforms: {
      uSun: { value: sunlight }, uOccluders: { value: parentOccluders }, uTime: { value: 0 },
      uHeight: { value: white }, uHeightScale: { value: 0 }, uHeightBias: { value: 0 }, uBodyRadius: { value: 1 }, ...extras,
    }, transparent, depthWrite: !transparent });
    materials.push(result);
    return result;
  };
  const addMap = (target: THREE.ShaderMaterial, uniform: string, id: string, data = false) => {
    target.uniforms[uniform] = { value: white };
    loads.push({ id, data, material: target, uniform });
  };
  const surfaceMaterial = (id: string, isMoon = false) => {
    const mapped = !['sun', 'venus', 'titan'].includes(id);
    const base = id === 'venus' ? '#e9dfc1' : id === 'titan' ? '#c5a373' : id === 'neptune' ? '#98c0ca' : '#c9c4be';
    const relief = RELIEF[id];
    const result = material(solarSurfaceFragment, {
      uMap: { value: white }, uNight: { value: white }, uClouds: { value: white }, uNormalMap: { value: white }, uRingProfile: { value: white },
      uCloudOffset: { value: 0 }, uHasMap: { value: mapped ? 1 : 0 }, uEarth: { value: id === 'earth' ? 1 : 0 },
      // Register the observed Charon encounter hemisphere without changing
      // the locked local +Z frame that continually faces its parent.
      uMapOffset: { value: id === 'charon' ? .30 : 0 },
      uHasNormal: { value: relief ? 1 : 0 }, uCloudPlanet: { value: ['venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan'].includes(id) ? 1 : 0 },
      uHeightScale: { value: relief?.scale ?? 0 }, uHeightBias: { value: relief?.bias ?? 0 }, uBodyRadius: { value: relief?.radius ?? 1 },
      uBaseColor: { value: new THREE.Color(base) }, uNeptune: { value: id === 'neptune' ? 1 : 0 },
      uVenus: { value: id === 'venus' ? 1 : 0 }, uTitan: { value: id === 'titan' ? 1 : 0 },
      uNoDataFill: { value: id === 'titania' || id === 'oberon' ? 1 : 0 },
      uRingNormal: { value: ringNormal }, uParentCenter: { value: parentCenter },
      uParentRadius: { value: encounter.radius }, uRings: { value: id === 'saturn' ? 1 : 0 },
      uOccluders: { value: isMoon ? moonOccluders : parentOccluders },
    });
    if (mapped) addMap(result, 'uMap', id);
    if (relief) {
      addMap(result, 'uNormalMap', `${id}-normal`, true);
      addMap(result, 'uHeight', `${id}-height`, true);
    }
    if (id === 'saturn') addMap(result, 'uRingProfile', 'saturn-ring-profile', true);
    if (id === 'earth') { addMap(result, 'uNight', 'earth-night'); addMap(result, 'uClouds', 'earth-clouds', true); }
    return result;
  };
  const addAtmosphere = (id: string, parent: THREE.Object3D, flattening = 1) => {
    const parameters = ATMOSPHERES[id];
    if (!parameters) return;
    const radius = getSolarSystemBody(id)!.radiusKm;
    const outerRadius = radius + parameters.top;
    const atmosphere = material(solarAtmosphereFragment, {
      uPlanetRadius: { value: radius / outerRadius },
      uScaleHeight: { value: new THREE.Vector2(...parameters.scale).divideScalar(outerRadius) },
      uRayleigh: { value: new THREE.Vector3(...parameters.rayleigh).multiplyScalar(outerRadius) },
      uMie: { value: new THREE.Vector3(...parameters.mie).multiplyScalar(outerRadius) },
      uMieG: { value: parameters.g }, uIrradiance: { value: 6.5 },
    }, true);
    atmosphere.vertexShader = solarAtmosphereVertex;
    const shell = new THREE.Mesh(sphere.geometry, atmosphere);
    shell.name = `${getSolarSystemBody(id)!.name} atmosphere`;
    const height = outerRadius / radius;
    shell.scale.set(height, height * flattening, height);
    shell.renderOrder = 3;
    parent.add(shell);
  };

  const surface = body.id === 'sun' ? material(solarSunFragment, { uSolarView: { value: 1 } }) : surfaceMaterial(body.id);
  const globe = new THREE.Mesh(sphere.geometry, surface);
  globe.name = body.name;
  globe.scale.y = OBLATENESS[body.id] ?? 1;
  spin.add(globe);
  if (body.id === 'sun') {
    addMap(surface, 'uSolarObservation', 'sun-aia304');
    plasma = createSolarPlasma();
    spin.add(plasma.group);
    corona = createSolarCorona();
    spin.add(corona.group);
  }
  const activeRegions = body.id === 'sun' ? Array.from({ length: 8 }, () => new THREE.Vector3()) : [];
  const solarNorth = new THREE.Vector3(0, 1, 0);
  if (activeRegions.length) group.userData.solarActiveRegions = activeRegions;
  let clouds: THREE.Mesh | null = null;
  if (body.id === 'earth') {
    const cloudMaterial = material(solarCloudFragment, {}, true);
    addMap(cloudMaterial, 'uMap', 'earth-clouds', true);
    clouds = new THREE.Mesh(sphere.geometry, cloudMaterial);
    clouds.name = 'Earth cloud layer';
    clouds.scale.set(1.003, 1.0, 1.003);
    clouds.renderOrder = 2;
    axis.add(clouds);
  }
  addAtmosphere(body.id, axis, OBLATENESS[body.id] ?? 1);

  if (encounter.rings) {
    const ringMaterial = material(solarRingFragment, { uDark: { value: body.id === 'saturn' ? 0 : 1 }, uRingProfile: { value: white }, uRingColor: { value: white }, uOccluders: { value: moonOccluders } }, true);
    // The closed volume already has outward top and bottom faces. Rendering
    // their backfaces too would apply optical depth twice.
    ringMaterial.side = THREE.FrontSide;
    if (body.id === 'saturn') {
      addMap(ringMaterial, 'uRingProfile', 'saturn-ring-profile', true);
      addMap(ringMaterial, 'uRingColor', 'saturn-ring-color');
    }
    const intervals = body.id === 'saturn' ? [[1.238, 2.28], [2.327, 2.336]] : body.id === 'uranus' ? [[1.64, 1.65], [1.74, 1.755], [1.97, 1.99], [2.03, 2.045]] : [[1.7, 1.713], [2.16, 2.177], [2.53, 2.545]];
    for (const [inner, outer] of intervals) {
      const geometry = ringGeometry(inner, outer);
      geometries.push(geometry);
      const ring = new THREE.Mesh(geometry, ringMaterial);
      ring.name = `${body.name} rings`;
      ring.renderOrder = 4;
      axis.add(ring);
    }
  }

  const satellites = (encounter.moons ?? []).map((id) => {
    const moon = getSolarSystemBody(id);
    if (!moon) throw new Error(`Unknown moon ${id}`);
    const orbit = new THREE.Group();
    orbit.name = `${moon.name} orbit`;
    if (moon.orbitReferencePlane === 'parent-equator') orbit.quaternion.copy(axis.quaternion);
    group.add(orbit);
    const mesh = new THREE.Mesh(sphere.geometry, surfaceMaterial(id, true));
    mesh.name = moon.name;
    const relativeRadius = moon.radiusKm / body.radiusKm;
    mesh.scale.setScalar(relativeRadius);
    if (id === 'phobos') mesh.scale.multiply(new THREE.Vector3(1.22, .83, 1));
    if (id === 'deimos') mesh.scale.multiply(new THREE.Vector3(1.23, .86, 1));
    orbit.add(mesh);
    if (id === 'titan') addAtmosphere(id, mesh);
    const evaluator = createOrbitalMotion(moon, { distanceScale: (MOON_ORBITS[id] ?? 4) * ASTRONOMICAL_UNIT_KM / moon.semiMajorAxisKm });
    return { mesh, evaluator, relativeRadius, world: new THREE.Vector3() };
  });
  const position = new THREE.Vector3(), velocity = new THREE.Vector3();
  const facing = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  parentMotion.update(0);
  const heliocentricDirection = new THREE.Vector3().copy(parentMotion.state.position).negate().normalize();
  const illuminationFrame = new THREE.Quaternion();
  let plutoEntryTime: number | undefined;
  if (body.id !== 'sun') {
    // Each inspection scene uses its planet's orbital plane as the xz plane.
    // The Sun must stay in that plane: an arbitrary elevation can illuminate
    // Saturn's rings beyond its obliquity or give Earth impossible seasons.
    const orbitNormal = new THREE.Vector3().crossVectors(parentMotion.state.position, parentMotion.state.velocity).normalize();
    const north = new THREE.Vector3(0, 1, 0);
    illuminationFrame.setFromUnitVectors(orbitNormal, north);
    heliocentricDirection.applyQuaternion(illuminationFrame);
    const angle = Math.atan2(sunlight.x, sunlight.z) - Math.atan2(heliocentricDirection.x, heliocentricDirection.z);
    illuminationFrame.premultiply(new THREE.Quaternion().setFromAxisAngle(north, angle));
  }

  return {
    group,
    prepare(signal) {
      if (disposed || signal.aborted) return Promise.reject(new DOMException('Solar encounter retired', 'AbortError'));
      if (prepared) return prepared;
      externalSignal = signal;
      externalAbort = dispose;
      signal.addEventListener('abort', dispose, { once: true });
      prepared = Promise.all(loads.map(async (request) => {
        const lease = acquireSolarTexture(request.id, request.data);
        leases.push(lease);
        const texture = await lease.ready;
        signal.throwIfAborted();
        if (disposed) throw new DOMException('Solar encounter retired', 'AbortError');
        request.material.uniforms[request.uniform].value = texture;
      })).then(() => undefined).catch((error) => { dispose(); throw error; });
      return prepared;
    },
    update(time) {
      if (disposed) return;
      // Pluto's entry phase must be stable even if the visitor spent minutes
      // at earlier worlds; motion continues naturally after this initial epoch.
      if (body.id === 'pluto' && group.visible && plutoEntryTime === undefined) plutoEntryTime = time;
      const simulationTime = (time - (body.id === 'pluto' ? plutoEntryTime ?? time : 0)) * SOLAR_SIMULATION_SECONDS_PER_SECOND;
      if (body.id === 'sun') surface.uniforms.uSolarView.value = flightState.solarView === 'euv' ? 1 : 0;
      parentMotion.update(simulationTime);
      if (body.id !== 'sun') sunlight.copy(parentMotion.state.position).negate().applyQuaternion(illuminationFrame).normalize();
      spin.rotation.y = parentMotion.state.rotation + (INITIAL_LONGITUDE[body.id] ?? 0);
      if (clouds) {
        clouds.rotation.y = spin.rotation.y + time * .0018;
        surface.uniforms.uCloudOffset.value = (spin.rotation.y - clouds.rotation.y) / (Math.PI * 2);
      }
      for (const entry of materials) entry.uniforms.uTime.value = time;
      for (const satellite of satellites) {
        // Start Charon beside the encounter rather than behind the bottom HUD.
        // This is a fixed orbital phase; its period and tidal lock are unchanged.
        satellite.evaluator.update(simulationTime + (body.id === 'pluto' ? 6.38723 * 86400 * .27 : 0));
        position.copy(satellite.evaluator.state.position);
        velocity.copy(satellite.evaluator.state.velocity);
        satellite.mesh.position.copy(position);
        // A locked satellite presents the same hemisphere to its parent,
        // including retrograde Triton. The angular-momentum normal avoids
        // accidental roll flips at the poles and double-counted axial tilts.
        facing.copy(position).normalize().negate();
        up.crossVectors(position, velocity).normalize();
        right.crossVectors(up, facing).normalize();
        basis.makeBasis(right, up, facing);
        satellite.mesh.quaternion.setFromRotationMatrix(basis);
      }
      group.updateMatrixWorld(true);
      plasma?.update(time, flightState.solarView === 'euv');
      corona?.update(time, flightState.solarView === 'euv');
      group.getWorldPosition(parentCenter);
      for (let index = 0; index < activeRegions.length; index++) {
        // EUV focus follows measured bright regions; white light follows the
        // representative photospheric spots. Both share differential rotation.
        const longitude = 1.10 + index * 2.39996323;
        const observed = flightState.solarView === 'euv';
        const latitude = observed ? Math.asin(SOLAR_OBSERVATION_REGIONS[index][1]) : (index % 2 * 2 - 1) * (.18 + .038 * (index * 3 % 6));
        const sinSquared = Math.sin(latitude) ** 2;
        const rate = 14.437 - 1.48 * sinSquared - 2.99 * sinSquared ** 2;
        const reference = 360 / (body.rotationPeriodHours / 24);
        const offset = (rate - reference) * simulationTime / 86400 * Math.PI / 180;
        if (observed) activeRegions[index].fromArray(SOLAR_OBSERVATION_REGIONS[index]);
        else activeRegions[index].set(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
        activeRegions[index].applyAxisAngle(solarNorth, offset).applyMatrix4(globe.matrixWorld);
      }
      moonOccluders[0].set(parentCenter.x, parentCenter.y, parentCenter.z, encounter.radius);
      for (let index = 0; index < 4; index++) {
        const satellite = satellites[index];
        if (!satellite) { parentOccluders[index].set(0, 0, 0, 0); continue; }
        satellite.mesh.getWorldPosition(satellite.world);
        parentOccluders[index].set(satellite.world.x, satellite.world.y, satellite.world.z, satellite.relativeRadius * encounter.radius);
      }
    },
    dispose,
  };
  } catch (error) {
    dispose();
    throw error;
  }
}
