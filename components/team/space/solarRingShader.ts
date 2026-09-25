/** Cassini UVIS occultation samples, downsampled in transmission space.
 * See public/textures/solar/SATURN_RINGS.md for the observation and reduction.
 * This is normal optical depth, not a photograph painted over a solid disk. */
export const saturnRingProfileGLSL = /* glsl */ `
uniform sampler2D uRingProfile;
float saturnOpticalDepth(float radius) {
  float km = radius * 60268.0;
  if (km < 74000.0 || km > 141000.0) return 0.0;
  float coordinate = (km - 74000.0) / 67000.0;
  // The map stores 1 - mean(exp(-tau)). Linear filtering and mipmapping
  // therefore integrate transmitted light rather than inventing opaque bands.
  float opacity = texture2D(uRingProfile, vec2(coordinate, 0.5)).r;
  return -log(max(1.0 - opacity, 0.0025));
}
`;

export const solarRingFragment = /* glsl */ `
uniform vec3 uSun;
uniform vec4 uOccluders[4];
uniform float uDark;
uniform sampler2D uRingColor;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
${saturnRingProfileGLSL}

float ringVisibility() {
  float visible = 1.0;
  for (int i = 0; i < 4; i++) {
    vec3 offset = uOccluders[i].xyz - vWorldPosition;
    float along = dot(offset, uSun);
    float radius = uOccluders[i].w;
    if (along > 0.0 && radius > 0.0) {
      float distanceToRay = length(offset - along * uSun);
      // The Sun's apparent radius at Saturn is roughly 0.00049 radians.
      // Derivative filtering softens the edge only by its pixel footprint.
      float edge = max(along * 0.00049, fwidth(distanceToRay));
      visible *= smoothstep(radius - edge, radius + edge, distanceToRay);
    }
  }
  return visible;
}

float particlePhase(float cosine, float asymmetry) {
  float squared = asymmetry * asymmetry;
  return (1.0 - squared) / pow(max(1.0 + squared - 2.0 * asymmetry * cosine, 0.05), 1.5);
}

void main() {
  float radius = length(vLocalPosition.xz);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(mat3(viewMatrix) * uSun);
  vec3 V = normalize(-vViewPosition);
  float incidence = dot(N, L);
  float emergence = dot(N, V);
  float mu0 = max(abs(incidence), 0.008);
  float mu = max(abs(emergence), 0.008);
  float tau = uDark > 0.5 ? 0.32 : saturnOpticalDepth(radius);
  float opacity = 1.0 - exp(-tau / mu);
  if (opacity < 0.001) discard;

  // Single-scattering solution for a plane-parallel layer of particles.
  // The lit face reflects; the unlit face transmits. A dense B ring becomes
  // dark in backlight while the less opaque C ring remains luminous.
  float reflected = mu0 / (mu + mu0) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
  float transmitted;
  if (abs(mu - mu0) < 0.003) {
    float meanMu = 0.5 * (mu + mu0);
    transmitted = tau / meanMu * exp(-tau / meanMu);
  } else {
    transmitted = mu0 / (mu0 - mu) * (exp(-tau / mu0) - exp(-tau / mu));
  }
  float sameFace = step(0.0, incidence * emergence);
  float scattered = mix(max(transmitted, 0.0), reflected, sameFace);
  float cosine = -dot(V, L);
  float phase = 0.68 * particlePhase(cosine, -0.25) + 0.32 * particlePhase(cosine, 0.35);

  vec3 albedo;
  if (uDark > 0.5) {
    albedo = vec3(0.085, 0.077, 0.067);
  } else if (radius > 2.28) {
    // The F-ring crossing is eccentric and occurred at different radii in
    // the two observations. Its colour retains the icy-particle approximation.
    albedo = vec3(0.47, 0.43, 0.36);
  } else {
    float coordinate = (radius * 60268.0 - 74000.0) / 67000.0;
    vec3 observed = texture2D(uRingColor, vec2(coordinate, 0.5)).rgb;
    // Cassini PIA11142 resolves reflected-light variation even where the B
    // ring's opacity is saturated. Its published view is 10 degrees below
    // the lit plane. A 4-degree solar elevation is a photometric fit for
    // this near-equinox image, not a recovered mission ephemeris.
    float referenceLayer = 1.0 - exp(-tau * (1.0 / 0.173648 + 1.0 / 0.069756));
    // Remove the source view's single-scattering layer factor before applying
    // this scene's transfer below; otherwise the thin C ring is dimmed twice.
    // The source is an empirical reflectance proxy, not calibrated albedo.
    albedo = min(observed * 0.90 / max(referenceLayer, 0.04), vec3(0.95));
  }
  float visible = ringVisibility();
  vec3 radiance = albedo * (scattered * phase * 1.65 * visible + opacity * 0.0015);
  // Standard alpha blending applies coverage once. Without this division,
  // a transparent C ring would be attenuated a second time while compositing.
  gl_FragColor = vec4(radiance / max(opacity, 0.001), opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
