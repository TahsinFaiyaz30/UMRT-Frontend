/**
 * Analytic materials in object-space. No image maps, billboards or screen-space
 * impostors: the inputs are closed meshes or bounded three-dimensional media.
 * These are physically inspired visual models, not scientific simulations.
 */
export const noise3D = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                   mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                   mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  const mat3 octaveRotation = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);
  float fbm(vec3 p) {
    float a = 0.5, sum = 0.0;
    for (int i = 0; i < 5; i++) {
      sum += a * noise3(p);
      p = octaveRotation * p * 2.07 + 13.17;
      a *= 0.5;
    }
    return sum;
  }
  vec2 sphereInterval(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd), c = dot(ro, ro) - radius * radius;
    float d = b * b - c;
    if (d < 0.0) return vec2(1e5, -1e5);
    d = sqrt(d);
    return vec2(-b - d, -b + d);
  }
`;

export const surfaceVertex = /* glsl */ `
  varying vec3 vObject;
  varying vec3 vNormal;
  void main() {
    vObject = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const surfaceFragment = /* glsl */ `
  precision highp float;
  uniform float uSeed, uTime, uOcean, uRings;
  uniform vec3 uCameraLocal, uSunLocal, uColorA, uColorB, uColorC;
  varying vec3 vObject;
  varying vec3 vNormal;
  ${noise3D}

  // Integrate detail against its projected pixel footprint. This is spatial
  // anti-aliasing, not a device quality tier: every device uses the same
  // octaves, geometry and thresholds. Resolved detail remains full strength.
  float filteredNoise(vec3 p, float footprint) {
    return mix(noise3(p), 0.5, smoothstep(0.25, 0.90, footprint));
  }
  float filteredFbm(vec3 p, float footprint) {
    float amplitude = 0.5, sum = 0.0;
    for (int i = 0; i < 5; i++) {
      float unresolved = smoothstep(0.25, 0.90, footprint);
      sum += amplitude * mix(noise3(p), 0.5, unresolved);
      p = octaveRotation * p * 2.07 + 13.17;
      footprint *= 2.07;
      amplitude *= 0.5;
    }
    return sum;
  }
  float filteredSin(float phase, float footprint) {
    return sin(phase) * exp(-0.045 * footprint * footprint);
  }

  // Crater sites occupy a 3D lattice projected onto the spherical surface.
  // Rim, bowl and ejecta are continuous heights, so the derivative normal also
  // contains the craters; this is not a decal or an image of a crater.
  #if SURFACE_KIND == 1 || SURFACE_KIND == 4
  vec2 craterField(vec3 p, float frequency, float pixelFootprint) {
    vec3 grid = floor(p * frequency);
    float footprint = pixelFootprint * frequency;
    float height = 0.0, ejecta = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 cell = grid + vec3(float(x), float(y), float(z));
          vec3 rnd = hash33(cell + uSeed);
          vec3 site = cell + rnd;
          float radialOffset = abs(length(site) - frequency);
          if (radialOffset < 0.40 && rnd.z > 0.38) {
            float size = mix(0.19, 0.57, rnd.x);
            float d = length(p - normalize(site)) * frequency / size;
            float resolved = 1.0 - smoothstep(0.35, 1.2, footprint / size);
            float rimWidth = max(0.111, footprint / size * 0.7);
            float rim = exp(-pow((d - 1.0) / rimWidth, 2.0)) * 0.17 * 0.111 / rimWidth;
            float bowl = -0.25 * (1.0 - smoothstep(0.0, 0.94, d));
            float peak = exp(-d * d * 120.0) * 0.08 * step(0.4, size);
            height += (rim + bowl + peak) * size / frequency * resolved;
            ejecta += exp(-pow((d - 1.08) * 2.7, 2.0)) * 0.18 * resolved;
          }
        }
      }
    }
    return vec2(height, ejecta);
  }
  #endif

  vec3 reliefNormal(vec3 normalDirection, float height) {
    vec3 dx = dFdx(vObject), dy = dFdy(vObject);
    vec3 a = cross(dy, normalDirection), b = cross(normalDirection, dx);
    float det = dot(dx, a);
    vec3 gradient = sign(det) * (dFdx(height) * a + dFdy(height) * b);
    return normalize(abs(det) * normalDirection - gradient);
  }

  void main() {
    vec3 p = normalize(vObject);
    // One derivative calculation for all procedural frequencies; filters never
    // differentiate other filters (problematic for some GPU driver compilers).
    float pixelFootprint = max(length(dFdx(p)), length(dFdy(p)));
    vec3 seed = vec3(uSeed * 0.073, uSeed * 0.029, uSeed * 0.047);
    vec3 viewDirection = normalize(uCameraLocal - vObject);
    vec3 lightDirection = normalize(uSunLocal);
    vec3 normalDirection = normalize(vNormal);
    vec3 albedo = uColorA;
    float height = 0.0, roughness = 0.94, water = 0.0;

    #if SURFACE_KIND == 0
    {
      vec3 warped = p * 1.65 + seed;
      warped += vec3(filteredFbm(p * 2.0 + seed, pixelFootprint * 2.0), filteredFbm(p * 2.0 + seed + 9.0, pixelFootprint * 2.0), filteredFbm(p * 2.0 + seed + 21.0, pixelFootprint * 2.0)) * 0.55;
      float regional = filteredFbm(warped, pixelFootprint * 2.8);
      float plains = smoothstep(0.46, 0.65, filteredFbm(p * 2.7 + seed + 17.0, pixelFootprint * 2.7));
      float rock = filteredFbm(p * 55.0 + seed, pixelFootprint * 55.0);
      float mountains = filteredFbm(p * 14.0 + seed, pixelFootprint * 14.0);
      // Mineral color changes are broad and restrained. Fine regolith belongs
      // mostly in the relief, rather than high-contrast camouflage patches.
      albedo = uColorB * mix(0.80, 1.08, smoothstep(0.20, 0.75, regional));
      albedo = mix(albedo, mix(uColorA, uColorB, 0.38), plains * 0.48);
      albedo = mix(albedo, uColorC, smoothstep(0.43, 0.69, regional) * 0.055);
      albedo *= 0.975 + rock * 0.05;
      float land = smoothstep(0.43, 0.465, regional);
      water = (1.0 - land) * uOcean;
      vec3 ocean = vec3(0.006, 0.022, 0.042);
      ocean = mix(ocean, vec3(0.012, 0.065, 0.077), smoothstep(0.40, 0.44, regional));
      albedo = mix(albedo, ocean, water);
      float ice = smoothstep(0.978, 0.997, abs(p.y) + (mountains - 0.5) * 0.003);
      albedo = mix(albedo, vec3(0.55, 0.57, 0.55), ice * 0.88);
      height = (1.0 - water) * (regional * 0.0012 + mountains * 0.0008 + rock * 0.00012);
      roughness = mix(0.19, 0.95, max(1.0 - water, ice));
    }
    #elif SURFACE_KIND == 1 || SURFACE_KIND == 4
    {
      float regional = filteredFbm(p * 3.5 + seed, pixelFootprint * 3.5);
      float fine = filteredFbm(p * 105.0 + seed, pixelFootprint * 105.0);
      vec2 craters = craterField(p, 9.0, pixelFootprint) + craterField(p, 29.0, pixelFootprint) * vec2(0.52, 0.60);
      albedo = mix(uColorA, uColorB, smoothstep(0.26, 0.67, regional));
      albedo = mix(albedo, uColorC, smoothstep(0.51, 0.74, filteredFbm(p * 14.0 + seed, pixelFootprint * 14.0)) * 0.48);
      albedo *= 0.74 + fine * 0.42 + craters.y;
      height = craters.x + (regional - 0.5) * 0.010 + (fine - 0.5) * 0.0014;
    }
    #elif SURFACE_KIND == 2 || SURFACE_KIND == 3
    {
      float turbulence = filteredFbm(p * vec3(7.0, 12.0, 7.0) + seed, pixelFootprint * 12.0);
      float latitude = p.y * 38.0 + turbulence * 3.8;
      float band = filteredSin(latitude, pixelFootprint * 50.0) * 0.5 + 0.5;
      float fineBand = filteredSin(latitude * 3.3 + filteredNoise(p * 65.0 + seed, pixelFootprint * 65.0) * 2.5, pixelFootprint * 165.0) * 0.5 + 0.5;
      float clouds = filteredFbm(p * 37.0 + vec3(turbulence * 1.8) + seed, pixelFootprint * 48.0);
      vec3 stormDirection = normalize(vec3(sin(uSeed * 0.7), -0.27, cos(uSeed * 0.7)));
      float stormDistance = length((p - stormDirection) * vec3(1.0, 2.4, 1.0));
      float storm = exp(-stormDistance * stormDistance * 85.0);
      float swirl = filteredSin(atan(p.y - stormDirection.y, p.x - stormDirection.x) * 3.0 - stormDistance * 75.0 + clouds * 8.0, pixelFootprint * 100.0);
      float pattern = band * 0.68 + fineBand * 0.12 + clouds * 0.20;
      albedo = mix(uColorA, uColorB, smoothstep(0.20, 0.85, pattern));
      albedo = mix(albedo, uColorC, storm * (0.4 + 0.16 * swirl));
      #if SURFACE_KIND == 3
      albedo = mix(mix(uColorA, uColorB, (p.y + 1.0) * 0.5), albedo, 0.29);
      #endif
      albedo *= 0.88 + clouds * 0.24;
      height = (fineBand + clouds) * 0.0002;
    }
    #else
    {
      // Convective granulation is a 3D density pattern over the stellar sphere.
      float slow = uTime * 0.009;
      float granules = filteredNoise(p * 140.0 + seed + vec3(slow), pixelFootprint * 140.0);
      float cells = filteredFbm(p * 24.0 + seed - vec3(slow * 0.7), pixelFootprint * 24.0);
      float lanes = smoothstep(0.19, 0.55, granules);
      float spots = 1.0 - smoothstep(0.23, 0.34, filteredFbm(p * 9.0 + seed, pixelFootprint * 9.0));
      float limb = 0.30 + 0.70 * pow(max(dot(normalDirection, viewDirection), 0.0), 0.52);
      vec3 color = mix(uColorA, uColorB, cells * 0.65 + lanes * 0.35);
      color *= (2.3 + lanes * 1.1) * (1.0 - spots * 0.73) * limb;
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }
    #endif

    normalDirection = reliefNormal(normalDirection, height);
    float nl = max(dot(normalDirection, lightDirection), 0.0);
    float nv = max(dot(normalDirection, viewDirection), 0.001);
    vec3 halfway = normalize(lightDirection + viewDirection);
    float nh = max(dot(normalDirection, halfway), 0.0);
    float vh = max(dot(viewDirection, halfway), 0.0);
    float a2 = pow(roughness, 4.0);
    float denominator = nh * nh * (a2 - 1.0) + 1.0;
    float distribution = a2 / max(3.14159265 * denominator * denominator, 0.0001);
    float k = pow(roughness + 1.0, 2.0) / 8.0;
    float geometry = nl / (nl * (1.0 - k) + k) * nv / (nv * (1.0 - k) + k);
    float fresnel = 0.025 + 0.975 * pow(1.0 - vh, 5.0);
    float specular = distribution * geometry * fresnel / max(4.0 * nl * nv, 0.001);
    float ringVisibility = 1.0;
    if (uRings > 0.5 && abs(lightDirection.y) > 0.001) {
      float ringHit = -vObject.y / lightDirection.y;
      float ringRadius = length((vObject + lightDirection * ringHit).xz);
      float ringFootprint = fwidth(ringRadius);
      float band = filteredNoise(vec3(ringRadius * 45.0, uSeed, 2.0), ringFootprint * 45.0) * 0.65
        + filteredNoise(vec3(ringRadius * 155.0, uSeed, 2.0), ringFootprint * 155.0) * 0.35;
      if (ringHit > 0.0 && ringRadius > 1.30 && ringRadius < 2.55) {
        float gap = 1.0 - smoothstep(0.023, 0.030, abs(ringRadius - 2.16));
        ringVisibility = 1.0 - (0.40 + band * 0.48) * (1.0 - gap * 0.96);
      }
    }
    vec3 color = albedo * (nl * ringVisibility * 2.2 + 0.003) + vec3(specular * nl * ringVisibility * 1.9);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const volumeFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCameraLocal, uSunLocal, uTint;
  uniform float uSeed, uTime, uClouds, uStar, uOuter, uScaleHeight, uDensity;
  varying vec3 vObject;
  ${noise3D}
  void main() {
    vec3 ro = uCameraLocal;
    vec3 rd = normalize(vObject - ro);
    vec2 bounds = sphereInterval(ro, rd, uOuter);
    float start = max(bounds.x, 0.0), finish = bounds.y;
    vec2 solid = sphereInterval(ro, rd, 1.0);
    if (solid.x > 0.0) finish = min(finish, solid.x);
    if (finish <= start) discard;
    float stepSize = (finish - start) / 36.0;
    float transmittance = 1.0;
    vec3 radiance = vec3(0.0);
    float mu = dot(rd, normalize(uSunLocal));
    float rayleighPhase = 0.0596831 * (1.0 + mu * mu);
    float miePhase = 0.015 / pow(max(1.62 - 1.56 * mu, 0.03), 1.5);
    for (int i = 0; i < 36; i++) {
      vec3 p = ro + rd * (start + (float(i) + 0.5) * stepSize);
      float altitude = length(p) - 1.0;
      float density = exp(-max(altitude, 0.0) / uScaleHeight) * (1.0 - smoothstep(uOuter - uScaleHeight, uOuter, length(p)));
      vec2 shadow = sphereInterval(p, normalize(uSunLocal), 1.0);
      float daylight = (shadow.x > 0.0001 && shadow.y > 0.0) ? 0.0 : 1.0;
      float lightDepth = 0.0;
      vec2 toSpace = sphereInterval(p, normalize(uSunLocal), uOuter);
      float lightStep = max(toSpace.y, 0.0) / 4.0;
      for (int j = 0; j < 4; j++) {
        float h = length(p + normalize(uSunLocal) * ((float(j) + 0.5) * lightStep)) - 1.0;
        lightDepth += exp(-max(h, 0.0) / uScaleHeight) * lightStep;
      }
      float sunTransmission = exp(-lightDepth * uDensity * 1.5);
      float cloud = 0.0;
      if (uClouds > 0.5 && altitude < 0.033) {
        float field = fbm(normalize(p) * 11.0 + vec3(uSeed * 0.07, uTime * 0.003, 0.0));
        cloud = smoothstep(0.48, 0.65, field) * exp(-pow((altitude - 0.017) / 0.008, 2.0)) * 48.0;
      }
      float extinction = density * uDensity + cloud;
      vec3 source = uTint * (rayleighPhase * 14.0 + miePhase * 2.5) * density * uDensity * daylight * sunTransmission;
      source += vec3(0.88, 0.90, 0.91) * cloud * (0.03 + daylight * sunTransmission * 1.6);
      if (uStar > 0.5) {
        float stream = 0.60 + 0.40 * noise3(normalize(p) * 34.0 + uSeed);
        extinction = exp(-altitude / 0.032) * 5.0 * stream;
        source = uTint * extinction * 2.8;
      }
      float alpha = 1.0 - exp(-extinction * stepSize);
      radiance += transmittance * source / max(extinction, 0.0001) * alpha;
      transmittance *= 1.0 - alpha;
    }
    float alpha = 1.0 - transmittance;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(radiance / max(alpha, 0.0001), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const ringFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCameraLocal, uSunLocal, uColorA, uColorB;
  uniform float uSeed;
  varying vec3 vObject;
  varying vec3 vNormal;
  ${noise3D}
  float ringNoise(vec3 p) {
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    return mix(noise3(p), 0.5, smoothstep(0.25, 0.90, footprint));
  }
  void main() {
    float radius = length(vObject.xz);
    float footprint = fwidth(radius);
    float bands = ringNoise(vec3(radius * 45.0, uSeed, 2.0)) * 0.65 + ringNoise(vec3(radius * 155.0, uSeed, 2.0)) * 0.35;
    float fine = ringNoise(vec3(radius * 1200.0, uSeed, 5.0));
    float gap = 1.0 - smoothstep(max(0.023 - footprint, 0.0), 0.030 + footprint, abs(radius - 2.16));
    float gap2 = 1.0 - smoothstep(max(0.008 - footprint, 0.0), 0.014 + footprint, abs(radius - 2.40));
    float density = (0.36 + bands * 0.48 + fine * 0.13) * (1.0 - gap * 0.96) * (1.0 - gap2 * 0.86);
    density *= smoothstep(1.30, 1.38, radius) * (1.0 - smoothstep(2.48, 2.55, radius));
    vec3 lightDirection = normalize(uSunLocal);
    vec2 shadow = sphereInterval(vObject, lightDirection, 1.01);
    float lit = shadow.x > 0.0 && shadow.y > 0.0 ? 0.025 : 1.0;
    float incidence = 0.20 + 0.80 * abs(lightDirection.y);
    vec3 color = mix(uColorA, uColorB, bands) * lit * incidence * 1.8;
    color *= 0.91 + ringNoise(vObject * 330.0 + uSeed) * 0.18;
    gl_FragColor = vec4(color, density);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export { blackHoleFragment } from './blackHoleShader';

export const cometTailFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCameraLocal, uTint;
  uniform float uSeed, uTime, uDust;
  varying vec3 vObject;
  ${noise3D}
  void main() {
    vec3 ro = uCameraLocal, rd = normalize(vObject - ro);
    vec2 bounds = sphereInterval(ro, rd, 1.0);
    float start = max(bounds.x, 0.0), stepSize = (bounds.y - start) / 32.0;
    if (stepSize <= 0.0) discard;
    float opticalDepth = 0.0;
    for (int i = 0; i < 32; i++) {
      vec3 p = ro + rd * (start + (float(i) + 0.5) * stepSize);
      float along = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);
      float width = 0.08 + along * mix(0.12, 0.46, uDust);
      vec2 center = vec2(uDust * 0.33 * along * along, 0.0);
      float radial = length(p.xy - center) / width;
      float variation = noise3(p * vec3(20.0, 20.0, 6.0) + vec3(uSeed, 0.0, -uTime * 0.04));
      float density = exp(-radial * radial * 2.0) * pow(1.0 - along, 1.3);
      density *= smoothstep(0.0, 0.07, along) * (0.70 + variation * 0.30);
      opticalDepth += density * stepSize * mix(0.8, 1.8, uDust);
    }
    float alpha = 1.0 - exp(-opticalDepth);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uTint * 1.4, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const grainVertex = /* glsl */ `
  varying vec3 vGrainNormal;
  void main() {
    mat3 transform = mat3(instanceMatrix);
    vec3 scaleSquared = vec3(dot(transform[0], transform[0]), dot(transform[1], transform[1]), dot(transform[2], transform[2]));
    vGrainNormal = normalize(transform * (normal / scaleSquared));
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const grainFragment = /* glsl */ `
  uniform vec3 uSunLocal, uColorA;
  varying vec3 vGrainNormal;
  void main() {
    float light = max(dot(normalize(vGrainNormal), normalize(uSunLocal)), 0.0);
    gl_FragColor = vec4(uColorA * (light * 1.8 + 0.025), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
