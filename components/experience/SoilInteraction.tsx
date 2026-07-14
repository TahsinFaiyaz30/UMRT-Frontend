'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '@/lib/performance';

const MAX_DUST = 1400;
const MAX_COARSE_GRAINS = 96;
const IDLE_REANCHOR_MS = 140;
const DUST_FLOATS_PER_PARTICLE = 15;
const DUST_ATTRIBUTE_OFFSET = {
  position: 0,
  size: 3,
  alpha: 4,
  seed: 5,
  profile: 6,
  stretch: 7,
  rotation: 8,
  color: 9,
  flow: 12,
} as const;

// The deformation grid is expressed in metres. Keep the source term in real
// mass units so pointer event frequency cannot manufacture matter. These are
// dry, loose terrestrial-soil values; the particle renderer later groups that
// mass into visible packets rather than pretending one sprite is one grain.
const SOIL_BULK_DENSITY_KG_M3 = 1450;
const SOIL_COMPACTION_YIELD_PA = 32000;
const LOOSE_FINE_LOADING_KG_M2 = 0.072;
const MAX_FINE_LOADING_KG_M2 = 0.22;
const DEFORMATION_FINE_YIELD = 0.0035;
const DRY_SOIL_RELEASE_FACTOR = 0.82;
const VISUAL_DUST_PACKET_MASS_KG = 0.000075;
const MIN_FRACTIONAL_PACKET_MASS_KG = VISUAL_DUST_PACKET_MASS_KG * 0.025;
const MAX_PACKET_BIRTHS_PER_PATH = 96;
const MAX_BUFFERED_DUST_MASS_KG = VISUAL_DUST_PACKET_MASS_KG * MAX_PACKET_BIRTHS_PER_PATH;
// A cloud packet is dominated by micron fines, whose extinction cross-section
// per unit mass is far larger than that of visible sand. These conservative
// class averages sit below the ideal-sphere limit but preserve that physics.
const FINE_MASS_EXTINCTION_M2_KG = 300;
const SHORT_SUSPENSION_EXTINCTION_M2_KG = 70;

// Transport is intentionally terrestrial. A dust point is a small packet of
// many grains, while the instanced clasts are integrated as individual mineral
// grains in Earth air. The almost-still background flow only prevents a
// perfectly frozen plume; energetic motion comes from the contact itself and
// decays after the cursor has passed.
const EARTH_GRAVITY_M_S2 = 9.80665;
const EARTH_AIR_DENSITY_KG_M3 = 1.204;
const EARTH_AIR_DYNAMIC_VISCOSITY_PA_S = 1.81e-5;
const MINERAL_PARTICLE_DENSITY_KG_M3 = 2650;
const AMBIENT_AIR_X_M_S = 0.075;
const AMBIENT_AIR_Z_M_S = -0.028;
const DUST_OPTICAL_DEPTH_EPSILON = 0.0035;

const DUST_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  attribute float aProfile;
  attribute float aStretch;
  attribute float aRotation;
  attribute vec3 aColor;
  attribute vec3 aFlow;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSeed;
  varying float vProfile;
  varying float vStretch;
  varying float vRotation;
  varying vec3 vColor;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewFlow = mat3(modelViewMatrix) * aFlow;
    gl_Position = projectionMatrix * mvPosition;
    // aSize stores the two-sigma packet diameter used by the mass/diffusion
    // model. Render to roughly 2.5 sigma so the optically thin outer plume is
    // visible instead of collapsing each world-space cloudlet to a few pixels.
    gl_PointSize = clamp(
      aSize * 2.8 * max(1.0, aStretch) * uPixelRatio * (520.0 / max(0.8, -mvPosition.z)),
      1.35,
      112.0 * uPixelRatio
    );
    vAlpha = aAlpha;
    vSeed = aSeed;
    vProfile = aProfile;
    vStretch = max(1.0, aStretch);
    vRotation = atan(viewFlow.y, viewFlow.x) + aRotation;
    vColor = aColor;
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  }
`;

const DUST_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying float vSeed;
  varying float vProfile;
  varying float vStretch;
  varying float vRotation;
  varying vec3 vColor;
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
    vec2 spritePoint = gl_PointCoord - 0.5;
    float cosine = cos(vRotation);
    float sine = sin(vRotation);
    // Rotate into the velocity frame, then restore the minor axis that was
    // enlarged by gl_PointSize. This lets each particle become a real low
    // saltation streak or a gently elongated suspended volume instead of the
    // same camera-facing circle.
    vec2 point = vec2(
      cosine * spritePoint.x + sine * spritePoint.y,
      -sine * spritePoint.x + cosine * spritePoint.y
    );
    point.y *= vStretch;
    float radius = length(point);
    float lowNoise = noise21(point * 5.4 + vec2(vSeed * 0.73, uTime * 0.028));
    float highNoise = noise21(point * 12.6 - vec2(uTime * 0.041, vSeed * 1.17));
    float densityNoise = lowNoise * 0.68 + highNoise * 0.32;

    // Profile 0 is a thin, velocity-aligned sheet of saltating dust at the
    // contact. Profile 1 is the optically softer suspended micron fraction.
    float irregularEdge = 0.455 + (densityNoise - 0.5) * mix(0.035, 0.085, vProfile);
    float radialMask = 1.0 - smoothstep(irregularEdge * 0.55, irregularEdge, radius);
    float streakMask = exp(-abs(point.y) * 12.5)
      * (1.0 - smoothstep(0.27, 0.49, abs(point.x)));
    float fineCore = 1.0 - smoothstep(0.025, irregularEdge, radius);
    float brokenFilament = pow(smoothstep(0.3, 0.82, densityNoise), 2.2);
    float fineDensity = fineCore * (0.16 + densityNoise * 0.5)
      + radialMask * brokenFilament * 0.24;
    float opticalDepth = mix(streakMask * (0.56 + densityNoise * 0.44), fineDensity, vProfile)
      * radialMask;
    if (opticalDepth < 0.012) discard;
    // vAlpha is the packet's centre optical depth after mass-conserving area
    // dilution on the CPU. Beer-Lambert extinction composes overlapping
    // packets without turning the cloud into an additive glow.
    float packetOpticalDepth = vAlpha * opticalDepth;
    float transmittance = exp(-packetOpticalDepth);
    float alpha = 1.0 - transmittance;

    // The albedo comes from the exact deformed texel. Lighting is volumetric:
    // a neutral sky term plus solar single scattering, with the particle class
    // controlling the Henyey-Greenstein anisotropy. No emissive/glow term is
    // present, so dust cannot stay neon when the calibrated sun is dimmed.
    float illumination = clamp(uSunStrength, 0.0, 2.5);
    vec3 lightDirection = normalize(uSunDirection);
    vec3 viewDirection = normalize(vViewDirection);
    // Mineral dust is strongly forward scattering. The relative HG phase is
    // written in normalized form and then converted to a gain relative to an
    // isotropic phase function for the renderer's radiance scale.
    float anisotropy = mix(0.79, 0.72, vProfile);
    float phaseCosine = clamp(dot(-lightDirection, viewDirection), -1.0, 1.0);
    float anisotropySquared = anisotropy * anisotropy;
    float phase = (1.0 - anisotropySquared) / (12.5663706 * pow(
      max(0.075, 1.0 + anisotropySquared - 2.0 * anisotropy * phaseCosine),
      1.5
    ));
    float phaseGain = clamp(phase * 12.5663706, 0.2, 5.2);
    float solarLuminance = dot(uSunColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 diffuseSpectrum = mix(uSunColor, vec3(solarLuminance), 0.54);
    vec3 singleScatteringAlbedo = mix(
      vec3(0.93, 0.89, 0.80),
      vec3(0.97, 0.93, 0.84),
      vProfile
    );
    // uSunStrength is normalized against the scene's 3.25-intensity key light.
    // A Lambertian irradiance/pi scale is therefore close to one here; the old
    // 0.2–0.31 factor under-lit airborne dust by several stops relative to the
    // same mineral on the ground.
    vec3 ambientScatter = diffuseSpectrum * sqrt(illumination) * 0.38;
    vec3 directScatter = uSunColor * illumination
      * mix(0.72, 1.05, vProfile)
      * phaseGain;
    // Illumination penetrating to the centre falls as optical depth grows, so
    // dense puffs shade themselves while their optically thin margins retain
    // the strongest forward-scattered light.
    float coreLight = mix(0.5, 1.0, transmittance);
    vec3 litColor = vColor * singleScatteringAlbedo * (
      ambientScatter * mix(0.66, 1.0, transmittance)
      + directScatter * coreLight
    );
    gl_FragColor = vec4(litColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

type SurfaceMeta = {
  size: number;
  segments: number;
  baseHeights: Float32Array;
  deformations: Float32Array;
  looseFines?: Float32Array;
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

const MAX_QUEUED_POINTER_SAMPLES = 96;

function emptyPointerSample(): PointerSample {
  return {
    ndcX: 0,
    ndcY: 0,
    screenX: 0,
    screenY: 0,
    timestamp: 0,
    inside: false,
    blocked: false,
    buttons: 0,
  };
}

function copyPointerSample(target: PointerSample, source: PointerSample) {
  target.ndcX = source.ndcX;
  target.ndcY = source.ndcY;
  target.screenX = source.screenX;
  target.screenY = source.screenY;
  target.timestamp = source.timestamp;
  target.inside = source.inside;
  target.blocked = source.blocked;
  target.buttons = source.buttons;
}

type DustParticle = {
  activeListIndex: number;
  profile: number;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  responseRate: number;
  settlingSpeed: number;
  baseSize: number;
  opticalDepth: number;
  diffusivity: number;
  initialProjectedArea: number;
  massKg: number;
  stretch: number;
  rotation: number;
  inducedFlow: THREE.Vector3;
  flowDecay: number;
  turbulenceScale: number;
  turbulenceStrength: number;
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
  scale: THREE.Vector3;
  radius: number;
  gravity: number;
  bounces: number;
  color: THREE.Color;
};

type DeformationContact = {
  localPoint: THREE.Vector3;
  point: THREE.Vector3;
  localNormal: THREE.Vector3;
  normal: THREE.Vector3;
  disturbedVolume: number;
  compressedVolume: number;
  deformationWork: number;
  maximumPenetration: number;
  generatedFineMass: number;
  releasedFineMass: number;
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

type AttributeRowUpdates = {
  segments: number;
  minColumns: Int32Array;
  maxColumns: Int32Array;
  touchedRows: Int32Array;
  touchedCount: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function srgbChannelToLinear(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function wrappedTextureIndex(index: number, size: number, wrapping: THREE.Wrapping) {
  if (wrapping === THREE.RepeatWrapping) return ((index % size) + size) % size;
  if (wrapping === THREE.MirroredRepeatWrapping) {
    const period = size * 2;
    const wrapped = ((index % period) + period) % period;
    return wrapped < size ? wrapped : period - wrapped - 1;
  }
  return clamp(index, 0, size - 1);
}

function createAttributeRowUpdates(segments: number): AttributeRowUpdates {
  const minColumns = new Int32Array(segments + 1);
  const maxColumns = new Int32Array(segments + 1);
  minColumns.fill(segments + 1);
  maxColumns.fill(-1);
  return {
    segments,
    minColumns,
    maxColumns,
    touchedRows: new Int32Array(segments + 1),
    touchedCount: 0,
  };
}

function trackAttributeVertex(
  updates: AttributeRowUpdates,
  row: number,
  column: number,
  padding: number,
) {
  const minimumRow = Math.max(0, row - padding);
  const maximumRow = Math.min(updates.segments, row + padding);
  const minimumColumn = Math.max(0, column - padding);
  const maximumColumn = Math.min(updates.segments, column + padding);
  for (let trackedRow = minimumRow; trackedRow <= maximumRow; trackedRow += 1) {
    if (updates.maxColumns[trackedRow] < 0) {
      updates.touchedRows[updates.touchedCount] = trackedRow;
      updates.touchedCount += 1;
    }
    updates.minColumns[trackedRow] = Math.min(
      updates.minColumns[trackedRow],
      minimumColumn,
    );
    updates.maxColumns[trackedRow] = Math.max(
      updates.maxColumns[trackedRow],
      maximumColumn,
    );
  }
}

function resetAttributeRowUpdates(updates: AttributeRowUpdates) {
  for (let index = 0; index < updates.touchedCount; index += 1) {
    const row = updates.touchedRows[index];
    updates.minColumns[row] = updates.segments + 1;
    updates.maxColumns[row] = -1;
  }
  updates.touchedCount = 0;
}

function uploadAttributeRows(
  attribute: THREE.BufferAttribute,
  updates: AttributeRowUpdates,
) {
  const stride = updates.segments + 1;
  attribute.clearUpdateRanges();

  // A normal stroke touches only a compact set of rows, where precise ranges
  // minimize transferred bytes. A rapid high-polling sweep can touch hundreds
  // of rows in one frame; issuing hundreds of bufferSubData commands makes the
  // browser/GPU command queue balloon. Collapse that exceptional case into a
  // single bounding upload so command memory stays bounded.
  const maximumPreciseRanges = 4;
  if (updates.touchedCount <= maximumPreciseRanges) {
    for (let index = 0; index < updates.touchedCount; index += 1) {
      const row = updates.touchedRows[index];
      const minColumn = updates.minColumns[row];
      const maxColumn = updates.maxColumns[row];
      attribute.addUpdateRange(
        (row * stride + minColumn) * attribute.itemSize,
        (maxColumn - minColumn + 1) * attribute.itemSize,
      );
    }
  } else {
    let firstVertex = Number.POSITIVE_INFINITY;
    let lastVertex = -1;
    for (let index = 0; index < updates.touchedCount; index += 1) {
      const row = updates.touchedRows[index];
      firstVertex = Math.min(firstVertex, row * stride + updates.minColumns[row]);
      lastVertex = Math.max(lastVertex, row * stride + updates.maxColumns[row]);
    }
    attribute.addUpdateRange(
      firstVertex * attribute.itemSize,
      (lastVertex - firstVertex + 1) * attribute.itemSize,
    );
  }
  attribute.needsUpdate = true;
}

function getLooseFineReservoir(meta: SurfaceMeta) {
  if (meta.looseFines?.length === meta.baseHeights.length) return meta.looseFines;
  const representedArea = (meta.size / meta.segments) ** 2;
  const reservoir = new Float32Array(meta.baseHeights.length);
  reservoir.fill(LOOSE_FINE_LOADING_KG_M2 * representedArea);
  meta.looseFines = reservoir;
  return reservoir;
}

function returnFineMassToSurface(
  meta: SurfaceMeta,
  localX: number,
  localY: number,
  massKg: number,
  scratch: SurfaceTriangleSample,
) {
  if (massKg <= 0) return;
  const sample = sampleSurfaceTriangle(meta, localX, localY, scratch);
  const representedArea = (meta.size / meta.segments) ** 2;
  const maximumFineMass = MAX_FINE_LOADING_KG_M2 * representedArea;
  const reservoir = getLooseFineReservoir(meta);
  reservoir[sample.i0] = Math.min(
    maximumFineMass,
    reservoir[sample.i0] + massKg * sample.w0,
  );
  reservoir[sample.i1] = Math.min(
    maximumFineMass,
    reservoir[sample.i1] + massKg * sample.w1,
  );
  reservoir[sample.i2] = Math.min(
    maximumFineMass,
    reservoir[sample.i2] + massKg * sample.w2,
  );
}

function resetDeformationAccounting(contact: DeformationContact) {
  contact.disturbedVolume = 0;
  contact.compressedVolume = 0;
  contact.deformationWork = 0;
  contact.maximumPenetration = 0;
  contact.generatedFineMass = 0;
  contact.releasedFineMass = 0;
}

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
  quality,
  sunDirectionRef,
  sunRevisionRef,
  sunDaylightRef,
  sunColor,
  sunStrength,
}: {
  groundRef: RefObject<THREE.Mesh | null>;
  quality: Quality;
  sunDirectionRef: RefObject<readonly [number, number, number]>;
  sunRevisionRef: RefObject<number>;
  sunDaylightRef: RefObject<number>;
  sunColor: string;
  sunStrength: number;
}) {
  const { camera, gl, raycaster, scene } = useThree();
  const dustRef = useRef<THREE.Points>(null);
  const appliedSunRevisionRef = useRef(-1);
  const dustMaterialRef = useRef<THREE.ShaderMaterial>(null);
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
  const pointerSamplePool = useRef<PointerSample[]>(
    Array.from({ length: MAX_QUEUED_POINTER_SAMPLES }, emptyPointerSample),
  );
  const processedTimestamp = useRef(0);
  const lastPointStorage = useRef(new THREE.Vector3());
  const lastScreenPointStorage = useRef(new THREE.Vector2());
  const lastNdcPointStorage = useRef(new THREE.Vector2());
  const velocityAnchorPointStorage = useRef(new THREE.Vector2());
  const lastPoint = useRef<THREE.Vector3 | null>(null);
  const lastScreenPoint = useRef<THREE.Vector2 | null>(null);
  const lastNdcPoint = useRef<THREE.Vector2 | null>(null);
  const velocityAnchorPoint = useRef<THREE.Vector2 | null>(null);
  const velocityAnchorTimestamp = useRef(0);
  const screenVelocity = useRef(0);
  const dustIndex = useRef(0);
  const coarseGrainIndex = useRef(0);
  const activeDustCount = useRef(0);
  // A fixed-size sparse set avoids growing/shrinking a JavaScript array while
  // dust is continuously emitted and retired.
  const activeDustIndices = useRef(new Int32Array(MAX_DUST));
  const activeGrainCount = useRef(0);
  const surfaceActive = useRef(false);
  const surfaceDirty = useRef(false);
  const lastNormalUpdate = useRef(0);
  const motionEnergy = useRef(0);
  const dustMassBudget = useRef(0);
  const positionRowUpdates = useRef<AttributeRowUpdates | null>(null);
  const normalRowUpdates = useRef<AttributeRowUpdates | null>(null);
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
      activeListIndex: -1,
      profile: 1,
      life: 0,
      maxLife: 1,
      position: new THREE.Vector3(0, -999, 0),
      velocity: new THREE.Vector3(),
      responseRate: 2,
      settlingSpeed: 0,
      baseSize: 0.03,
      opticalDepth: 0,
      diffusivity: 0,
      initialProjectedArea: 0.001,
      massKg: 0,
      stretch: 1,
      rotation: 0,
      inducedFlow: new THREE.Vector3(),
      flowDecay: 1,
      turbulenceScale: 1,
      turbulenceStrength: 0,
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
      scale: new THREE.Vector3(0.01, 0.01, 0.01),
      radius: 0.01,
      gravity: EARTH_GRAVITY_M_S2,
      bounces: 0,
      color: new THREE.Color(0.2, 0.08, 0.035),
    })),
  );
  const grainTransform = useMemo(() => new THREE.Object3D(), []);
  const grainSpin = useMemo(() => new THREE.Quaternion(), []);
  const grainEuler = useMemo(() => new THREE.Euler(), []);
  const grainLocalPoint = useMemo(() => new THREE.Vector3(), []);
  const grainRelativeAir = useMemo(() => new THREE.Vector3(), []);
  const soilTriangleScratch = useMemo(createSurfaceTriangleSample, []);
  const rayTriangleScratch = useMemo(createSurfaceTriangleSample, []);
  const dustDepositTriangleScratch = useMemo(createSurfaceTriangleSample, []);
  const deformationContactPool = useMemo<DeformationContact[]>(
    () => Array.from({ length: 240 }, () => ({
      localPoint: new THREE.Vector3(),
      point: new THREE.Vector3(),
      localNormal: new THREE.Vector3(0, 0, 1),
      normal: new THREE.Vector3(0, 1, 0),
      disturbedVolume: 0,
      compressedVolume: 0,
      deformationWork: 0,
      maximumPenetration: 0,
      generatedFineMass: 0,
      releasedFineMass: 0,
    })),
    [],
  );
  const deformationContactScratch = useMemo<DeformationContact>(() => ({
    localPoint: new THREE.Vector3(),
    point: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    disturbedVolume: 0,
    compressedVolume: 0,
    deformationWork: 0,
    maximumPenetration: 0,
    generatedFineMass: 0,
    releasedFineMass: 0,
  }), []);
  const grainContactScratch = useMemo<DeformationContact>(() => ({
    localPoint: new THREE.Vector3(),
    point: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    disturbedVolume: 0,
    compressedVolume: 0,
    deformationWork: 0,
    maximumPenetration: 0,
    generatedFineMass: 0,
    releasedFineMass: 0,
  }), []);
  const dustContactScratch = useMemo<DeformationContact>(() => ({
    localPoint: new THREE.Vector3(),
    point: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    disturbedVolume: 0,
    compressedVolume: 0,
    deformationWork: 0,
    maximumPenetration: 0,
    generatedFineMass: 0,
    releasedFineMass: 0,
  }), []);
  const dustLocalPoint = useMemo(() => new THREE.Vector3(), []);
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

  const dustRenderData = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    // These fields change together every frame. Keeping them in one dynamic
    // interleaved buffer turns nine WebGL uploads into one without changing
    // any shader input or visual value.
    const array = new Float32Array(MAX_DUST * DUST_FLOATS_PER_PARTICLE);
    for (let index = 0; index < MAX_DUST; index += 1) {
      const offset = index * DUST_FLOATS_PER_PARTICLE;
      array[offset + DUST_ATTRIBUTE_OFFSET.position] = -999;
      array[offset + DUST_ATTRIBUTE_OFFSET.position + 1] = -999;
      array[offset + DUST_ATTRIBUTE_OFFSET.position + 2] = -999;
      array[offset + DUST_ATTRIBUTE_OFFSET.stretch] = 1;
      array[offset + DUST_ATTRIBUTE_OFFSET.flow] = 1;
    }
    const buffer = new THREE.InterleavedBuffer(array, DUST_FLOATS_PER_PARTICLE);
    buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(
      buffer, 3, DUST_ATTRIBUTE_OFFSET.position,
    ));
    geometry.setAttribute('aSize', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.size,
    ));
    geometry.setAttribute('aAlpha', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.alpha,
    ));
    geometry.setAttribute('aSeed', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.seed,
    ));
    geometry.setAttribute('aProfile', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.profile,
    ));
    geometry.setAttribute('aStretch', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.stretch,
    ));
    geometry.setAttribute('aRotation', new THREE.InterleavedBufferAttribute(
      buffer, 1, DUST_ATTRIBUTE_OFFSET.rotation,
    ));
    geometry.setAttribute('aColor', new THREE.InterleavedBufferAttribute(
      buffer, 3, DUST_ATTRIBUTE_OFFSET.color,
    ));
    geometry.setAttribute('aFlow', new THREE.InterleavedBufferAttribute(
      buffer, 3, DUST_ATTRIBUTE_OFFSET.flow,
    ));
    return { geometry, buffer };
  }, []);
  const dustGeometry = dustRenderData.geometry;
  const dustInterleavedBuffer = dustRenderData.buffer;

  useEffect(() => () => {
    dustGeometry.dispose();
    pointerSamples.current.length = 0;
    activeDustCount.current = 0;
    particles.current.length = 0;
    coarseGrains.current.length = 0;
    albedoTextureRef.current = null;
    albedoSamplerRef.current = null;
    roverOccluderRef.current = null;
    roverRigRef.current = null;
    positionRowUpdates.current = null;
    normalRowUpdates.current = null;
  }, [dustGeometry]);

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
    let canvasBounds = gl.domElement.getBoundingClientRect();
    const updateCanvasBounds = () => {
      canvasBounds = gl.domElement.getBoundingClientRect();
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateCanvasBounds);
    resizeObserver?.observe(gl.domElement);
    window.addEventListener('resize', updateCanvasBounds, { passive: true });

    const updatePointer = (event: PointerEvent) => {
      if (finePointer && !finePointer.matches) return;
      const bounds = canvasBounds;
      const blocked = event.target instanceof Element
        && Boolean(event.target.closest(
          'a, button, input, [role="button"], .mission-loader, .teardown-console, [aria-label="Solar calibration"], [data-page-footer]',
        ));
      const coalesced = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : [];

      const queueSample = (sample: PointerEvent) => {
        const inside = sample.clientX >= bounds.left
          && sample.clientX <= bounds.right
          && sample.clientY >= bounds.top
          && sample.clientY <= bounds.bottom;
        const screenX = sample.clientX - bounds.left;
        const screenY = sample.clientY - bounds.top;
        const ndcX = (screenX / Math.max(1, bounds.width)) * 2 - 1;
        const ndcY = -(screenY / Math.max(1, bounds.height)) * 2 + 1;
        const queuedSamples = pointerSamples.current;
        const queuedTail = queuedSamples[queuedSamples.length - 1];
        const canSpatiallyCoalesce = queuedTail
          && queuedTail.inside === inside
          && queuedTail.blocked === blocked
          && queuedTail.buttons === sample.buttons
          && sample.timeStamp - queuedTail.timestamp <= 6
          && (screenX - queuedTail.screenX) ** 2 + (screenY - queuedTail.screenY) ** 2 < 0.64;
        if (canSpatiallyCoalesce) {
          // Replace only the tail of a sub-pixel run. The preceding retained
          // point still connects to this newest endpoint, preserving a
          // continuous deformation path without raymarching 8 kHz mouse noise.
          queuedTail.ndcX = ndcX;
          queuedTail.ndcY = ndcY;
          queuedTail.screenX = screenX;
          queuedTail.screenY = screenY;
          queuedTail.timestamp = sample.timeStamp;
        } else {
          if (queuedSamples.length >= MAX_QUEUED_POINTER_SAMPLES) {
            // Keep the oldest endpoint and every second sample, copying values
            // back into the fixed pool. High-polling mice can now produce an
            // arbitrarily long burst without allocating fallback objects.
            const retainedCount = MAX_QUEUED_POINTER_SAMPLES / 2;
            for (let index = 1; index < retainedCount; index += 1) {
              const pooledSample = pointerSamplePool.current[index];
              copyPointerSample(pooledSample, queuedSamples[index * 2]);
              queuedSamples[index] = pooledSample;
            }
            queuedSamples.length = retainedCount;
          }
          const queuedSample = pointerSamplePool.current[queuedSamples.length];
          queuedSample.ndcX = ndcX;
          queuedSample.ndcY = ndcY;
          queuedSample.screenX = screenX;
          queuedSample.screenY = screenY;
          queuedSample.timestamp = sample.timeStamp;
          queuedSample.inside = inside;
          queuedSample.blocked = blocked;
          queuedSample.buttons = sample.buttons;
          queuedSamples.push(queuedSample);
        }
      };

      // PointerEvent coalescing is common on high-polling mice. Append the
      // browser-provided samples without spreading a fresh array or creating a
      // callback closure for every physical mouse packet.
      for (let index = 0; index < coalesced.length; index += 1) {
        const sample = coalesced[index];
        const previous = index > 0 ? coalesced[index - 1] : undefined;
        if (previous
          && sample.timeStamp === previous.timeStamp
          && sample.clientX === previous.clientX
          && sample.clientY === previous.clientY) continue;
        queueSample(sample);
      }
      const coalescedTail = coalesced[coalesced.length - 1];
      if (!coalescedTail
        || coalescedTail.timeStamp !== event.timeStamp
        || coalescedTail.clientX !== event.clientX
        || coalescedTail.clientY !== event.clientY) {
        queueSample(event);
      }

      // Uniform thinning preserves both temporal endpoints. Dropping the head
      // of a burst created a discontinuity between the prior frame's contact
      // and the retained tail on high-polling mice.
      const pendingSamples = pointerSamples.current;
      const maximumQueuedSamples = MAX_QUEUED_POINTER_SAMPLES;
      if (pendingSamples.length > maximumQueuedSamples) {
        const lastSample = pendingSamples[pendingSamples.length - 1];
        const sourceStride = (pendingSamples.length - 1) / (maximumQueuedSamples - 1);
        for (let index = 1; index < maximumQueuedSamples - 1; index += 1) {
          pendingSamples[index] = pendingSamples[Math.round(index * sourceStride)];
        }
        pendingSamples[maximumQueuedSamples - 1] = lastSample;
        pendingSamples.length = maximumQueuedSamples;
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
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateCanvasBounds);
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
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.65);
      dustUniforms.uPixelRatio.value = pixelRatio;
      const materialUniforms = dustMaterialRef.current?.uniforms;
      if (materialUniforms?.uPixelRatio) materialUniforms.uPixelRatio.value = pixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dustUniforms]);

  useEffect(() => {
    const sunDirection = sunDirectionRef.current;
    const liveSunStrength = sunStrength * sunDaylightRef.current;
    dustUniforms.uSunColor.value.set(sunColor);
    dustUniforms.uSunDirection.value.set(...sunDirection).normalize();
    dustUniforms.uSunStrength.value = liveSunStrength;
    // R3F clones the uniforms wrapper while applying JSX props. Update the
    // actual live ShaderMaterial as well as the source memo so primitive
    // values (notably intensity) cannot become stuck at their mount value.
    const materialUniforms = dustMaterialRef.current?.uniforms;
    if (materialUniforms?.uSunColor) materialUniforms.uSunColor.value.set(sunColor);
    if (materialUniforms?.uSunDirection) {
      materialUniforms.uSunDirection.value.set(...sunDirection).normalize();
    }
    if (materialUniforms?.uSunStrength) materialUniforms.uSunStrength.value = liveSunStrength;
  }, [dustUniforms, sunColor, sunDaylightRef, sunDirectionRef, sunStrength]);

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
    const pixelX = Math.floor(soilUv.x * sampler.width);
    const pixelY = Math.floor(soilUv.y * sampler.height);
    let red = 0;
    let green = 0;
    let blue = 0;
    // A nine-tap footprint represents the mixed grains disturbed by the
    // contact rather than a single texture texel. Besides being closer to a
    // 2–7 cm soil sample at this terrain scale, it prevents high-frequency
    // albedo flecks from making adjacent dust puffs flash different colors.
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      const sampleY = wrappedTextureIndex(
        pixelY + offsetY,
        sampler.height,
        sampler.texture.wrapT,
      );
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const sampleX = wrappedTextureIndex(
          pixelX + offsetX,
          sampler.width,
          sampler.texture.wrapS,
        );
        const offset = (sampleY * sampler.width + sampleX) * 4;
        const sampleRed = sampler.data[offset] / 255;
        const sampleGreen = sampler.data[offset + 1] / 255;
        const sampleBlue = sampler.data[offset + 2] / 255;
        if (sampler.texture.colorSpace === THREE.SRGBColorSpace) {
          red += srgbChannelToLinear(sampleRed);
          green += srgbChannelToLinear(sampleGreen);
          blue += srgbChannelToLinear(sampleBlue);
        } else {
          red += sampleRed;
          green += sampleGreen;
          blue += sampleBlue;
        }
      }
    }
    soilTexel.setRGB(red / 9, green / 9, blue / 9);
    // The terrain material multiplies its texture by a large-scale height tint
    // to create macro contrast. Multiplying both again for airborne powder
    // drives real mineral reflectance toward black (typically ~0.005 linear),
    // even though the unshadowed grains are directly illuminated. Blend the
    // two measured albedo sources for dust, preserving local hue/texture while
    // leaving compact-surface occlusion to the ground shader.
    return soilCombinedColor.lerp(soilTexel, 0.62);
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
    fineReleaseFraction = 0,
  ) => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return undefined;
    resetDeformationAccounting(contactOut);
    let pendingPositionRows = positionRowUpdates.current;
    if (!pendingPositionRows || pendingPositionRows.segments !== meta.segments) {
      pendingPositionRows = createAttributeRowUpdates(meta.segments);
      positionRowUpdates.current = pendingPositionRows;
    }
    let pendingNormalRows = normalRowUpdates.current;
    if (!pendingNormalRows || pendingNormalRows.segments !== meta.segments) {
      pendingNormalRows = createAttributeRowUpdates(meta.segments);
      normalRowUpdates.current = pendingNormalRows;
    }
    deformLocalPoint.copy(worldPoint);
    ground.worldToLocal(deformLocalPoint);
    const surfaceSpacing = meta.size / meta.segments;
    const interactionHalf = meta.size / 2 - surfaceSpacing * 0.5;
    if (Math.max(Math.abs(deformLocalPoint.x), Math.abs(deformLocalPoint.y)) > interactionHalf) return undefined;
    // The previous 1.85-cell floor turned low/medium quality traces into
    // half-metre trenches. 0.74 cells still always reaches the nearest grid
    // vertex while preserving the physical brush width on denser tiers.
    const contactRadius = Math.max(radius, surfaceSpacing * 0.74);
    const representedArea = surfaceSpacing * surfaceSpacing;
    const maximumFineMass = MAX_FINE_LOADING_KG_M2 * representedArea;
    const looseFines = getLooseFineReservoir(meta);

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
        const previousDeformation = meta.deformations[index];
        const nextDeformation = clamp(
          previousDeformation + compressedCenter + displacedBank,
          -0.2,
          0.075,
        );
        const heightChange = nextDeformation - previousDeformation;
        if (Math.abs(heightChange) < 0.0000001) continue;
        meta.deformations[index] = nextDeformation;
        position.setZ(index, meta.baseHeights[index] + meta.deformations[index]);
        // One vertex represents one grid cell. Half the absolute vertical
        // transport avoids counting the excavated centre and its adjacent berm
        // as two independent volumes of soil.
        const movedVolume = Math.abs(heightChange) * representedArea * 0.5;
        const compressedVolume = Math.max(0, -heightChange) * representedArea;
        const movedSoilMass = movedVolume * SOIL_BULK_DENSITY_KG_M3;
        const generatedFineMass = movedSoilMass * DEFORMATION_FINE_YIELD;
        const reservoirAfterFragmentation = Math.min(
          maximumFineMass,
          looseFines[index] + generatedFineMass,
        );
        // Only the fraction mobilised by this contact leaves the finite local
        // reservoir. Weighting by the achieved penetration makes a glancing
        // bank edit release less than the compacted groove, while the caller's
        // time-based fraction keeps event rate out of the physics.
        const penetrationResponse = clamp(
          Math.abs(heightChange) / Math.max(pressure, 0.000001),
          0,
          1,
        );
        const releasedFineMass = reservoirAfterFragmentation * clamp(
          fineReleaseFraction * (0.28 + penetrationResponse * 0.72),
          0,
          0.75,
        );
        looseFines[index] = Math.max(0, reservoirAfterFragmentation - releasedFineMass);
        contactOut.disturbedVolume += movedVolume;
        contactOut.compressedVolume += compressedVolume;
        contactOut.deformationWork += compressedVolume * SOIL_COMPACTION_YIELD_PA
          + movedSoilMass * 9.80665 * Math.abs(heightChange);
        contactOut.maximumPenetration = Math.max(
          contactOut.maximumPenetration,
          Math.max(0, -heightChange),
        );
        contactOut.generatedFineMass += generatedFineMass;
        contactOut.releasedFineMass += releasedFineMass;
        displaced = true;
        trackAttributeVertex(pendingPositionRows, row, column, 0);
        // Neighboring normals depend on this height through their central
        // differences, so retain a one-vertex halo until the batched update.
        trackAttributeVertex(pendingNormalRows, row, column, 1);
      }
    }
    if (displaced) {
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
    packetMassKg: number,
    count: number,
  ) => {
    const plume = THREE.MathUtils.smoothstep(
      clamp(speedResponse * (0.9 + sustainedEnergy * 0.32), 0, 1.18),
      0.02,
      0.92,
    );
    // A successful deformation is already the physical gate. Do not discard a
    // small, real mass release merely because its launch velocity is low: the
    // resulting low-tau packet is the faint veil expected from a slow stroke.
    if (packetMassKg <= 0 || count <= 0) return 0;
    emissionTangent.copy(direction).addScaledVector(normal, -direction.dot(normal)).normalize();
    emissionSide.crossVectors(normal, emissionTangent).normalize();
    const lateralLaunch = THREE.MathUtils.lerp(0.01, 0.62, Math.pow(plume, 1.12))
      * (0.78 + sustainedEnergy * 0.28);
    const verticalLaunch = THREE.MathUtils.lerp(0.018, 0.9, Math.pow(plume, 1.22))
      * (0.74 + sustainedEnergy * 0.34);
    const forwardLaunch = THREE.MathUtils.lerp(0.016, 0.68, Math.pow(plume, 1.08));

    // A rare 0.1–0.5 mm saltating tail is integrated as individual grains.
    // Larger millimetre clasts predominantly creep and should not masquerade
    // as airborne dust.
    const grainResponse = THREE.MathUtils.smoothstep(speedResponse, 0.66, 0.97);
    const relativePacketMass = packetMassKg / VISUAL_DUST_PACKET_MASS_KG;
    const expectedGrains = count * relativePacketMass
      * grainResponse * (0.009 + sustainedEnergy * 0.022);
    const grainLaunches = Math.min(
      2,
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
      grain.maxLife = THREE.MathUtils.lerp(0.28, 1.05, grainResponse)
        * (0.82 + Math.random() * 0.3);
      grain.life = grain.maxLife;
      grain.gravity = EARTH_GRAVITY_M_S2;
      grain.bounces = 0;
      const grainScale = THREE.MathUtils.lerp(0.00005, 0.00025, plume)
        * (0.78 + Math.random() * 0.3);
      grain.scale.set(
        clamp(grainScale * (0.62 + Math.random() * 0.56), 0.00004, 0.00028),
        clamp(grainScale * (0.5 + Math.random() * 0.44), 0.00004, 0.00028),
        clamp(grainScale * (0.68 + Math.random() * 0.62), 0.00004, 0.00028),
      );
      grain.radius = Math.min(0.00028, Math.max(grain.scale.x, grain.scale.y, grain.scale.z));
      grain.color.copy(soilColor).multiplyScalar(0.75 + Math.random() * 0.25);
      grain.position.copy(origin)
        .addScaledVector(emissionTangent, (Math.random() - 0.5) * 0.055)
        .addScaledVector(emissionSide, (Math.random() - 0.5) * 0.085)
        .addScaledVector(normal, grain.radius * 1.2 + 0.0015);
      grain.velocity.copy(emissionTangent).multiplyScalar(forwardLaunch * (0.28 + Math.random() * 0.42))
        .addScaledVector(emissionSide, (Math.random() - 0.5) * lateralLaunch * 0.9)
        .addScaledVector(normal, verticalLaunch * (0.28 + Math.random() * 0.34));
      grain.angularVelocity.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
      );
      grain.quaternion.setFromEuler(grainEuler.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ));
    }

    const fineFraction = clamp(0.25 + plume * 0.34 + sustainedEnergy * 0.12, 0.25, 0.72);
    let spawnedCount = 0;
    for (let index = 0; index < count; index += 1) {
      let particle: DustParticle | undefined;
      let particleIndex = -1;
      for (let offset = 0; offset < MAX_DUST; offset += 1) {
        const candidateIndex = (dustIndex.current + offset) % MAX_DUST;
        const candidate = particles.current[candidateIndex];
        if (candidate.life > 0) continue;
        particle = candidate;
        particleIndex = candidateIndex;
        dustIndex.current = (candidateIndex + 1) % MAX_DUST;
        break;
      }
      if (!particle) break;
      const activeListIndex = activeDustCount.current;
      particle.activeListIndex = activeListIndex;
      activeDustIndices.current[activeListIndex] = particleIndex;
      activeDustCount.current = activeListIndex + 1;
      spawnedCount += 1;
      // Suspended profile represents the optically dominant <20 µm fines;
      // the surface sheet represents the 20–100 µm short-suspension fraction.
      // Their on-screen radius is an aggregate cloud footprint, not a single
      // grain enlarged to visible size.
      const suspendedFine = Math.random() < fineFraction;
      particle.profile = suspendedFine ? 1 : 0;
      particle.maxLife = suspendedFine
        ? 20 + Math.random() * 8
        : 4 + Math.random() * 3;
      particle.life = particle.maxLife;
      particle.responseRate = suspendedFine
        ? 7.5 + Math.random() * 5.5
        : 4.2 + Math.random() * 3.4;
      const sizeClassSample = Math.random();
      if (suspendedFine) {
        if (sizeClassSample < 0.12) particle.settlingSpeed = 0.000093;
        else if (sizeClassSample < 0.5) particle.settlingSpeed = 0.00206;
        else if (sizeClassSample < 0.82) particle.settlingSpeed = 0.00807;
        else particle.settlingSpeed = 0.0316;
      } else {
        particle.settlingSpeed = sizeClassSample < 0.72 ? 0.181 : 0.58;
      }
      particle.baseSize = suspendedFine
        ? THREE.MathUtils.lerp(0.042, 0.092, Math.pow(plume, 0.72))
          * (0.78 + Math.random() * 0.38)
        : THREE.MathUtils.lerp(0.024, 0.058, Math.pow(plume, 0.72))
          * (0.76 + Math.random() * 0.34);
      particle.diffusivity = suspendedFine
        ? THREE.MathUtils.lerp(0.0018, 0.0105, plume)
          * (0.82 + Math.random() * 0.32)
        : THREE.MathUtils.lerp(0.00022, 0.00135, plume)
          * (0.82 + Math.random() * 0.3);
      particle.stretch = suspendedFine
        ? THREE.MathUtils.lerp(1.35, 2.35, plume) * (0.9 + Math.random() * 0.16)
        : THREE.MathUtils.lerp(1.9, 3.7, plume) * (0.82 + Math.random() * 0.25);
      particle.initialProjectedArea = Math.PI * 0.25
        * particle.baseSize * particle.baseSize * particle.stretch;
      particle.massKg = packetMassKg;
      // The visual packet mass is fixed. An effective mass-extinction
      // coefficient maps that mass to a centre optical depth; stronger contact
      // creates more overlapping packets instead of arbitrarily brightening
      // every particle.
      const packetExtinctionArea = particle.massKg
        * (suspendedFine
          ? FINE_MASS_EXTINCTION_M2_KG
          : SHORT_SUSPENSION_EXTINCTION_M2_KG);
      particle.opticalDepth = clamp(
        packetExtinctionArea / Math.max(0.000001, particle.initialProjectedArea),
        0,
        suspendedFine ? 1.4 : 0.85,
      ) * (0.88 + Math.random() * 0.2);
      particle.rotation = suspendedFine
        ? (Math.random() - 0.5) * 0.48
        : (Math.random() - 0.5) * 0.22;
      const puffHalfLife = suspendedFine
        ? THREE.MathUtils.lerp(0.25, 0.8, plume)
        : THREE.MathUtils.lerp(0.16, 0.4, plume);
      particle.flowDecay = Math.LN2 / puffHalfLife;
      particle.turbulenceScale = suspendedFine
        ? 2.85 + (Math.random() - 0.5) * 0.24
        : 6.2 + (Math.random() - 0.5) * 0.5;
      particle.turbulenceStrength = suspendedFine
        ? THREE.MathUtils.lerp(0.06, 0.48, plume) * (0.78 + sustainedEnergy * 0.22)
        : THREE.MathUtils.lerp(0.025, 0.16, plume);
      particle.seed = Math.random() * 100;
      particle.color.copy(soilColor);
      // Finely divided powder exposes more diffuse surface than compacted
      // ground. This bounded transform raises reflectance by roughly 5–20%
      // without replacing local chromaticity with an always-red dust colour.
      const powderExponent = suspendedFine
        ? 1.14 + Math.random() * 0.08
        : 1.07 + Math.random() * 0.05;
      particle.color.setRGB(
        1 - Math.pow(1 - clamp(particle.color.r, 0, 1), powderExponent),
        1 - Math.pow(1 - clamp(particle.color.g, 0, 1), powderExponent),
        1 - Math.pow(1 - clamp(particle.color.b, 0, 1), powderExponent),
      );
      particle.normal.copy(normal);
      particle.position.copy(origin)
        .addScaledVector(
          emissionTangent,
          (Math.random() - 0.5) * (suspendedFine ? 0.025 + plume * 0.08 : 0.018 + plume * 0.055),
        )
        .addScaledVector(
          emissionSide,
          (Math.random() - 0.5) * (suspendedFine ? 0.035 + plume * 0.14 : 0.02 + plume * 0.08),
        )
        .addScaledVector(
          normal,
          suspendedFine
            ? 0.022 + Math.random() * (0.03 + plume * 0.045)
            : 0.012 + Math.random() * (0.012 + plume * 0.018),
        );
      if (suspendedFine) {
        particle.inducedFlow.copy(emissionTangent).multiplyScalar((0.3 + Math.random() * 0.58) * forwardLaunch)
          .addScaledVector(emissionSide, (Math.random() - 0.5) * 1.55 * lateralLaunch)
          .addScaledVector(normal, (0.38 + Math.random() * 0.72) * verticalLaunch);
      } else {
        particle.inducedFlow.copy(emissionTangent).multiplyScalar((0.58 + Math.random() * 0.62) * forwardLaunch)
          .addScaledVector(emissionSide, (Math.random() - 0.5) * 0.8 * lateralLaunch)
          .addScaledVector(normal, (0.12 + Math.random() * 0.26) * verticalLaunch);
      }
      particle.velocity.copy(particle.inducedFlow)
        .multiplyScalar(0.72 + Math.random() * 0.24)
        .addScaledVector(normal, suspendedFine ? 0.025 : 0.01);
    }
    return spawnedCount;
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
    const safeElapsedSeconds = clamp(elapsedSeconds, 0.001, IDLE_REANCHOR_MS / 1000);
    const slowContact = 1 - THREE.MathUtils.smoothstep(screenSpeed, 26, 360);
    const radius = 0.168 + speedResponse * 0.026;
    // A slow cursor dwells against the surface and compacts it more deeply.
    // Pressure is deliberately based on CSS-pixel velocity, not world-space
    // ray travel, so orbit distance and camera zoom cannot change the feel.
    // Fast motion remains visibly deep; slow motion gains additional dwell.
    const basePressure = 0.0072 + slowContact * 0.0104 + speedResponse * 0.0004;
    const surfaceMeta = (ground.geometry as THREE.BufferGeometry).userData.surfaceMeta as SurfaceMeta | undefined;
    const surfaceSpacing = surfaceMeta ? surfaceMeta.size / surfaceMeta.segments : 0.105;
    // The old fixed spacing oversampled high-density terrain by several
    // stamps per vertex. This remains below the effective brush radius on
    // every quality tier, preserving an overlap-safe continuous groove.
    const spacing = Math.max(0.065, surfaceSpacing * 0.62);
    const steps = Math.max(1, Math.min(240, Math.ceil(distance / spacing)));
    const effectiveSpacing = distance / steps;
    const pressure = basePressure * clamp(effectiveSpacing / spacing, 1, 2.8);
    const worldSpeed = distance / safeElapsedSeconds;
    const worldSpeedResponse = THREE.MathUtils.smoothstep(worldSpeed, 0.08, 5.2);
    // Pixel speed gives consistent input feel across camera distance, while a
    // small world-speed term prevents a zoomed-out camera from underestimating
    // actual surface shear. The exponential converts a per-second liberation
    // rate into a per-stamp fraction, making the result independent of pointer
    // polling frequency and the number of path interpolation samples.
    const entrainmentResponse = clamp(
      speedResponse * 0.94 + worldSpeedResponse * 0.06,
      0,
      1,
    );
    const liberationRate = 0.02 + 12.5 * Math.pow(entrainmentResponse, 1.5);
    const fineReleaseFraction = (
      1 - Math.exp(-liberationRate * safeElapsedSeconds / steps)
    ) * DRY_SOIL_RELEASE_FACTOR;
    pathDirectionScratch.copy(to).sub(from).normalize();

    let deformedContactCount = 0;
    let disturbedVolume = 0;
    let deformationWork = 0;
    let accumulatedPenetration = 0;
    let releasedFineMass = 0;
    for (let step = 1; step <= steps; step += 1) {
      pathPointScratch.copy(from).lerp(to, step / steps);
      const contact = deformSurface(
        ground,
        pathPointScratch,
        pathDirectionScratch,
        radius,
        pressure,
        deformationContactPool[deformedContactCount],
        fineReleaseFraction,
      );
      if (contact) {
        disturbedVolume += contact.disturbedVolume;
        deformationWork += contact.deformationWork;
        accumulatedPenetration += contact.maximumPenetration;
        releasedFineMass += contact.releasedFineMass;
        deformedContactCount += 1;
      }
    }
    if (deformedContactCount === 0) return false;

    const deformedFraction = deformedContactCount / steps;
    const representedBrushArea = Math.PI * radius * radius * deformedContactCount;
    const energyDensity = deformationWork / Math.max(0.0001, representedBrushArea);
    const energyResponse = THREE.MathUtils.smoothstep(energyDensity, 8, 210);
    const meanPenetration = accumulatedPenetration / Math.max(1, deformedContactCount);
    const penetrationResponse = THREE.MathUtils.smoothstep(meanPenetration, 0.0012, 0.016);
    const volumeResponse = THREE.MathUtils.smoothstep(
      disturbedVolume / Math.max(1, deformedContactCount),
      0.00001,
      0.00052,
    );
    const workResponse = clamp(
      energyResponse * 0.5 + penetrationResponse * 0.34 + volumeResponse * 0.16,
      0,
      1,
    );
    motionEnergy.current = clamp(
      motionEnergy.current
        + safeElapsedSeconds * Math.pow(entrainmentResponse, 1.22) * 1.7
          * deformedFraction * (0.72 + workResponse * 0.28),
      0,
      1,
    );

    // Deformation is the source of matter: no successful volume change means
    // no released mass. Accumulate kilograms and convert them into constant-
    // mass visual packets only after the full path is processed. This removes
    // the former event-rate-dependent arbitrary "birth rate".
    const massFluxResponse = clamp(
      releasedFineMass / safeElapsedSeconds / 0.055,
      0,
      1,
    );
    motionEnergy.current = Math.max(
      motionEnergy.current,
      massFluxResponse * (0.35 + workResponse * 0.25),
    );
    dustMassBudget.current = Math.min(
      MAX_BUFFERED_DUST_MASS_KG,
      dustMassBudget.current + releasedFineMass,
    );
    const availableSlots = Math.max(0, MAX_DUST - activeDustCount.current);
    const requestedFullPackets = Math.floor(
      dustMassBudget.current / VISUAL_DUST_PACKET_MASS_KG,
    );
    const fullPacketBirths = Math.min(
      requestedFullPackets,
      MAX_PACKET_BIRTHS_PER_PATH,
      availableSlots,
    );
    const remainingAfterFullPackets = Math.max(
      0,
      dustMassBudget.current - fullPacketBirths * VISUAL_DUST_PACKET_MASS_KG,
    );
    const canSpawnFractionalPacket = fullPacketBirths === requestedFullPackets
      && fullPacketBirths < availableSlots
      && fullPacketBirths < MAX_PACKET_BIRTHS_PER_PATH
      && remainingAfterFullPackets >= MIN_FRACTIONAL_PACKET_MASS_KG;
    if (fullPacketBirths <= 0 && !canSpawnFractionalPacket) return true;

    const dustSamples = Math.min(24, fullPacketBirths, deformedContactCount);
    let spawnedFullPackets = 0;
    for (let sample = 1; sample <= dustSamples; sample += 1) {
      // Stratified mass-weighted sampling emits from the cells that actually
      // released fines instead of painting uniformly along the mouse path.
      const targetMass = releasedFineMass * (
        (sample - 1 + Math.random()) / dustSamples
      );
      let accumulatedMass = 0;
      let pointIndex = deformedContactCount - 1;
      for (let index = 0; index < deformedContactCount; index += 1) {
        accumulatedMass += deformationContactPool[index].releasedFineMass;
        if (accumulatedMass >= targetMass) {
          pointIndex = index;
          break;
        }
      }
      const contact = deformationContactPool[pointIndex];
      const count = Math.floor(fullPacketBirths / dustSamples)
        + (sample <= fullPacketBirths % dustSamples ? 1 : 0);
      const pointSoilColor = sampleSoilColorAtPoint(ground, contact.point, soilColor);
      spawnedFullPackets += emitDust(
        contact.point,
        pathDirectionScratch,
        contact.normal,
        pointSoilColor,
        entrainmentResponse,
        motionEnergy.current,
        VISUAL_DUST_PACKET_MASS_KG,
        count,
      );
    }
    dustMassBudget.current = Math.max(
      0,
      dustMassBudget.current - spawnedFullPackets * VISUAL_DUST_PACKET_MASS_KG,
    );

    if (canSpawnFractionalPacket && activeDustCount.current < MAX_DUST) {
      const targetMass = releasedFineMass * Math.random();
      let accumulatedMass = 0;
      let pointIndex = deformedContactCount - 1;
      for (let index = 0; index < deformedContactCount; index += 1) {
        accumulatedMass += deformationContactPool[index].releasedFineMass;
        if (accumulatedMass >= targetMass) {
          pointIndex = index;
          break;
        }
      }
      const contact = deformationContactPool[pointIndex];
      const fractionalMass = Math.min(
        remainingAfterFullPackets,
        VISUAL_DUST_PACKET_MASS_KG,
      );
      const spawnedFractionalPackets = emitDust(
        contact.point,
        pathDirectionScratch,
        contact.normal,
        sampleSoilColorAtPoint(ground, contact.point, soilColor),
        entrainmentResponse,
        motionEnergy.current,
        fractionalMass,
        1,
      );
      if (spawnedFractionalPackets > 0) {
        dustMassBudget.current = Math.max(0, dustMassBudget.current - fractionalMass);
      }
    }

    // If every slot is occupied, unresolved excess belongs to the ambient
    // plume rather than a delayed burst at an unrelated future cursor point.
    if (activeDustCount.current >= MAX_DUST) {
      dustMassBudget.current = Math.min(
        dustMassBudget.current,
        MIN_FRACTIONAL_PACKET_MASS_KG * 0.5,
      );
    }
    return true;
  };

  const deactivateDustParticle = (particleIndex: number, particle: DustParticle) => {
    const activeIndices = activeDustIndices.current;
    const listIndex = particle.activeListIndex;
    const activeCount = activeDustCount.current;
    if (listIndex < 0 || listIndex >= activeCount) return;
    const nextActiveCount = activeCount - 1;
    const lastParticleIndex = activeIndices[nextActiveCount];
    if (listIndex < nextActiveCount) {
      activeIndices[listIndex] = lastParticleIndex;
      particles.current[lastParticleIndex].activeListIndex = listIndex;
    }
    particle.activeListIndex = -1;
    activeDustCount.current = nextActiveCount;
  };

  useFrame((state, delta) => {
    if (appliedSunRevisionRef.current !== sunRevisionRef.current) {
      appliedSunRevisionRef.current = sunRevisionRef.current;
      const liveSunDirection = sunDirectionRef.current;
      const liveSunStrength = sunStrength * sunDaylightRef.current;
      dustUniforms.uSunDirection.value.set(...liveSunDirection).normalize();
      dustUniforms.uSunStrength.value = liveSunStrength;
      const liveSolarUniforms = dustMaterialRef.current?.uniforms;
      if (liveSolarUniforms?.uSunDirection) {
        liveSolarUniforms.uSunDirection.value.set(...liveSunDirection).normalize();
      }
      if (liveSolarUniforms?.uSunStrength) {
        liveSolarUniforms.uSunStrength.value = liveSunStrength;
      }
    }

    const ground = groundRef.current;
    const queuedSamples = pointerSamples.current;
    // The deformation path is interpolated between these expensive ray/height
    // anchors. The connector stamps between anchors, so the displayed path
    // stays continuous without raymarching every high-polling mouse packet.
    // avoiding dozens of 768-step heightfield marches in one frame.
    const maximumFrameSamples = quality === 'high' ? 4 : quality === 'medium' ? 3 : 2;
    if (queuedSamples.length > maximumFrameSamples) {
      const lastSample = queuedSamples[queuedSamples.length - 1];
      const sourceStride = (queuedSamples.length - 1) / (maximumFrameSamples - 1);
      // Uniformly retain the full coalesced path, including both endpoints.
      // Every retained world hit is still connected by radius-overlapping
      // deformation stamps, so the budget cannot create hover gaps.
      for (let index = 1; index < maximumFrameSamples - 1; index += 1) {
        queuedSamples[index] = queuedSamples[Math.round(index * sourceStride)];
      }
      queuedSamples[maximumFrameSamples - 1] = lastSample;
      queuedSamples.length = maximumFrameSamples;
    }
    const sampleCount = queuedSamples.length;
    const pointerMoved = sampleCount > 0;
    const cameraMoved = previousCameraPosition.current.distanceToSquared(camera.position) > 0.000004
      || 1 - Math.abs(previousCameraQuaternion.current.dot(camera.quaternion)) > 0.000002
      || !previousProjectionMatrix.current.equals(camera.projectionMatrix);
    previousCameraPosition.current.copy(camera.position);
    previousCameraQuaternion.current.copy(camera.quaternion);
    previousProjectionMatrix.current.copy(camera.projectionMatrix);
    motionEnergy.current *= Math.exp(-delta * 0.72);

    // Reproject the previous *screen* contact through the new camera before
    // consuming this frame's pointer path. ScrollDirector applies pointer
    // parallax continuously; without this step its camera displacement gets
    // folded into the first soil segment and masquerades as cursor velocity.
    // Keeping the anchor in NDC preserves the user's real pointer delta even
    // on frames where both the camera and cursor legitimately move.
    if (cameraMoved && !pointerMoved) {
      // Camera-only scrolling does not create a soil stroke. Retiring the old
      // anchor makes the next real pointer sample a fresh contact and avoids
      // ray-marching the dense heightfield on every eased scroll frame.
      lastPoint.current = null;
      lastScreenPoint.current = null;
      lastNdcPoint.current = null;
      velocityAnchorPoint.current = null;
      velocityAnchorTimestamp.current = 0;
      screenVelocity.current = 0;
      processedTimestamp.current = 0;
    } else if (cameraMoved) {
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
          else lastPoint.current = lastPointStorage.current.copy(reanchoredHit.point);
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
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const sample = queuedSamples[sampleIndex];
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
            screenVelocity.current = 0;
            velocityAnchorTimestamp.current = sample.timestamp;
            if (velocityAnchorPoint.current) velocityAnchorPoint.current.copy(pointerScreenScratch);
            else velocityAnchorPoint.current = velocityAnchorPointStorage.current.copy(pointerScreenScratch);
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
            velocityAnchorPoint.current = velocityAnchorPointStorage.current.copy(pointerScreenScratch);
            velocityAnchorTimestamp.current = sample.timestamp;
            screenVelocity.current = 0;
          }
          if (lastPoint.current) lastPoint.current.copy(hit.point);
          else lastPoint.current = lastPointStorage.current.copy(hit.point);
          if (lastScreenPoint.current) lastScreenPoint.current.copy(pointerScreenScratch);
          else lastScreenPoint.current = lastScreenPointStorage.current.copy(pointerScreenScratch);
          if (lastNdcPoint.current) lastNdcPoint.current.set(sample.ndcX, sample.ndcY);
          else lastNdcPoint.current = lastNdcPointStorage.current.set(sample.ndcX, sample.ndcY);
        } else {
          lastPoint.current = null;
          lastScreenPoint.current = null;
          lastNdcPoint.current = null;
          velocityAnchorPoint.current = null;
          velocityAnchorTimestamp.current = 0;
          screenVelocity.current = 0;
        }
      }
      queuedSamples.length = 0;
      setSurfaceCursor(Boolean(latestHit));
    }

    const pendingPositionRows = positionRowUpdates.current;
    if (ground && pendingPositionRows && pendingPositionRows.touchedCount > 0) {
      const geometry = ground.geometry as THREE.BufferGeometry;
      const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (meta && meta.segments === pendingPositionRows.segments) {
        uploadAttributeRows(position, pendingPositionRows);
      }
      resetAttributeRowUpdates(pendingPositionRows);
    }

    const pendingNormalRows = normalRowUpdates.current;
    if (
      surfaceDirty.current
      && ground
      && pendingNormalRows
      && state.clock.elapsedTime - lastNormalUpdate.current > 0.055
    ) {
      const geometry = ground.geometry as THREE.BufferGeometry;
      const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
      if (meta && meta.segments === pendingNormalRows.segments) {
        const stride = meta.segments + 1;
        const spacing = meta.size / meta.segments;
        for (let updateIndex = 0; updateIndex < pendingNormalRows.touchedCount; updateIndex += 1) {
          const row = pendingNormalRows.touchedRows[updateIndex];
          const minColumn = pendingNormalRows.minColumns[row];
          const maxColumn = pendingNormalRows.maxColumns[row];
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
        uploadAttributeRows(normal, pendingNormalRows);
      }
      resetAttributeRowUpdates(pendingNormalRows);
      surfaceDirty.current = false;
      lastNormalUpdate.current = state.clock.elapsedTime;
    }

    const dustArray = dustInterleavedBuffer.array as Float32Array;
    const frameStep = Math.min(delta, 0.04);
    dustUniforms.uTime.value = state.clock.elapsedTime;
    const liveDustUniforms = dustMaterialRef.current?.uniforms;
    if (liveDustUniforms?.uTime) liveDustUniforms.uTime.value = state.clock.elapsedTime;

    if (activeDustCount.current > 0) {
      let dustChanged = false;
      const activeIndices = activeDustIndices.current;
      for (let activeIndex = activeDustCount.current - 1; activeIndex >= 0; activeIndex -= 1) {
        const index = activeIndices[activeIndex];
        const attributeOffset = index * DUST_FLOATS_PER_PARTICLE;
        const particle = particles.current[index];
        particle.life -= frameStep;
        if (particle.life <= 0) {
          particle.life = 0;
          particle.massKg = 0;
          deactivateDustParticle(index, particle);
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 1] = -999;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 2] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.size] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.alpha] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.stretch] = 1;
          dustChanged = true;
          continue;
        }
        const ageSeconds = particle.maxLife - particle.life;
        const curlTime = state.clock.elapsedTime * 0.34;
        // One shared spatial field keeps adjacent fines in the same eddy;
        // seed contributes only a small phase jitter instead of assigning a
        // completely unrelated wind direction to every particle.
        const curlPhase = (Math.sin(particle.seed * 12.9898) * 0.5) * 0.16;
        const curlScale = particle.turbulenceScale;
        // Analytic curl-like field: each acceleration axis samples a
        // different orthogonal coordinate, producing coherent eddies without
        // all particles receiving the same sinusoidal shove.
        const curlX = Math.cos(particle.position.y * curlScale + curlPhase + curlTime);
        const curlY = Math.cos(
          particle.position.z * curlScale - curlPhase * 0.71 + curlTime * 0.73,
        );
        const curlZ = Math.cos(
          particle.position.x * curlScale + curlPhase * 0.43 - curlTime * 0.82,
        );
        const suspendedFine = particle.profile > 0.5;
        // Earth-air micron dust reaches its terminal slip within much less than
        // one render frame. Couple each packet toward a nearly still ambient
        // flow plus the cursor-generated puff, whose momentum and coherent
        // turbulence decay after contact instead of becoming permanent wind.
        const puffResponse = Math.exp(-particle.flowDecay * ageSeconds);
        const eddyResponse = Math.exp(-particle.flowDecay * ageSeconds * 0.58);
        const turbulentVelocity = particle.turbulenceStrength * eddyResponse;
        const targetX = AMBIENT_AIR_X_M_S
          + particle.inducedFlow.x * puffResponse
          + curlX * turbulentVelocity;
        const targetY = particle.inducedFlow.y * puffResponse
          - particle.settlingSpeed
          + curlY * turbulentVelocity * (suspendedFine ? 0.24 : 0.12);
        const targetZ = AMBIENT_AIR_Z_M_S
          + particle.inducedFlow.z * puffResponse
          + curlZ * turbulentVelocity * (suspendedFine ? 0.82 : 0.54);
        const coupling = 1 - Math.exp(-particle.responseRate * frameStep);
        particle.velocity.x = THREE.MathUtils.lerp(particle.velocity.x, targetX, coupling);
        particle.velocity.y = THREE.MathUtils.lerp(particle.velocity.y, targetY, coupling);
        particle.velocity.z = THREE.MathUtils.lerp(particle.velocity.z, targetZ, coupling);
        particle.position.addScaledVector(particle.velocity, frameStep);

        // Absorb/deposit packets at the actual deformed height field. Short-
        // suspension packets check every frame; micron fines only need the
        // check while descending and are phase-staggered to cap CPU cost.
        const descending = particle.velocity.dot(particle.normal) < 0;
        const depositionPhase = (Math.floor(state.clock.elapsedTime * 60 + particle.seed) & 3) === 0;
        let deposited = false;
        if (ground && (!suspendedFine || (descending && depositionPhase))) {
          dustLocalPoint.copy(particle.position);
          ground.worldToLocal(dustLocalPoint);
          const contact = projectDeformedSurfaceContact(
            ground,
            dustLocalPoint.x,
            dustLocalPoint.y,
            dustContactScratch,
          );
          if (contact && dustLocalPoint.z <= contact.localPoint.z + 0.0015) {
            const surfaceMeta = (
              ground.geometry as THREE.BufferGeometry
            ).userData.surfaceMeta as SurfaceMeta | undefined;
            if (surfaceMeta) {
              returnFineMassToSurface(
                surfaceMeta,
                contact.localPoint.x,
                contact.localPoint.y,
                particle.massKg,
                soilTriangleScratch,
              );
            }
            particle.position.copy(contact.point).addScaledVector(contact.normal, 0.0015);
            deposited = true;
          }
        }

        // Gaussian packet spreading conserves mass: R² = R0² + 2Kt on both
        // projected axes. The longitudinal diffusivity is slightly higher
        // along the stroke, preserving a coherent plume without an artificial
        // time-based size animation.
        const initialMinorRadius = particle.baseSize * 0.5;
        const initialMajorRadius = initialMinorRadius * particle.stretch;
        const minorRadius = Math.sqrt(
          initialMinorRadius * initialMinorRadius
            + 2 * particle.diffusivity * ageSeconds,
        );
        const majorRadius = Math.sqrt(
          initialMajorRadius * initialMajorRadius
            + 2 * particle.diffusivity * (suspendedFine ? 1.28 : 1.12) * ageSeconds,
        );
        const particleSize = minorRadius * 2;
        const currentStretch = majorRadius / Math.max(0.000001, minorRadius);
        const projectedArea = Math.PI * minorRadius * majorRadius;
        const centreOpticalDepth = particle.opticalDepth
          * particle.initialProjectedArea / Math.max(0.000001, projectedArea);
        const outsideSimulation = Math.abs(particle.position.x) > 60
          || Math.abs(particle.position.z) > 60
          || particle.position.y > 18
          || particle.position.y < -6;
        if (deposited || outsideSimulation || centreOpticalDepth < DUST_OPTICAL_DEPTH_EPSILON) {
          particle.life = 0;
          particle.massKg = 0;
          deactivateDustParticle(index, particle);
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 1] = -999;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 2] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.size] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.alpha] = 0;
          dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.stretch] = 1;
          dustChanged = true;
          continue;
        }
        // This sub-frame birth ramp prevents point-sprite popping. There is no
        // arbitrary age fade: disappearance comes from area dilution,
        // deposition, or leaving the simulation volume.
        const birthRamp = THREE.MathUtils.smoothstep(
          ageSeconds,
          0,
          suspendedFine ? 0.07 : 0.04,
        );
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position] = particle.position.x;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 1] = particle.position.y;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.position + 2] = particle.position.z;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.size] = particleSize;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.alpha] = centreOpticalDepth * birthRamp;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.seed] = particle.seed;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.profile] = particle.profile;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.stretch] = currentStretch;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.rotation] = particle.rotation;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.color] = particle.color.r;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.color + 1] = particle.color.g;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.color + 2] = particle.color.b;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.flow] = particle.velocity.x;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.flow + 1] = particle.velocity.y;
        dustArray[attributeOffset + DUST_ATTRIBUTE_OFFSET.flow + 2] = particle.velocity.z;
        dustChanged = true;
      }
      if (dustChanged) {
        dustInterleavedBuffer.needsUpdate = true;
      }
    }

    const coarseMesh = coarseGrainsRef.current;
    if (coarseMesh && activeGrainCount.current > 0) {
      let colorChanged = false;
      let matrixChanged = false;
      const grains = coarseGrains.current;
      for (let index = 0; index < grains.length; index += 1) {
        const grain = grains[index];
        if (grain.life <= 0) continue;
        grain.life -= frameStep;
        // Nonlinear Earth-air drag for an irregular mineral grain. Exponential
        // coupling over the frame is the stable integral of the instantaneous
        // drag rate and avoids explicit-Euler velocity reversals at low Re.
        grainRelativeAir.set(
          grain.velocity.x - AMBIENT_AIR_X_M_S,
          grain.velocity.y,
          grain.velocity.z - AMBIENT_AIR_Z_M_S,
        );
        const relativeSpeed = grainRelativeAir.length();
        if (relativeSpeed > 0.00001) {
          const diameter = Math.max(0.00008, grain.radius * 2);
          const reynoldsNumber = Math.max(
            0.000001,
            EARTH_AIR_DENSITY_KG_M3 * diameter * relativeSpeed
              / EARTH_AIR_DYNAMIC_VISCOSITY_PA_S,
          );
          const dragCoefficient = Math.pow(
            Math.pow(32 / reynoldsNumber, 2 / 3) + 1,
            1.5,
          );
          const dragRate = 3 * EARTH_AIR_DENSITY_KG_M3 * dragCoefficient
            / (4 * MINERAL_PARTICLE_DENSITY_KG_M3 * diameter);
          const dragCoupling = 1 - Math.exp(-dragRate * relativeSpeed * frameStep);
          grain.velocity.addScaledVector(grainRelativeAir, -dragCoupling);
        }
        grain.velocity.y -= grain.gravity * frameStep;
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
          if (contact && grainLocalPoint.z <= contact.localPoint.z + grain.radius * 0.55) {
            const incomingVelocity = grain.velocity.dot(contact.normal);
            if (grain.bounces < 2 && incomingVelocity < -0.13 && grain.life > 0.18) {
              grain.position.copy(contact.point).addScaledVector(contact.normal, grain.radius * 0.62);
              grain.velocity.reflect(contact.normal).multiplyScalar(0.62);
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
          grainTransform.scale.copy(grain.scale);
          coarseMesh.setColorAt(index, grain.color);
          colorChanged = true;
        }
        grainTransform.updateMatrix();
        coarseMesh.setMatrixAt(index, grainTransform.matrix);
        matrixChanged = true;
      }
      if (matrixChanged) {
        coarseMesh.instanceMatrix.needsUpdate = true;
      }
      if (colorChanged && coarseMesh.instanceColor) coarseMesh.instanceColor.needsUpdate = true;
    }

  });

  return (
    <>
      <points ref={dustRef} geometry={dustGeometry} frustumCulled={false} renderOrder={8}>
        <shaderMaterial
          ref={dustMaterialRef}
          uniforms={dustUniforms}
          vertexShader={DUST_VERTEX_SHADER}
          fragmentShader={DUST_FRAGMENT_SHADER}
          transparent
          premultipliedAlpha
          depthTest
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
      {/* Tiny moving grains are lit and receive shadows, but do not cast into
          the full-scene map; doing so forced a costly map rebuild every frame. */}
      <instancedMesh
        ref={coarseGrainsRef}
        args={[undefined, undefined, MAX_COARSE_GRAINS]}
        receiveShadow
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} metalness={0} envMapIntensity={0.03} flatShading />
      </instancedMesh>
    </>
  );
}

export default SoilInteraction;
