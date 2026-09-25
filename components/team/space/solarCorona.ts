import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec3 vVolumePoint;
void main() {
  vVolumePoint = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fragment = /* glsl */ `
uniform vec3 uCameraLocal;
uniform mat4 uViewFromLocal;
uniform mat4 uProjection;
uniform float uTime;
varying vec3 vVolumePoint;

void main() {
  vec3 ray = normalize(vVolumePoint - uCameraLocal);
  float closest = -dot(uCameraLocal, ray);
  vec3 perpendicular = uCameraLocal + ray * closest;
  float impact2 = dot(perpendicular, perpendicular);
  const float outer = 1.12;
  float halfChord = sqrt(max(outer * outer - impact2, 0.));
  float start = max(.00001, closest - halfChord);
  float end = closest + halfChord;
  if (impact2 < 1. && closest > 0.) end = min(end, closest - sqrt(1. - impact2));
  if (end <= start) discard;

  // Integrate only the visible atmosphere, with its front depth. This also
  // works for off-axis views, large world coordinates and closer inspection.
  vec4 front = uProjection * uViewFromLocal * vec4(uCameraLocal + ray * start, 1.);
  gl_FragDepth = clamp((front.z / front.w) * .5 + .5, 0., 1.);
  float stepLength = (end - start) / 48.;
  float emission = 0.;
  for (int i = 0; i < 48; i++) {
    vec3 point = uCameraLocal + ray * (start + (float(i) + .5) * stepLength);
    float radius = length(point);
    float altitude = max(radius - 1., 0.);
    vec3 radial = point / radius;
    float strands = .5 + .25 * sin(dot(radial, vec3(137., 59., -83.)) + uTime * .10)
      + .25 * sin(dot(radial, vec3(-67., 113., 157.)) - uTime * .06);
    float height = .0045 + .005 * strands * strands;
    float density = exp(-altitude / height) * (.28 + strands * .72);
    density *= 1. - smoothstep(.07, .12, altitude);
    emission += density * stepLength;
  }
  // A thin EUV emitting limb, in the same false-colour family as AIA 304.
  // No visible-light eclipse corona is composited over this different band.
  // The surface's bright regions provide most of the camera's optical bloom.
  vec3 radiance = vec3(1.3, .10, .008) * emission * 2.0;
  if (radiance.r < .00008) discard;
  gl_FragColor = vec4(radiance, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Compact 3D emitting atmosphere for the EUV observation display. Density
 * and plasma motion are illustrative, not a measured 3D reconstruction.
 * Its 48 integration samples and closed bounds are identical on all devices.
 */
export function createSolarCorona() {
  const group = new THREE.Group();
  group.name = 'Sun EUV atmosphere volume';
  const geometry = new THREE.SphereGeometry(1.12, 96, 64);
  const cameraLocal = new THREE.Vector3();
  const inverseWorld = new THREE.Matrix4();
  const viewFromLocal = new THREE.Matrix4();
  const projection = new THREE.Matrix4();
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uCameraLocal: { value: cameraLocal }, uViewFromLocal: { value: viewFromLocal },
      uProjection: { value: projection }, uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Solar atmosphere volume';
  mesh.renderOrder = 3;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    inverseWorld.copy(mesh.matrixWorld).invert();
    camera.getWorldPosition(cameraLocal).applyMatrix4(inverseWorld);
    viewFromLocal.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    projection.copy(camera.projectionMatrix);
  };
  group.add(mesh);
  let disposed = false;
  return {
    group,
    update(time: number, enabled: boolean) {
      if (disposed) return;
      group.visible = enabled;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.onBeforeRender = () => {};
      group.removeFromParent();
      group.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
