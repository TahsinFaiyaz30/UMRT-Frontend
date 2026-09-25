import { saturnRingProfileGLSL } from './solarRingShader';

export const solarVertex = /* glsl */ `
uniform sampler2D uHeight;
uniform float uHeightScale;
uniform float uHeightBias;
uniform float uBodyRadius;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec3 point=position;
  if(uHeightScale>0.) {
    // Lossless RG encodes measured 16-bit LOLA/MOLA heights. Reconstruct
    // after interpolation; rounding channels would create elevation steps.
    float elevation=dot(texture2D(uHeight,uv).rg,vec2(65280.,255.))*uHeightScale+uHeightBias;
    point*=1.+elevation/uBodyRadius;
  }
  vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
  vViewPosition = viewPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(point, 1.0)).xyz;
  vLocalPosition = position;
  gl_Position = projectionMatrix * viewPosition;
}`;

const lighting = /* glsl */ `
uniform vec3 uSun;
uniform vec4 uOccluders[4];
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
float visibility() {
  float visible = 1.0;
  for (int i=0; i<4; i++) {
    vec3 offset = uOccluders[i].xyz - vWorldPosition;
    float along = dot(offset, uSun);
    float radius = uOccluders[i].w;
    float distanceToRay = length(offset - along * uSun);
    if (along > radius && radius > 0.0) {
      float edge = max(radius * 0.04, along * 0.0023);
      visible *= smoothstep(radius - edge, radius + edge, distanceToRay);
    }
  }
  return visible;
}
`;

export const solarSurfaceFragment = /* glsl */ `
${lighting}
uniform sampler2D uMap;
uniform float uMapOffset;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform sampler2D uNormalMap;
uniform float uCloudOffset;
uniform float uHasMap;
uniform float uEarth;
uniform float uHasNormal;
uniform float uCloudPlanet;
uniform vec3 uBaseColor;
uniform float uNeptune;
uniform float uTime;
uniform float uVenus;
uniform float uTitan;
uniform float uNoDataFill;
uniform vec3 uRingNormal;
uniform vec3 uParentCenter;
uniform float uParentRadius;
uniform float uRings;
${saturnRingProfileGLSL}
vec3 terrainNormal(vec3 geometricNormal) {
  vec3 q0=dFdx(vViewPosition),q1=dFdy(vViewPosition);
  vec2 st0=dFdx(vUv),st1=dFdy(vUv);
  float orientation=st0.x*st1.y-st0.y*st1.x<0.?-1.:1.;
  vec3 T=(q0*st1.y-q1*st0.y)*orientation;
  vec3 B=(-q0*st1.x+q1*st0.x)*orientation;
  // Each tangent has unit length: DEM gradients already account for the
  // shrinking east-west distance per texel at high spherical latitudes.
  T=normalize(T-geometricNormal*dot(geometricNormal,T));
  B=normalize(B-geometricNormal*dot(geometricNormal,B));
  vec3 measured=texture2D(uNormalMap,vUv).xyz*2.-1.;
  return normalize(mat3(T,B,geometricNormal)*measured);
}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPosition);
  vec3 L = normalize(mat3(viewMatrix) * uSun);
  vec3 color = mix(uBaseColor, texture2D(uMap,vec2(fract(vUv.x+uMapOffset),vUv.y)).rgb, uHasMap);
  if (uNoDataFill > .5) {
    // Voyager did not observe these northern hemispheres. A featureless
    // neutral area denotes missing data; black atlas pixels are not real ice.
    float observed=smoothstep(.001,.012,dot(color,vec3(.2126,.7152,.0722)));
    color=mix(vec3(.18),color,observed);
  }
  if (uNeptune > 0.5) {
    // Voyager's familiar saturated release was enhanced. Preserve observed
    // cloud structure while using the pale blue-green visible-light appearance.
    float value = dot(color, vec3(0.2126,0.7152,0.0722));
    color = uBaseColor * (0.75 + value * 0.46);
  }
  if (uVenus > 0.5 || uTitan > 0.5) {
    float latitude = asin(clamp(vLocalPosition.y,-1.0,1.0));
    float streak = sin(latitude*18.0 + sin(vUv.x*19.0+uTime*.055)*.24);
    // Visible cloud/haze contrast is very low, unlike UV/IR releases.
    color *= 0.995 + .005*streak;
  }
  if (uHasNormal > .5) N=terrainNormal(N);
  float day=dot(N,L);
  float eclipse=visibility();
  if (uRings > 0.5) {
    float denominator=dot(uSun,uRingNormal);
    if(abs(denominator)>.001) {
      float t=dot(uParentCenter-vWorldPosition,uRingNormal)/denominator;
      if(t>0.) {
        float radius=length(vWorldPosition+uSun*t-uParentCenter)/uParentRadius;
        eclipse *= exp(-saturnOpticalDepth(radius)/max(abs(denominator),.008));
      }
    }
  }
  float diffuse=max(day,0.0);
  float viewCos=max(dot(N,V),.001);
  // Regolith backscatter and optically thick cloud decks have different
  // disk responses. Using the rock law for Jupiter erased its limb shading.
  float rock=diffuse/(diffuse+viewCos+.08);
  float cloudDeck=pow(diffuse,.88)*(.82+.18*sqrt(viewCos));
  float response=mix(rock*.58+diffuse*.42,cloudDeck,uCloudPlanet);
  response=mix(response,diffuse,uEarth);
  vec3 outgoing=color*(.001+response*eclipse*1.6);
  if(uEarth>.5) {
    float cloud=texture2D(uClouds,vec2(vUv.x+uCloudOffset,vUv.y)).r;
    outgoing *= 1.-cloud*.24*diffuse;
    // Water is optically dark in the albedo map; use chromatic ratios so the
    // ocean does not lose its specular lobe merely because it is dark blue.
    float water=smoothstep(1.05,1.8,color.b/max(color.r,.0001))
      *(1.-smoothstep(.04,.14,dot(color,vec3(.2126,.7152,.0722))));
    vec3 H=normalize(V+L);
    float nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
    float roughness=.13,a2=roughness*roughness*roughness*roughness;
    float denominator=nh*nh*(a2-1.)+1.;
    float distribution=a2/(3.14159265*denominator*denominator);
    float geometryV=2.*viewCos/(viewCos+sqrt(a2+(1.-a2)*viewCos*viewCos));
    float geometryL=2.*diffuse/max(diffuse+sqrt(a2+(1.-a2)*diffuse*diffuse),.001);
    float fresnel=.0204+.9796*pow(1.-vh,5.);
    outgoing += vec3(1.,.98,.94)*distribution*geometryV*geometryL*fresnel
      /max(4.*viewCos,.001)*water*eclipse*(1.-cloud*.85)*1.6;
    vec3 night=texture2D(uNight,vUv).rgb;
    // The published night map contains a dim geographic basemap. Subtract
    // that low background so only observed lights emit, never the oceans.
    night=max(night-vec3(.018),vec3(0.));
    outgoing += night*vec3(1.,.84,.61)*(1.-smoothstep(-.2,.08,day))*.72;
  }
  gl_FragColor=vec4(outgoing,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const solarCloudFragment = /* glsl */ `
${lighting}
uniform sampler2D uMap;
void main() {
  float density=texture2D(uMap,vUv).r;
  if(density<.04) discard;
  vec3 N=normalize(vNormal);
  vec3 L=normalize(mat3(viewMatrix)*uSun);
  vec3 V=normalize(-vViewPosition);
  float day=dot(N,L),light=max(day,0.);
  float mu=max(dot(N,V),.12);
  float opticalDepth=density*density*3.5;
  float opacity=1.-exp(-opticalDepth/mu);
  // An observed cloud mask sets coverage; this optical-depth approximation
  // gives thin wisps and thick decks different transmission and shadowing.
  float transmission=exp(-opticalDepth/max(light,.08));
  float edgeLight=pow(max(dot(-V,L),0.),8.)*smoothstep(-.06,.15,day);
  vec3 radiance=vec3(.001+light*(1.28+.16*transmission)+edgeLight*.12)*visibility();
  gl_FragColor=vec4(radiance,opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export { solarAtmosphereFragment } from './solarAtmosphereShader';
export { solarRingFragment } from './solarRingShader';
export { solarSunFragment } from './solarSunShader';
