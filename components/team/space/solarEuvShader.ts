import { SOLAR_SIMULATION_SECONDS_PER_SECOND } from './solarSystemCatalog';
import { getSolarSystemBody } from './orbitalMotion';

const daysPerSecond = SOLAR_SIMULATION_SECONDS_PER_SECOND / 86_400;
const referenceRate = 360 / (getSolarSystemBody('sun')!.rotationPeriodHours / 24);

/** Historical SDO/AIA 304 Å observations reprojected onto the rotating sphere.
 * The orange palette is the instrument's false colour. Brightness is emission,
 * not terrain elevation; adding noisy relief would invent solar topography.
 */
export const solarEuvFragment = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
uniform float uTime;
uniform sampler2D uSolarObservation;

void main() {
  vec3 p = normalize(vLocalPosition);
  float sinSquared = p.y * p.y;
  float rate = 14.437 - 1.48 * sinSquared - 2.99 * sinSquared * sinSquared;
  float angle = (rate - ${referenceRate.toFixed(10)}) * uTime * ${(daysPerSecond * Math.PI / 180).toFixed(12)};
  p.xz = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p.xz;
  // Same UV convention as SphereGeometry, including a continuous longitude
  // seam. textureGrad keeps the seam's wrap out of mip-level derivatives.
  vec2 uv = vec2(atan(p.z, -p.x) / 6.28318530718, asin(clamp(p.y, -1., 1.)) / 3.14159265359 + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  dx.x -= floor(dx.x + .5); dy.x -= floor(dy.x + .5);
  vec3 observed = textureGrad(uSolarObservation, uv, dx, dy).rgb;
  float mu = max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.);
  // A restrained display exposure retains dark filaments and resolves bright
  // active regions. Their HDR emission drives the existing optical bloom;
  // neither a white outline nor a screen-facing glow plane is added here.
  float activeEmission = smoothstep(.13, .62, observed.g);
  float exposure = 2.5 + activeEmission * 1.4;
  float envelope = .84 + .16 * sqrt(mu);
  float evolution = 1. + .012 * sin(uTime * .09 + p.y * 7. + p.x * 3.);
  gl_FragColor = vec4(observed * exposure * envelope * evolution, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
