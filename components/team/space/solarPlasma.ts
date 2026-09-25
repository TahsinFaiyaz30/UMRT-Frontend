import * as THREE from 'three';
import { SOLAR_SIMULATION_SECONDS_PER_SECOND } from './solarSystemCatalog';
import { getSolarSystemBody } from './orbitalMotion';

const vertex = /* glsl */ `
varying vec3 vLocalPosition;
void main() {
  vLocalPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fragment = /* glsl */ `
uniform mat4 uWorldToLocal;
uniform float uTime;
uniform float uSeed;
uniform float uSpan;
uniform float uHeight;
varying vec3 vLocalPosition;

float hash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Units are solar radii. The volume is a curved, clumpy magnetic sheet with
// flowing fine threads inside it; its bounding box never contributes colour.
float density(vec3 p) {
  float along = p.x / uSpan;
  float ends = 1. - smoothstep(.88, 1.10, abs(along));
  if (ends <= 0.) return 0.;
  float arch = sqrt(max(1. - along * along, 0.));
  float angle = atan(along, max(arch, .025));
  float bend = .004 * sin(angle * 3. + uSeed) * arch;
  float altitude = p.y + .5 * dot(p.xz, p.xz);
  float crest = uHeight * arch;
  float crossFlow = .0022 * sin(angle * 9. - uTime * .19 + uSeed);
  vec3 flow = vec3(angle * 7. - uTime * .075,
                   (altitude - crest + crossFlow) * 105.,
                   (p.z - bend) * 125.) + uSeed;
  float cloud = noise(flow);
  float fine = noise(flow * 2.63 + vec3(0., uTime * .025, 7.));
  float ribbon = (altitude - crest - (cloud - .5) * .015) / .010;
  float thickness = (p.z - bend - (fine - .5) * .008) / .011;
  float canopy = exp(-ribbon * ribbon - thickness * thickness);
  // Fainter suspended material breaks the regular outline of the main arc.
  float curtainY = (altitude - crest * .68) / .022;
  float curtainZ = (p.z - bend) / .015;
  float curtain = exp(-curtainY * curtainY - curtainZ * curtainZ)
    * smoothstep(.37, .79, cloud) * .30;
  float threads = .25 + .75 * smoothstep(.27, .76, fine);
  float aboveSurface = smoothstep(.995, 1.004, length(p + vec3(0., 1., 0.)));
  return (canopy * threads + curtain) * ends * aboveSurface;
}

void main() {
  vec3 origin = (uWorldToLocal * vec4(cameraPosition, 1.)).xyz;
  vec3 ray = normalize(vLocalPosition - origin);
  // A closed box bounds each local 3D density field. Trace it in local units
  // so distance, camera angle and parent scale cannot change its opacity.
  vec3 safeRay = mix(vec3(.000001), ray, step(vec3(.000001), abs(ray)));
  vec3 first = (vec3(-.15, -.019, -.032) - origin) / safeRay;
  vec3 last = (vec3(.15, .129, .032) - origin) / safeRay;
  vec3 nearPlane = min(first, last), farPlane = max(first, last);
  float enter = max(max(nearPlane.x, nearPlane.y), max(nearPlane.z, 0.));
  float leave = min(min(farPlane.x, farPlane.y), farPlane.z);

  // The opaque Sun has centre (0,-1,0) and radius 1 in every volume's frame.
  // Stop at its near surface; far-side prominences cannot bleed through it.
  vec3 fromSun = origin + vec3(0., 1., 0.);
  float b = dot(fromSun, ray);
  float discriminant = b * b - dot(fromSun, fromSun) + 1.;
  float diskBehind = 0.;
  if (discriminant > 0.) {
    float solarSurface = -b - sqrt(discriminant);
    if (solarSurface > 0.) {
      leave = min(leave, solarSurface);
      diskBehind = 1.;
    }
  }
  if (leave <= enter) discard;

  const int STEPS = 48;
  float stepLength = (leave - enter) / float(STEPS);
  vec3 radiance = vec3(0.);
  float transmission = 1.;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = origin + ray * (enter + (float(i) + .5) * stepLength);
    float amount = density(p);
    float opacity = 1. - exp(-amount * stepLength * 118.);
    // Cool plasma emits orange/red off the limb and absorbs the brighter
    // background disk. This is a representative EUV prominence simulation.
    vec3 glow = mix(vec3(1.35, .055, .006), vec3(3.0, .44, .045), amount);
    vec3 source = mix(glow, vec3(.035, .0025, .0003), diskBehind * .94);
    radiance += transmission * opacity * source;
    transmission *= 1. - opacity;
    if (transmission < .015) break;
  }
  float opacity = 1. - transmission;
  if (opacity < .003) discard;
  gl_FragColor = vec4(radiance / max(opacity, .001), opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export type SolarPlasma = {
  group: THREE.Group;
  update: (time: number, enabled: boolean) => void;
  dispose: () => void;
};

/**
 * Three local, ray-integrated plasma volumes on a rotating unit-radius Sun.
 * This is a representative EUV simulation, not a recovered 3D observation.
 * Compact sheets rise ~45,000–73,000 km; no billboards or wire geometry.
 * Fixed cost: one shared closed box, three materials, 48 samples per ray.
 */
export function createSolarPlasma(): SolarPlasma {
  const group = new THREE.Group();
  group.name = 'Sun magnetic prominence volumes';
  const geometry = new THREE.BoxGeometry(.30, .148, .064);
  geometry.translate(0, .055, 0);
  const materials: THREE.ShaderMaterial[] = [];
  const bundles: { group: THREE.Group; latitude: number; mesh: THREE.Mesh }[] = [];
  const north = new THREE.Vector3(0, 1, 0);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const entry of bundles) {
      entry.mesh.onBeforeRender = () => undefined;
      entry.group.clear();
    }
    group.clear();
    geometry.dispose();
    for (const material of materials) material.dispose();
    materials.length = 0;
    bundles.length = 0;
  };

  try {
    const regions = [
      { longitude: .08, latitude: .22, span: .088, height: .080, azimuth: .28 },
      { longitude: 2.32, latitude: -.33, span: .108, height: .105, azimuth: -.38 },
      { longitude: 4.51, latitude: .39, span: .075, height: .066, azimuth: .65 },
    ];
    for (let index = 0; index < regions.length; index++) {
      const region = regions[index];
      const radial = new THREE.Vector3(
        Math.cos(region.latitude) * Math.cos(region.longitude),
        Math.sin(region.latitude),
        Math.cos(region.latitude) * Math.sin(region.longitude),
      );
      const east = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
      const localNorth = new THREE.Vector3().crossVectors(radial, east).normalize();
      const across = east.multiplyScalar(Math.cos(region.azimuth))
        .addScaledVector(localNorth, Math.sin(region.azimuth));
      const side = new THREE.Vector3().crossVectors(across, radial).normalize();
      const material = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uWorldToLocal: { value: new THREE.Matrix4() },
          uTime: { value: 0 },
          uSeed: { value: 3.7 + index * 7.13 },
          uSpan: { value: region.span },
          uHeight: { value: region.height },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `Solar prominence volume ${index + 1}`;
      mesh.position.copy(radial);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, radial, side));
      mesh.renderOrder = 2;
      mesh.onBeforeRender = () => {
        material.uniforms.uWorldToLocal.value.copy(mesh.matrixWorld).invert();
      };
      const bundle = new THREE.Group();
      bundle.add(mesh);
      group.add(bundle);
      bundles.push({ group: bundle, latitude: region.latitude, mesh });
    }
  } catch (error) {
    dispose();
    throw error;
  }

  const referenceRate = 360 / (getSolarSystemBody('sun')!.rotationPeriodHours / 24);
  return {
    group,
    update(time, enabled) {
      if (disposed) return;
      group.visible = enabled;
      if (!enabled) return;
      const simulatedDays = time * SOLAR_SIMULATION_SECONDS_PER_SECOND / 86_400;
      for (const entry of bundles) {
        const sinSquared = Math.sin(entry.latitude) ** 2;
        const rate = 14.437 - 1.48 * sinSquared - 2.99 * sinSquared ** 2;
        entry.group.quaternion.setFromAxisAngle(north, (rate - referenceRate) * simulatedDays * Math.PI / 180);
      }
      for (const material of materials) material.uniforms.uTime.value = time;
    },
    dispose,
  };
}

