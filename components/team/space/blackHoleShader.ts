/**
 * A finite, three-dimensional accretion volume. Light follows the Schwarzschild
 * orbit equation in its orbital plane; emissivity is integrated along the bent
 * segments, so the secondary disk image is produced by the rays themselves.
 *
 * This is a bounded visual model, not a GRMHD calculation. It omits spacetime
 * spin, light bending outside this volume and lensing of other scene meshes.
 * Temperatures/exposure and the clock are chosen to make the flow observable.
 * Reference: https://svs.gsfc.nasa.gov/13326/
 */
export const blackHoleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCameraLocal;
  uniform float uTime, uSeed;
  varying vec3 vObject;

  const float HORIZON = 0.62;
  const float INNER_DISK = 1.86;
  const float OUTER_DISK = 4.45;
  const float BOUND = 4.6;

  float bhHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float bhNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(mix(bhHash(i), bhHash(i + vec3(1,0,0)), f.x),
                   mix(bhHash(i + vec3(0,1,0)), bhHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bhHash(i + vec3(0,0,1)), bhHash(i + vec3(1,0,1)), f.x),
                   mix(bhHash(i + vec3(0,1,1)), bhHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float filteredNoise(vec3 p, float footprint) {
    return mix(bhNoise(p), 0.5, smoothstep(0.30, 1.05, footprint));
  }

  // Stable integral of the disk's Gaussian height distribution. Integrating
  // across each ray segment keeps a thin disk resolved even at grazing angles;
  // fixed point samples otherwise miss it and create concentric stair-steps.
  float erfApprox(float value) {
    float x = abs(value);
    float t = 1.0 / (1.0 + 0.3275911 * x);
    float polynomial = (((((1.061405429 * t - 1.453152027) * t)
      + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign(value) * (1.0 - polynomial * exp(-x * x));
  }
  vec2 verticalIntegral(float y0, float y1, float height, float distance) {
    float difference = y1 - y0;
    if (abs(difference) < height * 0.025) {
      float middle = (y0 + y1) * 0.5 / height;
      return vec2(exp(-middle * middle) * distance, 0.5);
    }
    float first = y0 / height, second = y1 / height;
    float integralY = 0.886226925 * height * (erfApprox(second) - erfApprox(first));
    float column = max(0.0, integralY * distance / difference);
    float sampleT = 0.5;
    if (abs(integralY) > 0.000001) {
      float meanHeight = height * height * 0.5
        * (exp(-first * first) - exp(-second * second)) / integralY;
      sampleT = clamp((meanHeight - y0) / difference, 0.0, 1.0);
    }
    return vec2(column, sampleT);
  }

  // Approximate visible blackbody colour, converted to scene-linear RGB.
  // Relativistic frequency shift changes colour as well as radiance.
  vec3 thermalColour(float kelvin) {
    float temperature = clamp(kelvin, 1900.0, 18000.0) * 0.01;
    vec3 colour;
    colour.r = temperature <= 66.0 ? 1.0
      : 1.292936 * pow(temperature - 60.0, -0.133205);
    colour.g = temperature <= 66.0
      ? 0.390082 * log(temperature) - 0.631841
      : 1.129891 * pow(temperature - 60.0, -0.075515);
    colour.b = temperature >= 66.0 ? 1.0
      : 0.543207 * log(max(temperature - 10.0, 1.0)) - 1.196254;
    return pow(clamp(colour, 0.0, 1.0), vec3(2.2));
  }

  float flowCohort(float angle, float radius, float angularSpeed, float age,
    float epoch, float footprint) {
    float phase = angle - age * angularSpeed;
    vec3 flow = vec3(cos(phase) * 6.0, sin(phase) * 6.0, radius * 4.0);
    float cohortSeed = bhHash(vec3(mod(epoch, 4096.0), floor(epoch / 4096.0), uSeed)) * 91.7;
    flow += vec3(uSeed * 0.017, uSeed * 0.021, uSeed * 0.013)
      + vec3(cohortSeed * 0.7, cohortSeed, cohortSeed * 0.5);
    // Account for the radial derivative of differential rotation as well as
    // the unwarped pixel footprint. Old, stretched knots need a wider filter.
    float shear = 1.5 * angularSpeed * age / max(radius, INNER_DISK);
    float baseFootprint = footprint * (6.0 + shear * 6.0);
    float wide = filteredNoise(flow, baseFootprint);
    float middle = filteredNoise(flow * vec3(1.71, 1.71, 2.07) + 17.3,
      baseFootprint * 2.07);
    float fine = filteredNoise(flow * vec3(3.61, 3.61, 4.11) + 41.7,
      baseFootprint * 4.11);
    return 0.62 * wide + 0.27 * middle + 0.11 * fine;
  }

  vec3 diskSource(vec3 p, vec3 rayDirection, float footprint, out float opacity) {
    float radius = length(p.xz);
    float boundary = smoothstep(INNER_DISK, INNER_DISK + 0.13, radius)
      * (1.0 - smoothstep(4.04, OUTER_DISK, radius));
    float angle = atan(p.z, p.x);
    // Circular Keplerian speed: inner gas shears past the outer flow. The
    // visible clock is accelerated; the relative radial speed is preserved.
    float angularSpeed = 1.05 * pow(INNER_DISK / max(radius, INNER_DISK), 1.5);
    // Magnetic knots form and dissipate; they do not wind into infinitely
    // fine threads as the page stays open. Overlapping cohorts have zero
    // weight at birth/death, with fresh seeds and no visible reset or loop.
    float firstAge = mod(uTime, 6.0);
    float secondAge = mod(uTime + 3.0, 6.0);
    float blend = 0.5 - 0.5 * cos(firstAge * 1.0471975512);
    float firstFlow = flowCohort(angle, radius, angularSpeed, firstAge,
      floor(uTime / 6.0), footprint);
    float secondFlow = flowCohort(angle, radius, angularSpeed, secondAge,
      floor((uTime + 3.0) / 6.0) + 0.37, footprint);
    // Turbulent elongated knots, not a stack of uniformly spaced rings.
    float flowDetail = mix(secondFlow, firstFlow, blend);
    float filaments = smoothstep(0.22, 0.79, flowDetail);
    opacity = boundary * (11.0 + filaments * 12.0);

    // Zero-torque thin-disk temperature profile, with the innermost stable
    // circular orbit at exactly three Schwarzschild radii.
    float ratio = INNER_DISK / max(radius, INNER_DISK + 0.0001);
    float heat = pow(max(pow(ratio, 3.0) * (1.0 - sqrt(ratio)), 0.0), 0.25) / 0.488;
    vec3 tangent = normalize(vec3(-p.z, 0.0, p.x));
    float beta = sqrt(HORIZON / (2.0 * max(radius - HORIZON, 0.001)));
    float doppler = sqrt(max(1.0 - beta * beta, 0.01))
      / max(1.0 + beta * dot(tangent, rayDirection), 0.20);
    float gravitationalShift = sqrt(max(1.0 - HORIZON / length(p), 0.01));
    float shift = doppler * gravitationalShift;
    vec3 temperature = thermalColour((2300.0 + heat * 3400.0) * shift);
    float intensity = (0.065 + 0.52 * heat * heat * heat * heat)
      * pow(shift, 3.0) * (0.20 + filaments * 1.25);
    return temperature * intensity;
  }

  // u = 1/r, v = du/dphi. This is the Schwarzschild null-orbit equation,
  // integrated with RK4 rather than repeatedly renormalising Euler velocity.
  float orbitAcceleration(float u) { return -u + 1.5 * HORIZON * u * u; }
  vec2 advanceOrbit(vec2 orbit, float stepAngle) {
    vec2 k1 = vec2(orbit.y, orbitAcceleration(orbit.x));
    vec2 a = orbit + k1 * (stepAngle * 0.5);
    vec2 k2 = vec2(a.y, orbitAcceleration(a.x));
    a = orbit + k2 * (stepAngle * 0.5);
    vec2 k3 = vec2(a.y, orbitAcceleration(a.x));
    a = orbit + k3 * stepAngle;
    vec2 k4 = vec2(a.y, orbitAcceleration(a.x));
    return orbit + stepAngle / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
  }

  void main() {
    vec3 ro = uCameraLocal;
    vec3 incoming = normalize(vObject - ro);
    float rayFootprint = max(length(dFdx(incoming)), length(dFdy(incoming)));
    float closest = dot(ro, incoming);
    float discriminant = closest * closest - dot(ro, ro) + BOUND * BOUND;
    if (discriminant < 0.0) discard;
    float entry = max(-closest - sqrt(discriminant), 0.0);
    vec3 p = ro + incoming * (entry + 0.0001);
    float impact = length(cross(ro, incoming));
    if (impact < 0.0001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec3 radialBasis = normalize(p);
    vec3 azimuthBasis = normalize(incoming - radialBasis * dot(radialBasis, incoming));
    float u = 1.0 / length(p);
    float cameraShift = sqrt(max(1.0 - HORIZON / max(length(ro), HORIZON + 0.001), 0.01));
    float impactParameter = impact / cameraShift;
    // The exact critical impact parameter closes the captured shadow even for
    // rays that spend more than our finite budget circling the photon sphere.
    bool willCapture = impactParameter < 2.598076211 * HORIZON;
    vec2 orbit = vec2(u, sqrt(max(1.0 / (impactParameter * impactParameter)
      - u * u + HORIZON * u * u * u, 0.0)));
    float phi = 0.0;
    float transmission = 1.0;
    vec3 radiance = vec3(0.0);
    bool captured = false;

    // One uniform, bounded budget on all devices. Most rays leave the volume
    // much earlier; near-critical rays can form the higher-order disk image.
    for (int i = 0; i < 256; i++) {
      float radius = 1.0 / max(orbit.x, 0.00001);
      if (radius < HORIZON * 1.006) { captured = true; break; }
      if ((radius > BOUND + 0.002 && i > 0) || transmission < 0.004) break;
      vec3 radialDirection = radialBasis * cos(phi) + azimuthBasis * sin(phi);
      vec3 azimuthDirection = -radialBasis * sin(phi) + azimuthBasis * cos(phi);
      vec3 pathDerivative = -orbit.y * radius * radius * radialDirection
        + radius * azimuthDirection;
      // Refine by actual segment length through the emission layer. A fixed
      // angular increment samples grazing rays unevenly and prints its steps
      // into the lensed disk as concentric ridges.
      float stepAngle = 0.044;
      float cylindrical = length(p.xz);
      if (cylindrical > INNER_DISK - 0.2 && cylindrical < BOUND + 0.05) {
        float desiredSegment = clamp((abs(p.y) - 0.10) * 0.45, 0.055, 0.24);
        stepAngle = min(stepAngle, desiredSegment / max(length(pathDerivative), 0.001));
      }
      vec2 nextOrbit = advanceOrbit(orbit, stepAngle);
      float nextPhi = phi + stepAngle;
      float nextRadius = 1.0 / max(nextOrbit.x, 0.00001);
      vec3 nextPoint = (radialBasis * cos(nextPhi) + azimuthBasis * sin(nextPhi)) * nextRadius;
      vec3 segment = nextPoint - p;
      float segmentLength = length(segment);
      float height = 0.026 + length((p + nextPoint).xz * 0.5) * 0.009;
      vec2 columnSample = verticalIntegral(p.y, nextPoint.y, height, segmentLength);
      vec3 samplePoint = p + segment * columnSample.y;
      float diskRadius = length(samplePoint.xz);
      float column = columnSample.x;
      if (diskRadius > INNER_DISK && diskRadius < OUTER_DISK && column > 0.00008) {
        float opacity;
        // A ray footprint filters subpixel flow detail without changing the
        // procedural frequencies, sample count or quality on any device.
        float lensStretch = 1.0 + 0.12
          / max(abs(impactParameter - 2.598076211 * HORIZON), 0.022);
        float footprint = max(length(samplePoint - ro) * rayFootprint * lensStretch, 0.0001);
        vec3 source = diskSource(samplePoint, normalize(segment), footprint, opacity);
        float alpha = 1.0 - exp(-column * opacity);
        radiance += transmission * source * alpha;
        transmission *= 1.0 - alpha;
      }
      p = nextPoint;
      orbit = nextOrbit;
      phi = nextPhi;
    }

    float alpha = (captured || willCapture) ? 1.0 : 1.0 - transmission;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(radiance / max(alpha, 0.0001), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
