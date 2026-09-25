import { SOLAR_SIMULATION_SECONDS_PER_SECOND } from './solarSystemCatalog';
import { getSolarSystemBody } from './orbitalMotion';

const visualDaysPerSecond = SOLAR_SIMULATION_SECONDS_PER_SECOND / 86_400;
const referenceRotationDegreesPerDay = 360 / (getSolarSystemBody('sun')!.rotationPeriodHours / 24);

/**
 * A representative visible-light photosphere, not a dated solar observation.
 * Real feature scales are retained: ~1,000 km granules and active regions with
 * spots tens of thousands of kilometres across. Subpixel structure is integrated
 * instead of enlarged into fictitious continent-sized convection cells.
 *
 * NASA references:
 * https://solarscience.msfc.nasa.gov/feature1.shtml
 * https://solarscience.msfc.nasa.gov/surface.shtml
 * https://science.nasa.gov/earth/earth-observatory/sunspots-and-the-solar-max/
 * Penumbral outflow is represented at 2 km/s, consistent with the spatially
 * averaged Evershed flow in https://ntrs.nasa.gov/citations/19950049397.
 * Differential rotation follows the compact magnetic-feature fit in
 * https://solarscience.msfc.nasa.gov/papers/hathadh/2011HathawayRightmire.pdf
 */
export const solarSunFragment = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
uniform float uTime;

float sunHash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 sunHash3(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float sunNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(mix(sunHash(i), sunHash(i + vec3(1, 0, 0)), f.x),
    mix(sunHash(i + vec3(0, 1, 0)), sunHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(sunHash(i + vec3(0, 0, 1)), sunHash(i + vec3(1, 0, 1)), f.x),
    mix(sunHash(i + vec3(0, 1, 1)), sunHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sunFilteredNoise(vec3 p, float footprint) {
  float resolved = 1. - smoothstep(.35, 1.3, footprint);
  if (resolved < .001) return .5;
  return mix(.5, sunNoise(p), resolved);
}

float granulation(vec3 p, float footprint) {
  // R_sun / 620 is 1,123 km. At ordinary full-disk framing most granules
  // physically cannot be resolved; inspecting a small patch reveals the cells.
  const float frequency = 620.;
  float resolved = 1. - smoothstep(.38, 1.55, footprint * frequency);
  if (resolved < .001) return 1.;
  // The same accelerated clock drives convection and the globe's rotation.
  // A 20 minute convective timescale becomes a fraction of a displayed second.
  float phase = uTime * ${((SOLAR_SIMULATION_SECONDS_PER_SECOND / 1200) * Math.PI * 2).toFixed(10)};
  // Slowly varying, sub-cell advection curves the intergranular lanes. These
  // are displaced ~1,000 km cells, not a second layer of giant bright granules.
  vec3 warp = vec3(sunNoise(p * 175. + vec3(1.7, 9.2, phase * .025)),
    sunNoise(p * 175. + vec3(8.3, phase * .025, 2.8)),
    sunNoise(p * 175. + vec3(phase * .025, 4.9, 7.6))) - .5;
  vec3 position = p * frequency + warp * .42;
  vec3 cell = floor(position), fraction = fract(position);
  float first = 9., second = 9., cellBrightness = 0., centreDistance = 0.;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 neighbour = vec3(float(x), float(y), float(z));
        vec3 seed = sunHash3(cell + neighbour);
        vec3 centre = .2 + .6 * seed + .065 * sin(seed * 6.2831853 + phase);
        vec3 offset = neighbour + centre - fraction;
        float geometricDistance = dot(offset, offset);
        // Changing weights expand younger upflows and contract older ones,
        // allowing neighbouring cells to replace them instead of merely wobble.
        float life = .5 + .5 * sin(phase * .47 + seed.x * 6.2831853);
        float distance = geometricDistance + .14 * life;
        if (distance < first) {
          second = first;
          first = distance;
          cellBrightness = seed.x;
          centreDistance = geometricDistance;
        } else second = min(second, distance);
      }
    }
  }
  float lane = smoothstep(.023, .18, sqrt(second) - sqrt(first));
  // Broad warm upflows separated by narrow dark sinking lanes. This remains
  // an intensity pattern on the gaseous photosphere, not raised solid terrain.
  float hotInterior = 1.10 + .07 * exp(-centreDistance * 6.)
    + .065 * (cellBrightness - .5);
  float interiorMottle = (sunFilteredNoise(p * 1700. + vec3(phase * .04, 0., 0.), footprint * 1700.) - .5) * .075;
  float intensity = mix(.62, hotInterior + interiorMottle, lane);
  return mix(1., intensity, resolved);
}

// Returns penumbral and umbral coverage plus resolved radial intensity.
vec3 spot(vec2 q, float radius, float shapeSeed, float footprint) {
  q /= radius;
  float angle = atan(q.y, q.x);
  float distance = length(q);
  float edge = max(footprint / radius * .75, .025);
  if (distance > 1.28 + edge) return vec3(0.);
  vec2 radialDirection = vec2(cos(angle), sin(angle));
  float contour = 1. + .22 * (sunNoise(vec3(radialDirection * 3., shapeSeed)) - .5)
    + .10 * (sunNoise(vec3(radialDirection * 8., shapeSeed * 2.)) - .5);
  contour += .035 * (sunFilteredNoise(vec3(q * radius * 800., shapeSeed * 5.), footprint * 800.) - .5);
  float penumbra = 1. - smoothstep(contour - edge, contour + edge, distance);
  if (penumbra < .001) return vec3(0.);
  vec2 core = q - vec2(.045 * sin(shapeSeed), .085 * cos(shapeSeed));
  float coreDistance = length(core * vec2(.95, 1.15));
  float umbralBoundary = .43 + .045 * sin(angle * 4. + shapeSeed)
    + .023 * sin(angle * 9. - shapeSeed);
  float umbra = 1. - smoothstep(umbralBoundary - edge, umbralBoundary + edge, coreDistance);
  // Anisotropic fields form twisting, interrupted radial bundles instead of
  // identical sinusoidal spokes. Direction-space sampling has no atan seam.
  float twist = angle + .045 * sin(distance * 8. + shapeSeed)
    + .026 * (sunNoise(vec3(q * 12., shapeSeed)) - .5);
  radialDirection = vec2(cos(twist), sin(twist));
  float outflow = uTime * ${((SOLAR_SIMULATION_SECONDS_PER_SECOND * 2) / 696_340).toFixed(12)} / radius;
  float along = (distance - outflow) * 5. + shapeSeed * 17.;
  float transverseFootprint = footprint / max(distance, .25);
  // Transverse structure at ~1,700, 500 and 150 km; the narrower dark cores
  // emerge only when their screen footprint can resolve them. Small and large
  // spots preserve the same physical filament scale.
  float bundles = sunFilteredNoise(vec3(radialDirection * radius * 410., along), transverseFootprint * 410.) - .5;
  float fibres = sunFilteredNoise(vec3(radialDirection * radius * 1400., along * 1.7), transverseFootprint * 1400.) - .5;
  float cores = sunFilteredNoise(vec3(radialDirection * radius * 4600., along * 2.3), transverseFootprint * 4600.) - .5;
  float filaments = bundles * .20 + fibres * .09 + cores * .035;
  // A narrow, irregular light bridge splits selected complex umbrae.
  float bridge = (1. - smoothstep(.025, .065 + edge,
    abs(q.y + .4 * sin(shapeSeed * 2.3) * q.x + .035 * sin(q.x * 12. + shapeSeed))))
    * (1. - smoothstep(.35, .62, abs(q.x)))
    * step(.62, fract(sin(shapeSeed * 12.9898) * 43758.5453));
  umbra *= 1. - bridge * .65;
  float radialIntensity = mix(-.10, .15, smoothstep(.40, 1., distance));
  return vec3(penumbra, umbra,
    (radialIntensity + filaments) * penumbra * (1. - umbra));
}

void main() {
  vec3 p = normalize(vLocalPosition);
  float mu = max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.);
  float sinLatitude2 = p.y * p.y;
  // The mesh already follows the catalogue's reference period. Advect features
  // by only the difference so the equator and high latitudes do not rotate twice.
  float rotationDegreesPerDay = 14.437 - 1.48 * sinLatitude2
    - 2.99 * sinLatitude2 * sinLatitude2;
  float angle = (rotationDegreesPerDay - ${referenceRotationDegreesPerDay.toFixed(10)})
    * uTime * ${(visualDaysPerSecond * Math.PI / 180).toFixed(12)};
  p.xz = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p.xz;
  float footprint = max(length(dFdx(p)), length(dFdy(p)));

  float penumbra = 0., umbra = 0., filament = 0., faculae = 0.;
  for (int i = 0; i < 8; i++) {
    float index = float(i);
    float longitude = 1.10 + index * 2.39996323;
    float hemisphere = mod(index, 2.) * 2. - 1.;
    float latitude = hemisphere * (.18 + .038 * mod(index * 3., 6.));
    vec3 centre = vec3(cos(latitude) * cos(longitude), sin(latitude), cos(latitude) * sin(longitude));
    vec3 east = normalize(vec3(-centre.z, 0., centre.x));
    vec3 north = cross(centre, east);
    vec3 offset = p - centre;
    // Disjoint active regions make the relatively expensive spot detail local.
    // Their shapes are representative; they do not claim a present solar epoch.
    if (dot(offset, offset) < .028) {
      vec2 q = vec2(dot(offset, east), dot(offset, north));
      float radius = .018 + .0045 * mod(index * 3., 5.);
      // Spot evolution is slow compared with convection: several days on the
      // common simulated clock. Bipolar groups retain a stable leading region.
      radius *= .94 + .06 * sin(uTime * .021 + index * 2.4);
      vec3 a = spot(q, radius, index + .61, footprint);
      float spread = .050 + .006 * mod(index, 4.);
      float secondarySize = .30 + .11 * mod(index, 5.);
      vec3 b = spot(q - vec2(spread, hemisphere * .012), radius * secondarySize, index + 4.3, footprint);
      vec3 c = spot(q - vec2(spread + .021, hemisphere * .027), radius * .34, index + 8.7, footprint);
      vec3 d = spot(q - vec2(spread * .61, hemisphere * -.009), radius * .14, index + 12.1, footprint);
      vec3 region = max(max(a, b), max(c, d));
      penumbra = max(penumbra, region.x);
      umbra = max(umbra, region.y);
      filament += a.z + b.z + c.z + d.z;
      // Bright magnetic faculae are clearest near the limb. Small-scale
      // network contrast is filtered; it never turns into a luminous halo.
      float networkResolution = 1. - smoothstep(.4, 1.5, footprint * 210.);
      float network = .65 + .35 * sunNoise(p * 210.) * networkResolution;
      float regionEnvelope = exp(-dot(q - vec2(.025, 0.), q - vec2(.025, 0.)) * 420.);
      faculae += regionEnvelope * network;
    }
  }

  float photosphere = granulation(p, footprint);
  float spotIntensity = mix(1., .49, penumbra);
  spotIntensity = mix(spotIntensity, .075, umbra);
  spotIntensity += filament;
  // Strong magnetic fields suppress ordinary granular convection inside a
  // sunspot; its penumbra has its own filamentary rather than cellular pattern.
  float brightness = mix(photosphere, 1., penumbra) * spotIntensity;
  brightness += faculae * .12 * pow(1. - mu, 1.45) * (1. - penumbra);
  // Visible continuum limb darkening, not a shaded solid sphere. A slightly
  // warm white photosphere is distinct from false-colour extreme-UV imagery.
  float limb = 1. - .47 * (1. - mu) - .23 * (1. - mu) * (1. - mu);
  vec3 colour = mix(vec3(1., .985, .965), vec3(1., .76, .49), umbra * .8);
  // Modest HDR headroom activates optical glare while leaving active-region
  // contrast below the tone-mapping shoulder. The view is exposure-compressed.
  gl_FragColor = vec4(colour * 1.30 * limb * max(brightness, .03), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
