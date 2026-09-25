// A finite, ellipsoidal atmosphere, integrated along the camera and solar rays.
// Single scattering follows the radiative-transfer terms in Bruneton (2008):
// https://ebruneton.github.io/precomputed_atmospheric_scattering/atmosphere/functions.glsl.html
// There is no billboard or Fresnel rim: surface rays stop at the opaque globe.
export const solarAtmosphereVertex = /* glsl */ `
uniform vec3 uSun;
varying vec3 vPosition;
varying vec3 vEye;
varying vec3 vLight;
void main() {
  mat3 frame=mat3(modelViewMatrix);
  vec3 origin=-modelViewMatrix[3].xyz;
  vec3 light=mat3(viewMatrix)*uSun;
  vec3 lengths=vec3(dot(frame[0],frame[0]),dot(frame[1],frame[1]),dot(frame[2],frame[2]));
  vEye=vec3(dot(origin,frame[0]),dot(origin,frame[1]),dot(origin,frame[2]))/lengths;
  vLight=normalize(vec3(dot(light,frame[0]),dot(light,frame[1]),dot(light,frame[2]))/lengths);
  vPosition=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

export const solarAtmosphereFragment = /* glsl */ `
varying vec3 vPosition;
varying vec3 vEye;
varying vec3 vLight;
uniform float uPlanetRadius;
uniform vec2 uScaleHeight;
uniform vec3 uRayleigh;
uniform vec3 uMie;
uniform float uMieG;
uniform float uIrradiance;
vec2 intersectSphere(vec3 p,vec3 d,float radius) {
  float b=dot(p,d),c=dot(p,p)-radius*radius;
  float determinant=b*b-c;
  if(determinant<0.)return vec2(1e5,-1e5);
  float root=sqrt(max(determinant,0.));
  return vec2(-b-root,-b+root);
}
vec2 densityAt(vec3 p) {
  float height=max(length(p)-uPlanetRadius,0.);
  return exp(-height/uScaleHeight);
}
void main() {
  vec3 ray=normalize(vPosition-vEye),sun=normalize(vLight);
  vec2 atmosphere=intersectSphere(vEye,ray,1.);
  vec2 ground=intersectSphere(vEye,ray,uPlanetRadius);
  float start=max(atmosphere.x,0.);
  float finish=atmosphere.y;
  if(ground.x>0.)finish=min(finish,ground.x);
  if(finish<=start)discard;
  float stepLength=(finish-start)/16.;
  vec2 viewDepth=vec2(0.);
  vec3 rayleighSum=vec3(0.),mieSum=vec3(0.);
  for(int i=0;i<16;i++) {
    vec3 p=vEye+ray*(start+(float(i)+.5)*stepLength);
    vec2 density=densityAt(p);
    vec2 middleDepth=viewDepth+density*stepLength*.5;
    viewDepth+=density*stepLength;
    vec2 obstruction=intersectSphere(p,sun,uPlanetRadius);
    if(obstruction.x>0. && obstruction.y>0.)continue;
    float lightLength=max(intersectSphere(p,sun,1.).y,0.)/6.;
    vec2 sunDepth=vec2(0.);
    for(int j=0;j<6;j++) sunDepth+=densityAt(p+sun*(float(j)+.5)*lightLength)*lightLength;
    vec2 depth=middleDepth+sunDepth;
    vec3 attenuation=exp(-(uRayleigh*depth.x+uMie*depth.y*1.11));
    rayleighSum+=attenuation*density.x*stepLength;
    mieSum+=attenuation*density.y*stepLength;
  }
  float cosine=dot(ray,sun),g=uMieG;
  float rayleighPhase=.0596831*(1.+cosine*cosine);
  float miePhase=.1193662*(1.-g*g)*(1.+cosine*cosine)/((2.+g*g)*pow(max(1.+g*g-2.*g*cosine,.001),1.5));
  vec3 scattering=uIrradiance*(uRayleigh*rayleighSum*rayleighPhase+uMie*mieSum*miePhase);
  vec3 transmission=exp(-(uRayleigh*viewDepth.x+uMie*viewDepth.y*1.11));
  // RGB extinction is approximated by luminance for standard alpha compositing;
  // scattering itself retains its wavelength-dependent colour.
  float alpha=clamp(1.-dot(transmission,vec3(.2126,.7152,.0722)),0.,.98);
  if(alpha<.0001)discard;
  gl_FragColor=vec4(scattering/max(alpha,.0001),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
