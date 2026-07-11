'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_DUST = 1400;
const MAX_COARSE_GRAINS = 180;
const IDLE_REANCHOR_MS = 140;

const DUST_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  attribute vec3 aColor;
  attribute vec3 aNormal;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSeed;
  varying vec3 vColor;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(
      aSize * uPixelRatio * (520.0 / max(0.8, -mvPosition.z)),
      1.0,
      120.0 * uPixelRatio
    );
    vAlpha = aAlpha;
    vSeed = aSeed;
    vColor = aColor;
    vWorldNormal = normalize(mat3(modelMatrix) * aNormal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  }
`;

const DUST_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying float vSeed;
  varying vec3 vColor;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  uniform float uTime;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uSunStrength;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32 + vSeed);
    return fract(point.x * point.y);
  }

  float noise21(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), fraction.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), fraction.x),
      fraction.y
    );
  }

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    float billow = noise21(gl_PointCoord * 3.2 + vec2(vSeed, uTime * 0.045));
    billow += noise21(gl_PointCoord * 7.1 - vec2(uTime * 0.025, vSeed)) * 0.45;
    float edge = 0.47 + (billow - 0.62) * 0.12;
    if (radius > edge) discard;
    float softParticle = 1.0 - smoothstep(0.05, edge, radius);
    float granularCore = 1.0 - smoothstep(0.0, 0.14 + billow * 0.05, radius);
    float alpha = vAlpha * (softParticle * (0.5 + billow * 0.46) + granularCore * 0.12);
    // The particle carries the albedo sampled from the soil directly beneath
    // it. Apply the same calibrated illuminant as the terrain instead of a
    // fixed Mars-red tint. Opacity remains a material property; low sunlight
    // darkens dust rather than making matter physically disappear.
    float illumination = clamp(uSunStrength, 0.0, 2.5);
    vec3 lightDirection = normalize(uSunDirection);
    vec3 viewDirection = normalize(vViewDirection);
    float lambert = max(dot(normalize(vWorldNormal), lightDirection), 0.0);
    // Martian mineral dust is moderately forward-scattering. This compact
    // Henyey-Greenstein term gives the plume a brighter solar-facing edge
    // while the contact normal keeps the terrain-side response directional.
    float anisotropy = 0.38;
    // Incoming photons travel from the sun toward the particle, opposite the
    // surface-to-sun vector used by Lambert lighting.
    float phaseCosine = clamp(dot(-lightDirection, viewDirection), -1.0, 1.0);
    float phase = (1.0 - anisotropy * anisotropy) / pow(
      max(0.08, 1.0 + anisotropy * anisotropy - 2.0 * anisotropy * phaseCosine),
      1.5
    );
    vec3 ambientScatter = vec3(0.028) + uSunColor * sqrt(illumination) * 0.038;
    vec3 directScatter = uSunColor * illumination
      * (0.18 + lambert * 0.82)
      * (0.32 + phase * 0.24);
    vec3 litColor = vColor * (ambientScatter + directScatter);
    gl_FragColor = vec4(litColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type SurfaceMeta = {
  size: number;
  segments: number;
  baseHeights: Float32Array;
  deformations: Float32Array;
};

type SurfaceHit = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  color: THREE.Color;
  distance: number;
};

type PointerSample = {
  ndcX: number;
  ndcY: number;
  screenX: number;
  screenY: number;
  timestamp: number;
  inside: boolean;
  blocked: boolean;
  buttons: number;
};

type DustParticle = {
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  drag: number;
  gravity: number;
  baseSize: number;
  opacity: number;
  expansion: number;
  windInfluence: number;
  seed: number;
  color: THREE.Color;
  normal: THREE.Vector3;
};

type CoarseGrain = {
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  angularVelocity: THREE.Vector3;
  scale: number;
  gravity: number;
  drag: number;
  bounces: number;
  color: THREE.Color;
};

type DeformationContact = {
  localPoint: THREE.Vector3;
  point: THREE.Vector3;
  localNormal: THREE.Vector3;
  normal: THREE.Vector3;
};

type SurfaceTriangleSample = {
  i0: number;
  i1: number;
  i2: number;
  w0: number;
  w1: number;
  w2: number;
};

type AlbedoSampler = {
  texture: THREE.Texture;
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createSurfaceTriangleSample(): SurfaceTriangleSample {
  return { i0: 0, i1: 0, i2: 0, w0: 1, w1: 0, w2: 0 };
}

function sampleSurfaceTriangle(
  meta: SurfaceMeta,
  x: number,
  y: number,
  out: SurfaceTriangleSample,
) {
  const spacing = meta.size / meta.segments;
  const half = meta.size / 2;
  const columnFloat = clamp((x + half) / spacing, 0, meta.segments);
  const rowFloat = clamp((half - y) / spacing, 0, meta.segments);
  const column = Math.min(meta.segments - 1, Math.floor(columnFloat));
  const row = Math.min(meta.segments - 1, Math.floor(rowFloat));
  const tx = columnFloat - column;
  const ty = rowFloat - row;
  const stride = meta.segments + 1;
  const topLeft = row * stride + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + stride;
  const bottomRight = bottomLeft + 1;
  if (tx + ty <= 1) {
    out.i0 = topLeft;
    out.i1 = topRight;
    out.i2 = bottomLeft;
    out.w0 = 1 - tx - ty;
    out.w1 = tx;
    out.w2 = ty;
  } else {
    out.i0 = bottomRight;
    out.i1 = bottomLeft;
    out.i2 = topRight;
    out.w0 = tx + ty - 1;
    out.w1 = 1 - tx;
    out.w2 = 1 - ty;
  }
  return out;
}

const PROJECT_TRIANGLE_SCRATCH = createSurfaceTriangleSample();

function sampleSurfaceHeight(
  meta: SurfaceMeta,
  position: THREE.BufferAttribute,
  x: number,
  y: number,
  scratch: SurfaceTriangleSample,
) {
  const sample = sampleSurfaceTriangle(meta, x, y, scratch);
  return position.getZ(sample.i0) * sample.w0
    + position.getZ(sample.i1) * sample.w1
    + position.getZ(sample.i2) * sample.w2;
}

function projectDeformedSurfaceContact(
  ground: THREE.Mesh,
  localX: number,
  localY: number,
  out: DeformationContact,
): DeformationContact | undefined {
  const geometry = ground.geometry as THREE.BufferGeometry;
  const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
  if (!meta) return undefined;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const spacing = meta.size / meta.segments;
  const half = meta.size / 2;
  if (Math.max(Math.abs(localX), Math.abs(localY)) > half - spacing * 0.5) return undefined;
  const x0 = clamp(localX - spacing, -half, half);
  const x1 = clamp(localX + spacing, -half, half);
  const y0 = clamp(localY - spacing, -half, half);
  const y1 = clamp(localY + spacing, -half, half);
  const slopeX = (
    sampleSurfaceHeight(meta, position, x1, localY, PROJECT_TRIANGLE_SCRATCH)
      - sampleSurfaceHeight(meta, position, x0, localY, PROJECT_TRIANGLE_SCRATCH)
  ) / Math.max(spacing, x1 - x0);
  const slopeY = (
    sampleSurfaceHeight(meta, position, localX, y1, PROJECT_TRIANGLE_SCRATCH)
      - sampleSurfaceHeight(meta, position, localX, y0, PROJECT_TRIANGLE_SCRATCH)
  ) / Math.max(spacing, y1 - y0);
  out.localNormal.set(-slopeX, -slopeY, 1).normalize();
  out.localPoint.set(
    localX,
    localY,
    sampleSurfaceHeight(meta, position, localX, localY, PROJECT_TRIANGLE_SCRATCH),
  );
  ground.updateWorldMatrix(true, false);
  out.point.copy(out.localPoint);
  ground.localToWorld(out.point);
  out.normal.copy(out.localNormal).transformDirection(ground.matrixWorld).normalize();
  return out;
}

export function SoilInteraction({
  groundRef,
  sunDirection,
  sunColor,
  sunStrength,
}: {
  groundRef: RefObject<THREE.Mesh | null>;
  sunDirection: readonly [number, number, number];
  sunColor: string;
  sunStrength: number;
}) {
  const { camera, gl, raycaster, scene } = useThree();
  const dustRef = useRef<THREE.Points>(null);
  const coarseGrainsRef = useRef<THREE.InstancedMesh>(null);
  const albedoTextureRef = useRef<THREE.Texture | null>(null);
  const albedoSamplerRef = useRef<AlbedoSampler | null>(null);
  const albedoRetryAtRef = useRef(0);
  const roverOccluderRef = useRef<THREE.Object3D | null>(null);
  const roverRigRef = useRef<THREE.Object3D | null>(null);
  const pointer = useRef(new THREE.Vector2(2, 2));
  const pointerInside = useRef(false);
  const pointerBlocked = useRef(false);
  const pointerButtons = useRef(0);
  const pointerSamples = useRef<PointerSample[]>([]);
  const processedTimestamp = useRef(0);
  const lastPoint = useRef<THREE.Vector3 | null>(null);
  const lastScreenPoint = useRef<THREE.Vector2 | null>(null);
  const lastNdcPoint = useRef<THREE.Vector2 | null>(null);
  const velocityAnchorPoint = useRef<THREE.Vector2 | null>(null);
  const velocityAnchorTimestamp = useRef(0);
  const screenVelocity = useRef(0);
  const dustIndex = useRef(0);
  const coarseGrainIndex = useRef(0);
  const activeDustCount = useRef(0);
  const activeGrainCount = useRef(0);
  const surfaceActive = useRef(false);
  const surfaceDirty = useRef(false);
  const lastNormalUpdate = useRef(0);
  const motionEnergy = useRef(0);
  const dustBirthBudget = useRef(0);
  const dirtyBounds = useRef({
    minColumn: Number.POSITIVE_INFINITY,
    maxColumn: Number.NEGATIVE_INFINITY,
    minRow: Number.POSITIVE_INFINITY,
    maxRow: Number.NEGATIVE_INFINITY,
  });
  const previousCameraPosition = useRef(new THREE.Vector3());
  const previousCameraQuaternion = useRef(new THREE.Quaternion());
  const previousProjectionMatrix = useRef(new THREE.Matrix4());
  const dustUniforms = useMemo(() => ({
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.65) },
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color('#ff8100') },
    uSunDirection: { value: new THREE.Vector3(1, 1, 0).normalize() },
    uSunStrength: { value: 1 },
  }), []);
  const particles = useRef<DustParticle[]>(
    Array.from({ length: MAX_DUST }, (_, index) => ({
      life: 0,
      maxLife: 1,
      position: new THREE.Vector3(0, -999, 0),
      velocity: new THREE.Vector3(),
      drag: 2,
      gravity: 0.25,
      baseSize: 0.03,
      opacity: 0,
      expansion: 0,
      windInfluence: 0,
      seed: index * 1.618,
      color: new THREE.Color(1, 1, 1),
      normal: new THREE.Vector3(0, 1, 0),
    })),
  );
  const coarseGrains = useRef<CoarseGrain[]>(
    Array.from({ length: MAX_COARSE_GRAINS }, () => ({
      life: 0,
      maxLife: 1,
      position: new THREE.Vector3(0, -999, 0),
      velocity: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      angularVelocity: new THREE.Vector3(),
      scale: 0.01,
      gravity: 2.8,
      drag: 0.3,
      bounces: 0,
      color: new THREE.Color(0.2, 0.08, 0.035),
    })),
  );
  const grainTransform = useMemo(() => new THREE.Object3D(), []);
  const grainSpin = useMemo(() => new THREE.Quaternion(), []);
  const grainEuler = useMemo(() => new THREE.Euler(), []);
  const grainLocalPoint = useMemo(() => new THREE.Vector3(), []);
  const soilTriangleScratch = useMemo(createSurfaceTriangleSample, []);
  const rayTriangleScratch = useMemo(createSurfaceTriangleSample, []);
  const deformationContactPool = useMemo<DeformationContact[]>(
    () => Array.from({ length: 240 }, () => ({
      localPoint: new THREE.Vector3(),
      point: new THREE.Vector3(),
      localNormal: new THREE.Vector3(0, 0, 1),
      normal: new THREE.Vector3(0, 1, 0),
    })),
    [],
  );
  const deformationContactScratch = useMemo<DeformationContact>(() => ({
    localPoint: new THREE.Vector3(),
    point: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
  }), []);
  const grainContactScratch = useMemo<DeformationContact>(() => ({
    localPoint: new THREE.Vector3(),
    point: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
  }), []);
  const deformLocalPoint = useMemo(() => new THREE.Vector3(), []);
  const deformDirectionEnd = useMemo(() => new THREE.Vector3(), []);
  const pathPointScratch = useMemo(() => new THREE.Vector3(), []);
  const pathDirectionScratch = useMemo(() => new THREE.Vector3(), []);
  const emissionTangent = useMemo(() => new THREE.Vector3(), []);
  const emissionSide = useMemo(() => new THREE.Vector3(), []);
  const pointerScreenScratch = useMemo(() => new THREE.Vector2(), []);
  const soilLocalPoint = useMemo(() => new THREE.Vector3(), []);
  const soilCombinedColor = useMemo(() => new THREE.Color(), []);
  const soilUv = useMemo(() => new THREE.Vector2(), []);
  const soilTexel = useMemo(() => new THREE.Color(), []);
  const inverseGroundMatrix = useMemo(() => new THREE.Matrix4(), []);
  const rayLocalOrigin = useMemo(() => new THREE.Vector3(), []);
  const rayLocalDirection = useMemo(() => new THREE.Vector3(), []);
  const rayLocalPoint = useMemo(() => new THREE.Vector3(), []);
  const rayLocalNormal = useMemo(() => new THREE.Vector3(), []);
  const raySurfaceColor = useMemo(() => new THREE.Color(), []);
  const rayWorldPoint = useMemo(() => new THREE.Vector3(), []);
  const rayWorldNormal = useMemo(() => new THREE.Vector3(), []);
  const surfaceHitScratch = useMemo<SurfaceHit>(() => ({
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 1, 0),
    color: new THREE.Color(),
    distance: 0,
  }), []);

  const dustGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_DUST * 3);
    const sizes = new Float32Array(MAX_DUST);
    const alphas = new Float32Array(MAX_DUST);
    const seeds = new Float32Array(MAX_DUST);
    const colors = new Float32Array(MAX_DUST * 3);
    const normals = new Float32Array(MAX_DUST * 3);
    positions.fill(-999);
    for (let index = 0; index < MAX_DUST; index += 1) normals[index * 3 + 1] = 1;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
    return geometry;
  }, []);

  useLayoutEffect(() => {
    const mesh = coarseGrainsRef.current;
    if (!mesh) return;
    grainTransform.position.set(0, -999, 0);
    grainTransform.quaternion.identity();
    grainTransform.scale.setScalar(0.00001);
    grainTransform.updateMatrix();
    const baseColor = new THREE.Color(0.2, 0.08, 0.035);
    for (let index = 0; index < MAX_COARSE_GRAINS; index += 1) {
      mesh.setMatrixAt(index, grainTransform.matrix);
      mesh.setColorAt(index, baseColor);
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor.needsUpdate = true;
    }
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    material.needsUpdate = true;
  }, [grainTransform]);

  useEffect(() => {
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const updatePointer = (event: PointerEvent) => {
      if (finePointer && !finePointer.matches) return;
      const bounds = gl.domElement.getBoundingClientRect();
      const blocked = event.target instanceof Element
        && Boolean(event.target.closest(
          'a, button, input, [role="button"], .mission-loader, .teardown-console, [aria-label="Solar calibration"], [data-page-footer]',
        ));
      const coalesced = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : [];
      const sourceEvents = coalesced.length > 0 ? [...coalesced, event] : [event];

      // PointerEvent coalescing is common on high-polling mice. Processing
      // only the final event once per frame creates gaps that feel like the
      // terrain has stopped seeing the cursor, so preserve the physical path.
      sourceEvents.forEach((sample, index) => {
        const previous = index > 0 ? sourceEvents[index - 1] : undefined;
        if (previous
          && sample.timeStamp === previous.timeStamp
          && sample.clientX === previous.clientX
          && sample.clientY === previous.clientY) return;
        const inside = sample.clientX >= bounds.left
          && sample.clientX <= bounds.right
          && sample.clientY >= bounds.top
          && sample.clientY <= bounds.bottom;
        pointerSamples.current.push({
          ndcX: ((sample.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
          ndcY: -((sample.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
          screenX: sample.clientX - bounds.left,
          screenY: sample.clientY - bounds.top,
          timestamp: sample.timeStamp,
          inside,
          blocked,
          buttons: sample.buttons,
        });
      });

      // This is a safety ceiling rather than a throttle: the retained first
      // sample is still connected to the previous world point, so even an OS
      // event burst produces one continuous trace rather than a cut.
      if (pointerSamples.current.length > 96) {
        pointerSamples.current.splice(0, pointerSamples.current.length - 96);
      }
      pointerInside.current = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      pointerBlocked.current = blocked;
      pointerButtons.current = event.buttons;
      pointer.current.set(
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
      );
    };
    const leave = () => {
      pointerInside.current = false;
      pointerButtons.current = 0;
      pointerSamples.current.length = 0;
      lastPoint.current = null;
      lastScreenPoint.current = null;
      lastNdcPoint.current = null;
      velocityAnchorPoint.current = null;
      velocityAnchorTimestamp.current = 0;
      screenVelocity.current = 0;
      processedTimestamp.current = 0;
      motionEnergy.current = 0;
      dustBirthBudget.current = 0;
      surfaceActive.current = false;
      document.querySelector('.mission-experience')?.removeAttribute('data-cursor-surface');
    };
    const release = () => {
      pointerButtons.current = 0;
      pointerSamples.current.length = 0;
      lastPoint.current = null;
      lastScreenPoint.current = null;
      lastNdcPoint.current = null;
      velocityAnchorPoint.current = null;
      velocityAnchorTimestamp.current = 0;
      screenVelocity.current = 0;
      processedTimestamp.current = 0;
      motionEnergy.current = 0;
      dustBirthBudget.current = 0;
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.querySelector('.mission-experience')?.removeAttribute('data-cursor-surface');
    };
  }, [gl]);

  useEffect(() => {
    const resize = () => {
      dustUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.65);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dustUniforms]);

  useEffect(() => {
    dustUniforms.uSunColor.value.set(sunColor);
    dustUniforms.uSunDirection.value.set(...sunDirection).normalize();
    dustUniforms.uSunStrength.value = sunStrength;
  }, [dustUniforms, sunColor, sunDirection, sunStrength]);

  const setSurfaceCursor = (active: boolean) => {
    if (surfaceActive.current === active) return;
    surfaceActive.current = active;
    const experience = document.querySelector('.mission-experience');
    if (active) experience?.setAttribute('data-cursor-surface', 'true');
    else experience?.removeAttribute('data-cursor-surface');
  };

  const getAlbedoSampler = (ground: THREE.Mesh) => {
    const material = (Array.isArray(ground.material) ? ground.material[0] : ground.material) as THREE.MeshStandardMaterial;
    const texture = material?.map;
    if (!texture) return null;
    if (albedoSamplerRef.current?.texture === texture) return albedoSamplerRef.current;
    if (albedoTextureRef.current !== texture) {
      albedoTextureRef.current = texture;
      albedoSamplerRef.current = null;
      albedoRetryAtRef.current = 0;
    }

    // Textures can exist for a frame or two before their decoded image does.
    // A cached null made that transient state permanent; retry briefly until
    // the image is ready, while backing off a blocked CPU read.
    const now = performance.now();
    if (now < albedoRetryAtRef.current) return null;

    const image = texture.image as (CanvasImageSource & { width?: number; height?: number }) | undefined;
    if (!image?.width || !image?.height) {
      albedoRetryAtRef.current = now + 100;
      return null;
    }
    try {
      const resolution = 256;
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        albedoRetryAtRef.current = now + 2000;
        return null;
      }
      context.drawImage(image, 0, 0, resolution, resolution);
      albedoSamplerRef.current = {
        texture,
        width: resolution,
        height: resolution,
        data: context.getImageData(0, 0, resolution, resolution).data,
      };
      albedoRetryAtRef.current = Number.POSITIVE_INFINITY;
    } catch {
      // The vertex color remains a safe physical fallback if a browser blocks
      // CPU reads from a texture image. Retry rather than making a transient
      // decode/CORS state sticky for the lifetime of the scene.
      albedoSamplerRef.current = null;
      albedoRetryAtRef.current = now + 2000;
    }
    return albedoSamplerRef.current;
  };

  const sampleSoilColorAtPoint = (
    ground: THREE.Mesh,
    worldPoint: THREE.Vector3,
    fallback: THREE.Color,
  ) => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return soilCombinedColor.copy(fallback);
    soilLocalPoint.copy(worldPoint);
    ground.worldToLocal(soilLocalPoint);
    const sample = sampleSurfaceTriangle(meta, soilLocalPoint.x, soilLocalPoint.y, soilTriangleScratch);
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    const uvAttribute = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (colorAttribute) {
      soilCombinedColor.setRGB(
        colorAttribute.getX(sample.i0) * sample.w0
          + colorAttribute.getX(sample.i1) * sample.w1
          + colorAttribute.getX(sample.i2) * sample.w2,
        colorAttribute.getY(sample.i0) * sample.w0
          + colorAttribute.getY(sample.i1) * sample.w1
          + colorAttribute.getY(sample.i2) * sample.w2,
        colorAttribute.getZ(sample.i0) * sample.w0
          + colorAttribute.getZ(sample.i1) * sample.w1
          + colorAttribute.getZ(sample.i2) * sample.w2,
      );
    } else soilCombinedColor.copy(fallback);
    if (uvAttribute) {
      soilUv.set(
        uvAttribute.getX(sample.i0) * sample.w0
          + uvAttribute.getX(sample.i1) * sample.w1
          + uvAttribute.getX(sample.i2) * sample.w2,
        uvAttribute.getY(sample.i0) * sample.w0
          + uvAttribute.getY(sample.i1) * sample.w1
          + uvAttribute.getY(sample.i2) * sample.w2,
      );
    }

    const sampler = uvAttribute ? getAlbedoSampler(ground) : null;
    if (!sampler) return soilCombinedColor;
    sampler.texture.updateMatrix();
    sampler.texture.transformUv(soilUv);
    const pixelX = clamp(Math.floor(soilUv.x * sampler.width), 0, sampler.width - 1);
    const pixelY = clamp(Math.floor(soilUv.y * sampler.height), 0, sampler.height - 1);
    const offset = (pixelY * sampler.width + pixelX) * 4;
    soilTexel.setRGB(
      sampler.data[offset] / 255,
      sampler.data[offset + 1] / 255,
      sampler.data[offset + 2] / 255,
    );
    if (sampler.texture.colorSpace === THREE.SRGBColorSpace) soilTexel.convertSRGBToLinear();
    return soilCombinedColor.multiply(soilTexel);
  };

  const intersectSurface = (ground: THREE.Mesh): SurfaceHit | undefined => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return undefined;
    ground.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointer.current, camera);

    inverseGroundMatrix.copy(ground.matrixWorld).invert();
    rayLocalOrigin.copy(raycaster.ray.origin).applyMatrix4(inverseGroundMatrix);
    rayLocalDirection.copy(raycaster.ray.direction).transformDirection(inverseGroundMatrix);
    if (Math.abs(rayLocalDirection.z) < 0.00001) return undefined;

    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const color = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    const spacing = meta.size / meta.segments;
    const half = meta.size / 2;

    let entry = 0;
    let exit = Number.POSITIVE_INFINITY;
    const clipAxis = (origin: number, direction: number, minimum: number, maximum: number) => {
      if (Math.abs(direction) < 0.000001) return origin >= minimum && origin <= maximum;
      let near = (minimum - origin) / direction;
      let far = (maximum - origin) / direction;
      if (near > far) [near, far] = [far, near];
      entry = Math.max(entry, near);
      exit = Math.min(exit, far);
      return exit >= entry;
    };
    const minimumSurfaceHeight = (geometry.boundingBox?.min.z ?? -3) - 0.24;
    const maximumSurfaceHeight = (geometry.boundingBox?.max.z ?? 4.5) + 0.12;
    if (!clipAxis(rayLocalOrigin.x, rayLocalDirection.x, -half, half)
      || !clipAxis(rayLocalOrigin.y, rayLocalDirection.y, -half, half)
      || !clipAxis(rayLocalOrigin.z, rayLocalDirection.z, minimumSurfaceHeight, maximumSurfaceHeight)
      || exit < 0) return undefined;
    entry = Math.max(0, entry);
    const marchLength = exit - entry;
    const marchSteps = Math.min(768, Math.max(32, Math.ceil(marchLength / (spacing * 0.55))));
    const surfaceDelta = (travel: number) => {
      rayLocalPoint.copy(rayLocalDirection).multiplyScalar(travel).add(rayLocalOrigin);
      return rayLocalPoint.z - sampleSurfaceHeight(
        meta,
        position,
        rayLocalPoint.x,
        rayLocalPoint.y,
        rayTriangleScratch,
      );
    };
    let previousTravel = entry;
    let previousDelta = surfaceDelta(previousTravel);
    let lower = -1;
    let upper = -1;
    for (let step = 1; step <= marchSteps; step += 1) {
      const travel = THREE.MathUtils.lerp(entry, exit, step / marchSteps);
      const delta = surfaceDelta(travel);
      if (previousDelta >= 0 && delta <= 0) {
        lower = previousTravel;
        upper = travel;
        break;
      }
      previousTravel = travel;
      previousDelta = delta;
    }
    if (lower < 0) return undefined;
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (surfaceDelta(middle) > 0) lower = middle;
      else upper = middle;
    }
    const travel = (lower + upper) / 2;
    rayLocalPoint.copy(rayLocalDirection).multiplyScalar(travel).add(rayLocalOrigin);
    rayLocalPoint.z = sampleSurfaceHeight(
      meta,
      position,
      rayLocalPoint.x,
      rayLocalPoint.y,
      rayTriangleScratch,
    );
    const interactionHalf = half - spacing * 0.5;
    if (Math.max(Math.abs(rayLocalPoint.x), Math.abs(rayLocalPoint.y)) > interactionHalf) return undefined;

    const surfaceSample = sampleSurfaceTriangle(meta, rayLocalPoint.x, rayLocalPoint.y, rayTriangleScratch);
    rayLocalNormal.set(
      normal.getX(surfaceSample.i0) * surfaceSample.w0
        + normal.getX(surfaceSample.i1) * surfaceSample.w1
        + normal.getX(surfaceSample.i2) * surfaceSample.w2,
      normal.getY(surfaceSample.i0) * surfaceSample.w0
        + normal.getY(surfaceSample.i1) * surfaceSample.w1
        + normal.getY(surfaceSample.i2) * surfaceSample.w2,
      normal.getZ(surfaceSample.i0) * surfaceSample.w0
        + normal.getZ(surfaceSample.i1) * surfaceSample.w1
        + normal.getZ(surfaceSample.i2) * surfaceSample.w2,
    );
    if (color) {
      raySurfaceColor.setRGB(
        color.getX(surfaceSample.i0) * surfaceSample.w0
          + color.getX(surfaceSample.i1) * surfaceSample.w1
          + color.getX(surfaceSample.i2) * surfaceSample.w2,
        color.getY(surfaceSample.i0) * surfaceSample.w0
          + color.getY(surfaceSample.i1) * surfaceSample.w1
          + color.getY(surfaceSample.i2) * surfaceSample.w2,
        color.getZ(surfaceSample.i0) * surfaceSample.w0
          + color.getZ(surfaceSample.i1) * surfaceSample.w1
          + color.getZ(surfaceSample.i2) * surfaceSample.w2,
      );
    } else raySurfaceColor.setRGB(0.32, 0.18, 0.1);
    rayWorldPoint.copy(rayLocalPoint);
    ground.localToWorld(rayWorldPoint);
    rayWorldNormal.copy(rayLocalNormal).transformDirection(ground.matrixWorld).normalize();
    surfaceHitScratch.point.copy(rayWorldPoint);
    surfaceHitScratch.normal.copy(rayWorldNormal);
    surfaceHitScratch.color.copy(raySurfaceColor);
    surfaceHitScratch.distance = raycaster.ray.origin.distanceTo(rayWorldPoint);
    return surfaceHitScratch;
  };

  const visibleSurfaceHit = (ground: THREE.Mesh) => {
    const surfaceHit = intersectSurface(ground);
    if (!surfaceHit) return undefined;
    if (!roverOccluderRef.current?.parent) {
      roverOccluderRef.current = scene.getObjectByName('rover-soil-occluder') ?? null;
    }
    if (!roverRigRef.current?.parent) {
      roverRigRef.current = scene.getObjectByName('rover-model-rig') ?? null;
    }
    const roverOccluder = roverOccluderRef.current;
    if (!roverOccluder) return surfaceHit;
    const broadHit = raycaster.intersectObject(roverOccluder, false)[0];
    if (!broadHit || broadHit.distance >= surfaceHit.distance) return surfaceHit;

    // The invisible box is only a cheap broad-phase. The old implementation
    // treated the whole box as solid and rejected valid ground between every
    // wheel. Inside that region, resolve against the real rendered meshes so
    // metal blocks the trace while visible gaps remain live soil.
    const roverRig = roverRigRef.current;
    if (!roverRig) return surfaceHit;
    const roverHit = raycaster.intersectObject(roverRig, true).find((intersection) => {
      if (intersection.object === roverOccluder
        || intersection.object.name === 'rover-soil-occluder'
        || !intersection.object.visible) return false;
      const material = (intersection.object as THREE.Mesh).material;
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      return materials.length === 0 || materials.some((entry) => entry.visible && entry.opacity > 0.02);
    });
    return roverHit && roverHit.distance < surfaceHit.distance ? undefined : surfaceHit;
  };

  const deformSurface = (
    ground: THREE.Mesh,
    worldPoint: THREE.Vector3,
    worldDirection: THREE.Vector3,
    radius: number,
    pressure: number,
    contactOut: DeformationContact,
  ) => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return undefined;
    deformLocalPoint.copy(worldPoint);
    ground.worldToLocal(deformLocalPoint);
    const surfaceSpacing = meta.size / meta.segments;
    const interactionHalf = meta.size / 2 - surfaceSpacing * 0.5;
    if (Math.max(Math.abs(deformLocalPoint.x), Math.abs(deformLocalPoint.y)) > interactionHalf) return undefined;
    // The previous 1.85-cell floor turned low/medium quality traces into
    // half-metre trenches. 0.74 cells still always reaches the nearest grid
    // vertex while preserving the physical brush width on denser tiers.
    const contactRadius = Math.max(radius, surfaceSpacing * 0.74);

    deformDirectionEnd.copy(worldPoint).add(worldDirection);
    ground.worldToLocal(deformDirectionEnd);
    deformDirectionEnd.sub(deformLocalPoint).setZ(0);
    const directionalContact = deformDirectionEnd.lengthSq() > 0.000001;
    if (directionalContact) deformDirectionEnd.normalize();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const spacing = surfaceSpacing;
    const centerX = Math.round((deformLocalPoint.x + meta.size / 2) / spacing);
    const centerY = Math.round((meta.size / 2 - deformLocalPoint.y) / spacing);
    const reach = Math.ceil(contactRadius / spacing) + 1;
    let displaced = false;

    for (let row = Math.max(0, centerY - reach); row <= Math.min(meta.segments, centerY + reach); row += 1) {
      for (let column = Math.max(0, centerX - reach); column <= Math.min(meta.segments, centerX + reach); column += 1) {
        const index = row * (meta.segments + 1) + column;
        const dx = position.getX(index) - deformLocalPoint.x;
        const dy = position.getY(index) - deformLocalPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > contactRadius) continue;
        const ratio = distance / contactRadius;
        const forward = (dx * deformDirectionEnd.x + dy * deformDirectionEnd.y) / contactRadius;
        const lateral = (-dx * deformDirectionEnd.y + dy * deformDirectionEnd.x) / contactRadius;
        const forwardFalloff = 1 - THREE.MathUtils.smoothstep(Math.abs(forward), 0.62, 1);
        const core = directionalContact
          ? Math.exp(-((lateral / 0.38) ** 2)) * forwardFalloff
          : Math.exp(-((ratio / 0.48) ** 2));
        // Soil dragged by a point contact forms two continuous berms beside
        // the groove. A full circular rim creates the artificial chain of
        // craters that a texture/decal approach produces, so the bank is
        // deliberately lateral to motion instead.
        const sideBank = directionalContact
          ? Math.exp(-(((Math.abs(lateral) - 0.72) / 0.14) ** 2)) * forwardFalloff
          : Math.exp(-(((ratio - 0.72) / 0.14) ** 2));
        const displacedBank = sideBank * pressure * 0.18;
        const compressedCenter = -pressure * core;
        const nextDeformation = clamp(
          meta.deformations[index] + compressedCenter + displacedBank,
          -0.2,
          0.075,
        );
        if (Math.abs(nextDeformation - meta.deformations[index]) < 0.0000001) continue;
        meta.deformations[index] = nextDeformation;
        position.setZ(index, meta.baseHeights[index] + meta.deformations[index]);
        displaced = true;
        dirtyBounds.current.minColumn = Math.min(dirtyBounds.current.minColumn, column);
        dirtyBounds.current.maxColumn = Math.max(dirtyBounds.current.maxColumn, column);
        dirtyBounds.current.minRow = Math.min(dirtyBounds.current.minRow, row);
        dirtyBounds.current.maxRow = Math.max(dirtyBounds.current.maxRow, row);
      }
    }
    if (displaced) {
      position.needsUpdate = true;
      surfaceDirty.current = true;
    }
    return displaced
      ? projectDeformedSurfaceContact(
        ground,
        deformLocalPoint.x,
        deformLocalPoint.y,
        contactOut,
      )
      : undefined;
  };

  const emitDust = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    normal: THREE.Vector3,
    soilColor: THREE.Color,
    speedResponse: number,
    sustainedEnergy: number,
    count: number,
  ) => {
    const plume = THREE.MathUtils.smoothstep(
      clamp(speedResponse * (0.72 + sustainedEnergy * 0.34), 0, 1.15),
      0.025,
      1,
    );
    if (plume < 0.012) return;
    emissionTangent.copy(direction).addScaledVector(normal, -direction.dot(normal)).normalize();
    emissionSide.crossVectors(normal, emissionTangent).normalize();
    const lateralLaunch = THREE.MathUtils.lerp(0.012, 0.78, Math.pow(plume, 1.08))
      * (0.82 + sustainedEnergy * 0.32);
    const verticalLaunch = THREE.MathUtils.lerp(0.025, 1.18, Math.pow(plume, 1.16))
      * (0.78 + sustainedEnergy * 0.38);
    const forwardLaunch = THREE.MathUtils.lerp(0.018, 0.56, Math.pow(plume, 1.12));

    // Only genuinely energetic strokes liberate visible aggregate. These are
    // real lit meshes, not large point sprites, and remain a deliberately
    // small fraction of the plume so the effect reads as soil rather than hail.
    const grainResponse = THREE.MathUtils.smoothstep(speedResponse, 0.56, 0.94);
    const expectedGrains = count * grainResponse * (0.08 + sustainedEnergy * 0.12);
    const grainLaunches = Math.min(
      5,
      Math.floor(expectedGrains) + (Math.random() < expectedGrains % 1 ? 1 : 0),
    );
    for (let index = 0; index < grainLaunches; index += 1) {
      let grain: CoarseGrain | undefined;
      for (let offset = 0; offset < MAX_COARSE_GRAINS; offset += 1) {
        const candidateIndex = (coarseGrainIndex.current + offset) % MAX_COARSE_GRAINS;
        const candidate = coarseGrains.current[candidateIndex];
        if (candidate.life > 0) continue;
        grain = candidate;
        coarseGrainIndex.current = (candidateIndex + 1) % MAX_COARSE_GRAINS;
        break;
      }
      if (!grain) break;
      activeGrainCount.current += 1;
      grain.maxLife = THREE.MathUtils.lerp(0.42, 1.08, grainResponse)
        * (0.78 + Math.random() * 0.38);
      grain.life = grain.maxLife;
      grain.gravity = 2.65 + Math.random() * 0.75;
      grain.drag = 0.24 + Math.random() * 0.28;
      grain.bounces = 0;
      grain.scale = THREE.MathUtils.lerp(0.009, 0.027, plume)
        * (0.68 + Math.random() * 0.58);
      grain.color.copy(soilColor).multiplyScalar(0.42 + Math.random() * 0.32);
      grain.position.copy(origin)
        .addScaledVector(emissionTangent, (Math.random() - 0.5) * 0.055)
        .addScaledVector(emissionSide, (Math.random() - 0.5) * 0.085)
        .addScaledVector(normal, grain.scale * 0.9 + 0.006);
      grain.velocity.copy(emissionTangent).multiplyScalar(forwardLaunch * (0.34 + Math.random() * 0.54))
        .addScaledVector(emissionSide, (Math.random() - 0.5) * lateralLaunch * 1.35)
        .addScaledVector(normal, verticalLaunch * (0.34 + Math.random() * 0.56));
      grain.angularVelocity.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
      );
      grain.quaternion.setFromEuler(grainEuler.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ));
    }

    for (let index = 0; index < count; index += 1) {
      let particle: DustParticle | undefined;
      for (let offset = 0; offset < MAX_DUST; offset += 1) {
        const candidateIndex = (dustIndex.current + offset) % MAX_DUST;
        const candidate = particles.current[candidateIndex];
        if (candidate.life > 0) continue;
        particle = candidate;
        dustIndex.current = (candidateIndex + 1) % MAX_DUST;
        break;
      }
      if (!particle) break;
      activeDustCount.current += 1;
      particle.maxLife = THREE.MathUtils.lerp(0.2, 1.82, Math.pow(plume, 0.82))
        * (0.78 + Math.random() * 0.42)
        * (1 + sustainedEnergy * 0.24);
      particle.life = particle.maxLife;
      particle.drag = THREE.MathUtils.lerp(1.9, 0.72, plume) + Math.random() * 0.35;
      particle.gravity = THREE.MathUtils.lerp(0.2, 0.065, plume);
      particle.baseSize = THREE.MathUtils.lerp(0.01, 0.2, Math.pow(plume, 1.12))
        * (0.72 + Math.random() * 0.56);
      particle.opacity = THREE.MathUtils.lerp(0.012, 0.5, Math.pow(plume, 1.42))
        * (0.72 + Math.random() * 0.28);
      particle.expansion = THREE.MathUtils.lerp(0.14, 2.85, Math.pow(plume, 1.08))
        * (0.88 + sustainedEnergy * 0.28);
      particle.windInfluence = THREE.MathUtils.lerp(0.04, 1, plume);
      particle.seed = Math.random() * 100;
      particle.color.copy(soilColor).multiplyScalar(0.82 + Math.random() * 0.34);
      particle.normal.copy(normal);
      particle.position.copy(origin)
        .addScaledVector(emissionTangent, (Math.random() - 0.5) * (0.016 + plume * 0.09))
        .addScaledVector(emissionSide, (Math.random() - 0.5) * (0.018 + plume * 0.16))
        .addScaledVector(normal, 0.01 + Math.random() * (0.012 + plume * 0.045));
      particle.velocity.copy(emissionTangent).multiplyScalar((0.25 + Math.random() * 0.75) * forwardLaunch)
        .addScaledVector(emissionSide, (Math.random() - 0.5) * 2 * lateralLaunch)
        .addScaledVector(normal, (0.34 + Math.random() * 0.92) * verticalLaunch);
    }
  };

  const disturbPath = (
    ground: THREE.Mesh,
    from: THREE.Vector3,
    to: THREE.Vector3,
    soilColor: THREE.Color,
    screenSpeed: number,
    speedResponse: number,
    elapsedSeconds: number,
  ) => {
    const distance = from.distanceTo(to);
    if (distance < 0.00001) return false;
    const slowContact = 1 - THREE.MathUtils.smoothstep(screenSpeed, 26, 360);
    const radius = 0.168 + speedResponse * 0.026;
    // A slow cursor dwells against the surface and compacts it more deeply.
    // Pressure is deliberately based on CSS-pixel velocity, not world-space
    // ray travel, so orbit distance and camera zoom cannot change the feel.
    // Fast motion remains visibly deep; slow motion gains additional dwell.
    const basePressure = 0.0072 + slowContact * 0.0104 + speedResponse * 0.0004;
    const spacing = 0.065;
    const steps = Math.max(1, Math.min(240, Math.ceil(distance / spacing)));
    const effectiveSpacing = distance / steps;
    const pressure = basePressure * clamp(effectiveSpacing / spacing, 1, 2.8);
    pathDirectionScratch.copy(to).sub(from).normalize();

    let deformedContactCount = 0;
    for (let step = 1; step <= steps; step += 1) {
      pathPointScratch.copy(from).lerp(to, step / steps);
      const contact = deformSurface(
        ground,
        pathPointScratch,
        pathDirectionScratch,
        radius,
        pressure,
        deformationContactPool[deformedContactCount],
      );
      if (contact) deformedContactCount += 1;
    }
    if (deformedContactCount === 0) return false;

    motionEnergy.current = clamp(
      motionEnergy.current
        + elapsedSeconds * Math.pow(speedResponse, 1.22) * 1.65 * (deformedContactCount / steps),
      0,
      1,
    );

    // There is deliberately no fixed emission floor. Slow contact still
    // deforms deeply, but transfers almost all energy into compaction. Fast,
    // sustained motion transfers progressively more into airborne material.
    const deformedFraction = deformedContactCount / steps;
    const dustRate = 720
      * Math.pow(speedResponse, 2.35)
      * (0.22 + motionEnergy.current * 0.78)
      * deformedFraction;
    dustBirthBudget.current = Math.min(
      28,
      dustBirthBudget.current + dustRate * elapsedSeconds,
    );
    const births = Math.floor(dustBirthBudget.current);
    dustBirthBudget.current -= births;
    if (births <= 0) return true;
    const dustSamples = Math.min(12, births, deformedContactCount);
    for (let sample = 1; sample <= dustSamples; sample += 1) {
      const pointIndex = Math.min(
        deformedContactCount - 1,
        Math.floor((sample - 0.5) / dustSamples * deformedContactCount),
      );
      const contact = deformationContactPool[pointIndex];
      const count = Math.floor(births / dustSamples) + (sample <= births % dustSamples ? 1 : 0);
      const pointSoilColor = sampleSoilColorAtPoint(ground, contact.point, soilColor);
      emitDust(
        contact.point,
        pathDirectionScratch,
        contact.normal,
        pointSoilColor,
        speedResponse,
        motionEnergy.current,
        count,
      );
    }
    return true;
  };

  useFrame((state, delta) => {
    const ground = groundRef.current;
    const samples = pointerSamples.current.splice(0, pointerSamples.current.length);
    const pointerMoved = samples.length > 0;
    const cameraMoved = previousCameraPosition.current.distanceToSquared(camera.position) > 0.000004
      || 1 - Math.abs(previousCameraQuaternion.current.dot(camera.quaternion)) > 0.000002
      || !previousProjectionMatrix.current.equals(camera.projectionMatrix);
    previousCameraPosition.current.copy(camera.position);
    previousCameraQuaternion.current.copy(camera.quaternion);
    previousProjectionMatrix.current.copy(camera.projectionMatrix);
    motionEnergy.current *= Math.exp(-delta * 0.72);
    dustBirthBudget.current *= Math.exp(-delta * 3.2);

    // Reproject the previous *screen* contact through the new camera before
    // consuming this frame's pointer path. ScrollDirector applies pointer
    // parallax continuously; without this step its camera displacement gets
    // folded into the first soil segment and masquerades as cursor velocity.
    // Keeping the anchor in NDC preserves the user's real pointer delta even
    // on frames where both the camera and cursor legitimately move.
    if (cameraMoved) {
      if (
        ground
        && lastPoint.current
        && lastNdcPoint.current
        && pointerInside.current
        && !pointerBlocked.current
        && pointerButtons.current === 0
      ) {
        pointer.current.copy(lastNdcPoint.current);
        const reanchoredHit = visibleSurfaceHit(ground);
        if (reanchoredHit) {
          if (lastPoint.current) lastPoint.current.copy(reanchoredHit.point);
          else lastPoint.current = reanchoredHit.point.clone();
        } else lastPoint.current = null;
        if (!reanchoredHit) {
          lastScreenPoint.current = null;
          lastNdcPoint.current = null;
          velocityAnchorPoint.current = null;
          velocityAnchorTimestamp.current = 0;
          screenVelocity.current = 0;
        }
        if (!pointerMoved) setSurfaceCursor(Boolean(reanchoredHit));
      } else {
        lastPoint.current = null;
        lastScreenPoint.current = null;
        lastNdcPoint.current = null;
        velocityAnchorPoint.current = null;
        velocityAnchorTimestamp.current = 0;
        screenVelocity.current = 0;
      }
    }

    if (pointerMoved) {
      let latestHit: SurfaceHit | undefined;
      samples.forEach((sample) => {
        pointer.current.set(sample.ndcX, sample.ndcY);
        const previousTimestamp = processedTimestamp.current;
        const elapsedMs = sample.timestamp - previousTimestamp;
        const reanchor = previousTimestamp <= 0
          || !Number.isFinite(elapsedMs)
          || elapsedMs <= 0
          || elapsedMs > IDLE_REANCHOR_MS;
        processedTimestamp.current = sample.timestamp;
        const canHit = Boolean(
          ground
          && sample.inside
          && !sample.blocked
          && sample.buttons === 0,
        );
        const hit = canHit && ground ? visibleSurfaceHit(ground) : undefined;
        latestHit = hit;

        if (hit && ground) {
          pointerScreenScratch.set(sample.screenX, sample.screenY);
          if (reanchor) {
            motionEnergy.current = 0;
            dustBirthBudget.current = 0;
            screenVelocity.current = 0;
            velocityAnchorTimestamp.current = sample.timestamp;
            if (velocityAnchorPoint.current) velocityAnchorPoint.current.copy(pointerScreenScratch);
            else velocityAnchorPoint.current = pointerScreenScratch.clone();
          }
          if (!reanchor && lastPoint.current && lastScreenPoint.current) {
            const segmentPixels = lastScreenPoint.current.distanceTo(pointerScreenScratch);
            const velocityElapsedMs = sample.timestamp - velocityAnchorTimestamp.current;
            const velocityPixels = velocityAnchorPoint.current
              ? velocityAnchorPoint.current.distanceTo(pointerScreenScratch)
              : 0;
            if (
              velocityAnchorPoint.current
              && velocityElapsedMs > 0
              && velocityPixels >= 0.25
            ) {
              const instantaneousVelocity = velocityPixels / (velocityElapsedMs / 1000);
              const blend = 1 - Math.exp(-velocityElapsedMs / 22);
              screenVelocity.current = THREE.MathUtils.lerp(
                screenVelocity.current,
                instantaneousVelocity,
                blend,
              );
              velocityAnchorPoint.current.copy(pointerScreenScratch);
              velocityAnchorTimestamp.current = sample.timestamp;
            }
            // Duplicate/coalesced zero-distance events keep the physical
            // contact current, but never stamp or inherit the previous EMA.
            if (segmentPixels > 0.001) {
              const speedResponse = THREE.MathUtils.smoothstep(screenVelocity.current, 42, 1080);
              disturbPath(
                ground,
                lastPoint.current,
                hit.point,
                hit.color,
                screenVelocity.current,
                speedResponse,
                elapsedMs / 1000,
              );
            }
          } else {
            // First contact and post-idle events stamp only the current ray
            // contact. They never connect an old point across the gap or
            // manufacture a high velocity from a clamped elapsed time.
            pathDirectionScratch.set(0, 0, 0);
            deformSurface(
              ground,
              hit.point,
              pathDirectionScratch,
              0.15,
              0.0075,
              deformationContactScratch,
            );
          }
          if (!velocityAnchorPoint.current) {
            velocityAnchorPoint.current = pointerScreenScratch.clone();
            velocityAnchorTimestamp.current = sample.timestamp;
            screenVelocity.current = 0;
          }
          if (lastPoint.current) lastPoint.current.copy(hit.point);
          else lastPoint.current = hit.point.clone();
          if (lastScreenPoint.current) lastScreenPoint.current.copy(pointerScreenScratch);
          else lastScreenPoint.current = pointerScreenScratch.clone();
          if (lastNdcPoint.current) lastNdcPoint.current.set(sample.ndcX, sample.ndcY);
          else lastNdcPoint.current = new THREE.Vector2(sample.ndcX, sample.ndcY);
        } else {
          lastPoint.current = null;
          lastScreenPoint.current = null;
          lastNdcPoint.current = null;
          velocityAnchorPoint.current = null;
          velocityAnchorTimestamp.current = 0;
          screenVelocity.current = 0;
        }
      });
      setSurfaceCursor(Boolean(latestHit));
    }

    if (surfaceDirty.current && ground && state.clock.elapsedTime - lastNormalUpdate.current > 0.055) {
      const geometry = ground.geometry as THREE.BufferGeometry;
      const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
      const bounds = dirtyBounds.current;
      if (meta && Number.isFinite(bounds.minColumn)) {
        const stride = meta.segments + 1;
        const spacing = meta.size / meta.segments;
        const minColumn = Math.max(0, bounds.minColumn - 1);
        const maxColumn = Math.min(meta.segments, bounds.maxColumn + 1);
        const minRow = Math.max(0, bounds.minRow - 1);
        const maxRow = Math.min(meta.segments, bounds.maxRow + 1);

        for (let row = minRow; row <= maxRow; row += 1) {
          for (let column = minColumn; column <= maxColumn; column += 1) {
            const index = row * stride + column;
            const left = row * stride + Math.max(0, column - 1);
            const right = row * stride + Math.min(meta.segments, column + 1);
            const up = Math.max(0, row - 1) * stride + column;
            const down = Math.min(meta.segments, row + 1) * stride + column;
            const dxScale = column === 0 || column === meta.segments ? spacing : spacing * 2;
            const dyScale = row === 0 || row === meta.segments ? spacing : spacing * 2;
            const slopeX = (position.getZ(right) - position.getZ(left)) / dxScale;
            const slopeY = (position.getZ(up) - position.getZ(down)) / dyScale;
            const inverseLength = 1 / Math.sqrt(slopeX * slopeX + slopeY * slopeY + 1);
            normal.setXYZ(
              index,
              -slopeX * inverseLength,
              -slopeY * inverseLength,
              inverseLength,
            );
          }
        }
        normal.needsUpdate = true;
      }
      dirtyBounds.current = {
        minColumn: Number.POSITIVE_INFINITY,
        maxColumn: Number.NEGATIVE_INFINITY,
        minRow: Number.POSITIVE_INFINITY,
        maxRow: Number.NEGATIVE_INFINITY,
      };
      surfaceDirty.current = false;
      lastNormalUpdate.current = state.clock.elapsedTime;
    }

    const positions = dustGeometry.getAttribute('position') as THREE.BufferAttribute;
    const sizes = dustGeometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alphas = dustGeometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const seeds = dustGeometry.getAttribute('aSeed') as THREE.BufferAttribute;
    const colors = dustGeometry.getAttribute('aColor') as THREE.BufferAttribute;
    const dustNormals = dustGeometry.getAttribute('aNormal') as THREE.BufferAttribute;
    const frameStep = Math.min(delta, 0.04);
    dustUniforms.uTime.value = state.clock.elapsedTime;

    if (activeDustCount.current > 0) {
      let dustChanged = false;
      particles.current.forEach((particle, index) => {
        if (particle.life <= 0) return;
        particle.life -= frameStep;
        if (particle.life <= 0) {
          particle.life = 0;
          activeDustCount.current = Math.max(0, activeDustCount.current - 1);
          positions.setXYZ(index, 0, -999, 0);
          sizes.setX(index, 0);
          alphas.setX(index, 0);
          dustChanged = true;
          return;
        }
        const turbulence = Math.sin(state.clock.elapsedTime * 5.1 + particle.seed) * 0.024;
        particle.velocity.x += (0.045 + turbulence) * particle.windInfluence * frameStep;
        particle.velocity.z += (-0.014 + turbulence * 0.45) * particle.windInfluence * frameStep;
        particle.velocity.y -= particle.gravity * frameStep;
        particle.velocity.multiplyScalar(Math.exp(-particle.drag * frameStep));
        particle.position.addScaledVector(particle.velocity, frameStep);
        const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const ageRatio = 1 - lifeRatio;
        const bloom = Math.sin((1 - lifeRatio) * Math.PI);
        const fadeIn = THREE.MathUtils.smoothstep(ageRatio, 0, 0.12);
        const fadeOut = THREE.MathUtils.smoothstep(lifeRatio, 0, 0.28);
        positions.setXYZ(index, particle.position.x, particle.position.y, particle.position.z);
        sizes.setX(index, particle.baseSize * (0.72 + bloom * particle.expansion));
        alphas.setX(index, particle.opacity * fadeIn * fadeOut * (0.72 + bloom * 0.28));
        seeds.setX(index, particle.seed);
        colors.setXYZ(index, particle.color.r, particle.color.g, particle.color.b);
        dustNormals.setXYZ(index, particle.normal.x, particle.normal.y, particle.normal.z);
        dustChanged = true;
      });
      if (dustChanged) {
        positions.needsUpdate = true;
        sizes.needsUpdate = true;
        alphas.needsUpdate = true;
        seeds.needsUpdate = true;
        colors.needsUpdate = true;
        dustNormals.needsUpdate = true;
      }
    }

    const coarseMesh = coarseGrainsRef.current;
    if (coarseMesh && activeGrainCount.current > 0) {
      let colorChanged = false;
      let matrixChanged = false;
      coarseGrains.current.forEach((grain, index) => {
        if (grain.life <= 0) return;
        grain.life -= frameStep;
        grain.velocity.y -= grain.gravity * frameStep;
        grain.velocity.multiplyScalar(Math.exp(-grain.drag * frameStep));
        grain.position.addScaledVector(grain.velocity, frameStep);
        grainSpin.setFromEuler(grainEuler.set(
          grain.angularVelocity.x * frameStep,
          grain.angularVelocity.y * frameStep,
          grain.angularVelocity.z * frameStep,
        ));
        grain.quaternion.multiply(grainSpin).normalize();

        if (ground && grain.life > 0) {
          grainLocalPoint.copy(grain.position);
          ground.worldToLocal(grainLocalPoint);
          const contact = projectDeformedSurfaceContact(
            ground,
            grainLocalPoint.x,
            grainLocalPoint.y,
            grainContactScratch,
          );
          if (contact && grainLocalPoint.z <= contact.localPoint.z + grain.scale * 0.55) {
            const incomingVelocity = grain.velocity.dot(contact.normal);
            if (grain.bounces < 1 && incomingVelocity < -0.13 && grain.life > 0.18) {
              grain.position.copy(contact.point).addScaledVector(contact.normal, grain.scale * 0.62);
              grain.velocity.reflect(contact.normal).multiplyScalar(0.3);
              grain.angularVelocity.multiplyScalar(0.56);
              grain.bounces += 1;
            } else {
              grain.life = 0;
            }
          }
        }

        if (grain.life <= 0) {
          grain.life = 0;
          activeGrainCount.current = Math.max(0, activeGrainCount.current - 1);
          grainTransform.position.set(0, -999, 0);
          grainTransform.quaternion.identity();
          grainTransform.scale.setScalar(0.00001);
        } else {
          grainTransform.position.copy(grain.position);
          grainTransform.quaternion.copy(grain.quaternion);
          grainTransform.scale.setScalar(grain.scale);
          coarseMesh.setColorAt(index, grain.color);
          colorChanged = true;
        }
        grainTransform.updateMatrix();
        coarseMesh.setMatrixAt(index, grainTransform.matrix);
        matrixChanged = true;
      });
      if (matrixChanged) coarseMesh.instanceMatrix.needsUpdate = true;
      if (colorChanged && coarseMesh.instanceColor) coarseMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <points ref={dustRef} geometry={dustGeometry} frustumCulled={false} renderOrder={8}>
        <shaderMaterial
          uniforms={dustUniforms}
          vertexShader={DUST_VERTEX_SHADER}
          fragmentShader={DUST_FRAGMENT_SHADER}
          transparent
          depthTest
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
      <instancedMesh
        ref={coarseGrainsRef}
        args={[undefined, undefined, MAX_COARSE_GRAINS]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} metalness={0} envMapIntensity={0.05} />
      </instancedMesh>
    </>
  );
}

export default SoilInteraction;
