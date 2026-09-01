'use client';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useEffect,
  useState,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { detectQuality, getReducedMotion, type Quality } from '@/lib/performance';
import {
  HybridFrameGovernor,
  WebGLRendererLifecycle,
} from '@/components/performance/HybridFrameGovernor';
import { AsyncShaderWarmup, SceneRenderLoop } from '@/components/performance/AsyncShaderWarmup';
import { useResponsiveDpr } from '@/components/performance/useResponsiveDpr';
import { useContentCollection, type AchievementRecord, type MediaAsset } from '@/lib/content';
import CosmicPhenomena3D from './CosmicPhenomena3D';
import ProceduralSolarSystem3D from './ProceduralSolarSystem3D';
import styles from './HelixGallery3D.module.css';

/* ================================================================== *
 *  Helix Layout Constants                                             *
 *                                                                     *
 *  The archive is unbounded, so nothing here may depend on a record   *
 *  count. Each record occupies one rung: a fixed angular step around  *
 *  the helix and a fixed drop down it. Scrolling one record rotates   *
 *  the structure by exactly one step and lifts it by exactly one      *
 *  drop, which is what puts the next card in front of the camera.     *
 * ================================================================== */
const HELIX_R      = 7.15;
/** Records per full turn of the helix. */
const CARDS_PER_TURN = 8;
const ANGLE_STEP   = (Math.PI * 2) / CARDS_PER_TURN;
const Y_STEP       = 21.5 / 7;

const CARD_W       = 4.7;
const CARD_H       = 2.86;
const FOCUS_RADIUS_BOOST = 2.15;
const FOCUS_SCALE = 1.42;
// Keep cards in the helix until the final part of their chapter. The outer
// radius is deliberately below 0.5 so two neighbouring cards can never be in
// their acquire animation at the same time.
const FOCUS_ACQUIRE_RADIUS = 0.18;
const FOCUS_LOCK_RADIUS = 0.045;

// Leave a short approach before the first chapter and a matching departure
// after the last. The focus centres therefore sit inside the scroll range,
// instead of pinning the first and last cards in their enlarged state at the
// section boundaries.
const EDGE_TRAVEL = 0.28;

/**
 * Card slots recycled across the whole archive. Eleven covers well beyond the
 * frustum at every viewport, so a slot is only ever re-pointed at a new record
 * while it is off screen. This is the entire cost of the gallery: eleven
 * meshes and eleven DOM cards, whether the archive holds eight records or
 * eight thousand.
 */
const SLOT_COUNT = 11;
/** Records to keep loaded ahead of the reader. */
const PREFETCH_MARGIN = 6;
/** Records fetched per page. */
const PAGE_SIZE = 8;

/* ================================================================== *
 *  Scroll Animation Constants                                         *
 * ================================================================== */
const SCROLL_DAMPING   = 7.5;
/** Matches the `.canvasFallback` opacity transition. */
const VEIL_FADE_MS = 520;
/** Scroll length granted to each record. */
const SECTION_SVH_PER_RECORD = 88;
const SECTION_SVH_PADDING = 96;

/* ================================================================== *
 *  Shared scroll state                                                *
 * ================================================================== */
const scroll = { target: 0, current: 0 };
/**
 * Live archive position in record units, shared by reference with the solar
 * system so both layers read one value per frame instead of recomputing it.
 */
const archive = { position: 0 };

type ProjectionRegistry = {
  cards: Map<number, THREE.Object3D>;
};

type GalleryDomHandles = {
  root: HTMLDivElement | null;
  cameraLayer: HTMLDivElement | null;
  cards: Map<number, HTMLElement>;
};

const ProjectionRegistryContext = createContext<ProjectionRegistry | null>(null);

const CAMERA_CSS_MULTIPLIERS = [
  1, -1, 1, 1,
  1, -1, 1, 1,
  1, -1, 1, 1,
  1, -1, 1, 1,
];
const OBJECT_CSS_MULTIPLIERS = [
  1, 1, 1, 1,
  -1, -1, -1, -1,
  1, 1, 1, 1,
  1, 1, 1, 1,
];

function cssNumber(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function cssMatrix3d(matrix: THREE.Matrix4, multipliers: number[], prefix = '') {
  return `${prefix}matrix3d(${matrix.elements
    .map((value, index) => cssNumber(value * multipliers[index]))
    .join(',')})`;
}

function smootherStep(value: number) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function focusFor(index: number, position: number) {
  const distance = Math.abs(position - index);
  const acquireProgress = (
    FOCUS_ACQUIRE_RADIUS - distance
  ) / (FOCUS_ACQUIRE_RADIUS - FOCUS_LOCK_RADIUS);
  return smootherStep(acquireProgress);
}

/** Scroll travel, in record units, for an archive of `count` records. */
function archiveSpan(count: number) {
  return Math.max(1, count - 1) + EDGE_TRAVEL * 2;
}

function archivePositionForScroll(progress: number, count: number) {
  return progress * archiveSpan(count) - EDGE_TRAVEL;
}

function scrollProgressForChapter(index: number, count: number) {
  return (index + EDGE_TRAVEL) / archiveSpan(count);
}

function presentedPosition(progress: number, count: number, reduceMotion: boolean) {
  const position = archivePositionForScroll(progress, count);
  const outsideChapterRange = position < 0 || position > count - 1;
  return reduceMotion && !outsideChapterRange ? Math.round(position) : position;
}

/**
 * Slot -> record index. Each slot owns one residue class modulo SLOT_COUNT and
 * always takes the member of that class nearest the reader, so advancing one
 * record re-points exactly one slot — the one that just left the window behind
 * — rather than reshuffling all eleven.
 */
function recordIndexForSlot(slot: number, center: number) {
  return slot + SLOT_COUNT * Math.round((center - slot) / SLOT_COUNT);
}

function helixRadiusFor(viewportWidth: number) {
  if (viewportWidth <= 430) return 2.65;
  if (viewportWidth <= 700) return 4.8;
  if (viewportWidth <= 900) return 6.2;
  return HELIX_R;
}

/* ================================================================== *
 *  Environment — Dark, cinematic background                           *
 * ================================================================== */
function Environment() {
  const { scene } = useThree();

  useEffect(() => {
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    scene.fog = null;
    scene.background = null;

    return () => {
      scene.fog = previousFog;
      scene.background = previousBackground;
    };
  }, [scene]);

  return (
    <>
      <hemisphereLight args={['#4a3528', '#010101', 0.16]} />
    </>
  );
}

const SPACE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPACE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vDirection;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float dust = valueNoise(direction * 4.5) * valueNoise(direction * 10.0 + 7.4);
    float galacticBand = pow(max(0.0, 1.0 - abs(direction.y * 0.76 + direction.x * 0.22)), 5.0);
    float coldVeil = pow(max(0.0, 1.0 - abs(
      direction.x * 0.58 - direction.y * 0.17 + direction.z * 0.12
    )), 9.0) * valueNoise(direction * 7.2 + 3.1);

    vec3 color = vec3(0.0015, 0.0012, 0.0010);
    color += vec3(0.028, 0.011, 0.008) * dust * galacticBand;
    color += vec3(0.004, 0.009, 0.014) * coldVeil;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ================================================================== *
 *  Procedural deep-space shell — no bitmap or full-screen pass        *
 * ================================================================== */
function Skydome({
  quality,
  active,
  reduceMotion,
  scrollState,
}: {
  quality: Quality;
  active: boolean;
  reduceMotion: boolean;
  scrollState: { current: number };
}) {
  const segments = quality === 'high' ? 36 : quality === 'medium' ? 28 : 20;
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);

  useFrame((_state, delta) => {
    if (!active || !meshRef.current) return;
    if (!reduceMotion) elapsedRef.current += Math.min(delta, 1 / 20);
    const elapsed = elapsedRef.current;
    const progress = scrollState.current;
    // A world-space shell supplies the most distant parallax layer. Its tiny
    // counter-rotation is deliberately slower than every nearer 3D object.
    meshRef.current.rotation.x = progress * 0.075 + elapsed * 0.00045;
    meshRef.current.rotation.y = -progress * 0.042 - elapsed * 0.00028;
    meshRef.current.rotation.z = progress * 0.026 + elapsed * 0.00016;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[150, segments, Math.round(segments * 0.65)]} />
      <shaderMaterial
        vertexShader={SPACE_VERTEX_SHADER}
        fragmentShader={SPACE_FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ================================================================== *
 *  Card slot — one recycled rung of the helix                         *
 * ================================================================== */
function CardSlot({
  slot,
  windowCenter,
  recordCount,
  hovered,
}: {
  slot: number;
  windowCenter: number;
  recordCount: number;
  hovered: boolean;
}) {
  const registry = useContext(ProjectionRegistryContext);
  const groupRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const presentationRef = useRef<{
    group: THREE.Group | null;
    plate: THREE.Group | null;
    surface: THREE.MeshPhysicalMaterial | null;
    position: number;
    index: number;
    viewportWidth: number;
    hovered: boolean;
  }>({
    group: null,
    plate: null,
    surface: null,
    position: Number.NaN,
    index: Number.NaN,
    viewportWidth: Number.NaN,
    hovered: !hovered,
  });

  const index = recordIndexForSlot(slot, windowCenter);
  const inRange = index >= 0 && index < recordCount;

  useFrame(({ size }) => {
    const group = groupRef.current;
    const plate = plateRef.current;
    const surface = surfaceRef.current;
    if (!group || !plate || !surface) return;

    group.visible = inRange;
    if (!inRange) return;

    const position = archive.position;
    const previous = presentationRef.current;
    if (
      previous.group === group
      && previous.plate === plate
      && previous.surface === surface
      && previous.position === position
      && previous.index === index
      && previous.viewportWidth === size.width
      && previous.hovered === hovered
    ) return;

    // Angle and height come from the record's absolute index, so a slot that
    // has just been recycled lands on its new rung in the same frame.
    const angle = index * ANGLE_STEP + Math.PI / 2;
    const focus = focusFor(index, position);
    const compact = size.width <= 430;
    const narrow = size.width <= 700;
    const helixRadius = helixRadiusFor(size.width);
    const plateScale = compact ? 410 / 720 : narrow ? 460 / 720 : size.width <= 900 ? 600 / 720 : 1;
    const radiusBoost = compact ? 1.15 : narrow ? 1.5 : FOCUS_RADIUS_BOOST;
    const baseScale = compact ? 0.66 : narrow ? 0.7 : 0.76;
    const focusScale = compact ? 1.42 : narrow ? 1.35 : FOCUS_SCALE;
    const radius = helixRadius + focus * radiusBoost;
    group.position.set(Math.cos(angle) * radius, -index * Y_STEP, Math.sin(angle) * radius);
    group.rotation.set(0, Math.atan2(Math.cos(angle), Math.sin(angle)), 0);
    const scale = baseScale + focus * (focusScale - baseScale);
    group.scale.setScalar(scale);
    plate.scale.setScalar(plateScale);
    surface.opacity = 0.18 + focus * 0.62 + (hovered ? 0.08 : 0);
    surface.emissiveIntensity = 0.035 + focus * 0.16;
    presentationRef.current = {
      group,
      plate,
      surface,
      position,
      index,
      viewportWidth: size.width,
      hovered,
    };
  }, -1);

  return (
    <group ref={groupRef} visible={inRange}>
      <group ref={plateRef}>
        <mesh>
          <boxGeometry args={[CARD_W, CARD_H, 0.11]} />
          <meshPhysicalMaterial
            ref={surfaceRef}
            color="#0d0b08"
            emissive="#7f210f"
            emissiveIntensity={0.04}
            roughness={0.48}
            metalness={0.08}
            clearcoat={0.42}
            clearcoatRoughness={0.5}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
          <Edges scale={1.002} threshold={18} color={hovered ? '#d8ff4f' : '#f2efe8'} />
        </mesh>

        <mesh position={[0, 0, -0.095]}>
          <boxGeometry args={[CARD_W * 0.94, CARD_H * 0.9, 0.12]} />
          <meshStandardMaterial color="#120704" roughness={0.82} metalness={0.04} />
        </mesh>
      </group>

      {/* DOM content is rendered once in the page's React root. This anchor
          supplies the exact world transform without creating a React root per card. */}
      <object3D
        ref={(anchor) => {
          if (!registry) return;
          if (anchor) registry.cards.set(slot, anchor);
          else registry.cards.delete(slot);
        }}
        position={[0, 0, 0.02]}
        scale={0.0065}
      />
    </group>
  );
}

function WebGLContextMonitor({ onLost }: { onLost: (lost: boolean) => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost(true);
    };
    const handleRestored = () => onLost(false);
    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onLost]);

  return null;
}

/* ================================================================== *
 *  DOM card face                                                      *
 * ================================================================== */
function CardMedia({ asset }: { asset: MediaAsset }) {
  return (
    <div
      className={styles.cardMedia}
      // The blur stands in until the photo decodes, so a card is never an
      // empty rectangle mid-flight through the helix.
      style={{ backgroundImage: `url("${asset.blurDataUrl}")` }}
      aria-hidden="true"
    >
      {/* The media pipeline already emitted this exact width ladder, and the
          site can ship as a static export where next/image would be
          unoptimised regardless. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        srcSet={asset.srcSet}
        sizes="720px"
        alt=""
        width={asset.width}
        height={asset.height}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <span className={styles.cardMediaScrim} />
    </div>
  );
}

const ArchiveCardFace = memo(function ArchiveCardFace({
  record,
  index,
  hovered,
}: {
  record: AchievementRecord;
  index: number;
  hovered: boolean;
}) {
  const media = typeof record.media === 'object' ? record.media : null;

  return (
    <div className={styles.cardFrame} data-hovered={hovered ? 'true' : undefined}>
      {media ? <CardMedia asset={media} /> : null}
      <div className={styles.cardGrid} aria-hidden="true" />
      <div className={styles.cardHead}>
        <span>ARC / {String(index + 1).padStart(2, '0')}</span>
        <span className={styles.status}><i /> VERIFIED</span>
      </div>
      <div className={styles.cardCore}>
        <p className={styles.cardCategory}>{record.category}</p>
        <div className={styles.cardIdentity}>
          <strong>{record.year}</strong>
          <h3>{record.title}</h3>
        </div>
        <p className={styles.cardDescription}>{record.description}</p>
      </div>
      <div className={styles.cardFoot}>
        <span>{record.metric}</span>
        <span>UIU / MARS ROVER TEAM</span>
      </div>
      <i className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
      <i className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />
    </div>
  );
});

function GalleryDomOverlay({
  handles,
  records,
  windowCenter,
  hoveredSlot,
  onHover,
}: {
  handles: GalleryDomHandles;
  records: AchievementRecord[];
  windowCenter: number;
  hoveredSlot: number | null;
  onHover: (slot: number | null) => void;
}) {
  return (
    <div
      ref={(element) => { handles.root = element; }}
      className={styles.domRoot}
      style={{ zIndex: 7, transformStyle: 'preserve-3d' }}
    >
      <div
        ref={(element) => { handles.cameraLayer = element; }}
        className={styles.cameraLayer}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const index = recordIndexForSlot(slot, windowCenter);
          const record = records[index];
          if (!record) return null;
          const hovered = hoveredSlot === slot;
          return (
            <article
              key={`gallery-slot-${slot}`}
              ref={(element) => {
                if (element) handles.cards.set(slot, element);
                else handles.cards.delete(slot);
              }}
              className={styles.archiveCard}
              // Hidden until the projection loop has placed it. A card that
              // has never been given a matrix would otherwise stack in the
              // corner of the camera layer for a frame.
              style={{ display: 'none' }}
              aria-label={`${record.year}: ${record.title}. ${record.description}`}
              onMouseEnter={() => onHover(slot)}
              onMouseLeave={() => onHover(null)}
            >
              <ArchiveCardFace record={record} index={index} hovered={hovered} />
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== *
 *  Scroll-Driven Helix Group                                          *
 * ================================================================== */
function HelixGroup({
  registry,
  domHandles,
  records,
  recordCount,
  windowCenter,
  onWindowCenterChange,
  onNeedMore,
  hoveredSlot,
  quality,
  active,
  reduceMotion,
}: {
  registry: ProjectionRegistry;
  domHandles: GalleryDomHandles;
  records: AchievementRecord[];
  recordCount: number;
  windowCenter: number;
  onWindowCenterChange: (center: number) => void;
  onNeedMore: () => void;
  hoveredSlot: number | null;
  quality: Quality;
  active: boolean;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const viewPosition = useMemo(() => new THREE.Vector3(), []);
  const transformRef = useRef<{ group: THREE.Group | null; position: number }>({
    group: null,
    position: Number.NaN,
  });
  const projectionRef = useRef<{
    group: THREE.Group | null;
    root: HTMLDivElement | null;
    cameraLayer: HTMLDivElement | null;
    camera: THREE.Camera | null;
    position: number;
    center: number;
    loaded: number;
    width: number;
    height: number;
  }>({
    group: null,
    root: null,
    cameraLayer: null,
    camera: null,
    position: Number.NaN,
    center: Number.NaN,
    loaded: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  });

  // Scroll state must settle before card-local transforms run. CardSlot uses
  // priority -1, and the DOM projection below uses the default priority, so a
  // newly snapped reduced-motion chapter can never project the previous
  // chapter's anchor matrix and then remain cached there.
  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    const damping = reduceMotion ? 18 : SCROLL_DAMPING;
    const alpha = 1 - Math.exp(-damping * Math.min(delta, 0.05));
    const nextProgress = THREE.MathUtils.lerp(scroll.current, scroll.target, alpha);
    scroll.current = Math.abs(nextProgress - scroll.target) < 0.00001
      ? scroll.target
      : nextProgress;

    const position = presentedPosition(scroll.current, recordCount, reduceMotion);
    archive.position = position;

    // The extra edge travel is only for the small -> focus -> small boundary
    // pulse. Holding the helix at its physical endpoints keeps the opening
    // star high on entry and the last record low beside the footer.
    const motionPosition = THREE.MathUtils.clamp(position, 0, Math.max(0, recordCount - 1));
    const previous = transformRef.current;
    if (
      previous.group !== groupRef.current
      || previous.position !== motionPosition
    ) {
      // One record of scroll = one angular step and one vertical drop.
      groupRef.current.rotation.y = motionPosition * ANGLE_STEP;
      groupRef.current.position.y = motionPosition * Y_STEP;
      transformRef.current = { group: groupRef.current, position: motionPosition };
    }

    const nextCenter = THREE.MathUtils.clamp(
      Math.round(position),
      0,
      Math.max(0, recordCount - 1),
    );
    if (nextCenter !== windowCenter) onWindowCenterChange(nextCenter);

    // Pull the next page well before the reader can reach it.
    if (position > records.length - PREFETCH_MARGIN) onNeedMore();
  }, -2);

  useFrame(({ camera, size }) => {
    const group = groupRef.current;
    if (!group) return;

    const position = archive.position;

    const root = domHandles.root;
    const cameraLayer = domHandles.cameraLayer;
    if (!root || !cameraLayer) return;

    const previous = projectionRef.current;
    if (
      previous.group === group
      && previous.root === root
      && previous.cameraLayer === cameraLayer
      && previous.camera === camera
      && previous.position === position
      && previous.center === windowCenter
      // A page can land while the reader is stationary. Its cards mount into
      // slots that were empty a frame ago and have never been projected, so
      // the loaded count has to invalidate this cache too — otherwise they
      // would sit untransformed in the corner of the camera layer.
      && previous.loaded === records.length
      && previous.width === size.width
      && previous.height === size.height
    ) return;

    group.updateWorldMatrix(false, true);
    camera.updateWorldMatrix(true, false);

    const perspective = camera.projectionMatrix.elements[5] * size.height * 0.5;
    root.style.perspective = `${perspective}px`;
    cameraLayer.style.width = `${size.width}px`;
    cameraLayer.style.height = `${size.height}px`;
    cameraLayer.style.transform = [
      `translateZ(${perspective}px)`,
      cssMatrix3d(camera.matrixWorldInverse, CAMERA_CSS_MULTIPLIERS),
      `translate(${size.width * 0.5}px,${size.height * 0.5}px)`,
    ].join(' ');

    // The Canvas and DOM overlay are separate React roots, and a slot's card
    // only exists while its record is in range. Validate each pair as it is
    // used rather than requiring all eleven.
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const anchor = registry.cards.get(slot);
      const element = domHandles.cards.get(slot);
      if (!anchor || !element) continue;

      const index = recordIndexForSlot(slot, windowCenter);
      const focus = focusFor(index, position);
      element.style.setProperty('--card-focus', focus.toFixed(4));
      element.dataset.active = focus >= 0.82 ? 'true' : 'false';

      anchor.updateWorldMatrix(true, false);
      anchor.getWorldPosition(worldPosition);
      viewPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
      const visible = index >= 0
        && index < recordCount
        && viewPosition.z < -camera.near
        && viewPosition.z > -camera.far;
      element.style.display = visible ? 'flex' : 'none';
      if (!visible) continue;

      element.style.transform = cssMatrix3d(
        anchor.matrixWorld,
        OBJECT_CSS_MULTIPLIERS,
        'translate(-50%,-50%) ',
      );
      const depth = THREE.MathUtils.clamp(
        (-viewPosition.z - camera.near) / (camera.far - camera.near),
        0,
        1,
      );
      element.style.zIndex = String(Math.round((1 - depth) * 16_777_271));
    }
    projectionRef.current = {
      group,
      root,
      cameraLayer,
      camera,
      position,
      center: windowCenter,
      loaded: records.length,
      width: size.width,
      height: size.height,
    };
  });

  return (
    <ProjectionRegistryContext.Provider value={registry}>
      <group ref={groupRef}>
        <ProceduralSolarSystem3D
          quality={quality}
          active={active}
          reduceMotion={reduceMotion}
          archiveState={archive}
          cardYStep={Y_STEP}
        />
        {Array.from({ length: SLOT_COUNT }, (_, slot) => (
          <CardSlot
            key={`rung-${slot}`}
            slot={slot}
            windowCenter={windowCenter}
            recordCount={recordCount}
            hovered={hoveredSlot === slot}
          />
        ))}
      </group>
    </ProjectionRegistryContext.Provider>
  );
}

/* ================================================================== *
 *  HTML Overlay                                                       *
 * ================================================================== */
/** Chapters shown either side of the active one in the rail. */
const RAIL_RADIUS = 4;

function Overlay({
  active,
  records,
  recordCount,
  reduceMotion,
}: {
  active: boolean;
  records: AchievementRecord[];
  recordCount: number;
  reduceMotion: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const percentRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let lastPercentage = -1;
    let lastIndex = -1;
    let activeUntil = performance.now() + 200;

    const update = (now: number) => {
      raf = 0;
      const nextPercentage = Math.round(scroll.current * 100);
      if (nextPercentage !== lastPercentage) {
        lastPercentage = nextPercentage;
        if (percentRef.current) {
          percentRef.current.textContent = `${String(nextPercentage).padStart(3, '0')}%`;
        }
        progressRef.current?.style.setProperty('--archive-progress', `${nextPercentage}%`);
      }
      const nextIndex = THREE.MathUtils.clamp(
        Math.round(archivePositionForScroll(scroll.current, recordCount)),
        0,
        Math.max(0, recordCount - 1),
      );
      if (nextIndex !== lastIndex) {
        lastIndex = nextIndex;
        setActiveIndex(nextIndex);
      }
      if (now < activeUntil || Math.abs(scroll.target - scroll.current) > 0.0001) {
        raf = requestAnimationFrame(update);
      }
    };

    const wake = () => {
      activeUntil = performance.now() + 1_200;
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', wake, { passive: true });
    wake();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', wake);
    };
  }, [active, recordCount]);

  const scrollToChapter = useCallback((index: number) => {
    const gallery = document.getElementById('helix-gallery');
    if (!gallery) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const sectionTop = gallery.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, gallery.offsetHeight - viewportHeight);
    const chapterProgress = scrollProgressForChapter(index, recordCount);

    // Update the HUD immediately while native smooth scrolling advances the
    // same global scroll state used by the WebGL and DOM projection layers.
    setActiveIndex(index);
    window.scrollTo({
      top: sectionTop + travel * chapterProgress,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [recordCount, reduceMotion]);

  // An archive of arbitrary length cannot list every chapter. The rail shows
  // a moving window around the reader; keyboard navigation still walks the
  // full set, one record at a time.
  const railStart = Math.max(
    0,
    Math.min(activeIndex - RAIL_RADIUS, recordCount - (RAIL_RADIUS * 2 + 1)),
  );
  const railEnd = Math.min(recordCount - 1, railStart + RAIL_RADIUS * 2);

  const handleRailKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = Math.min(recordCount - 1, index + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = recordCount - 1;
    } else {
      return;
    }

    event.preventDefault();
    scrollToChapter(nextIndex);
    // The rail window follows the active chapter, so the button for the new
    // index may not exist until after this render. Restore focus once it does.
    requestAnimationFrame(() => {
      railRef.current
        ?.querySelector<HTMLButtonElement>(`button[data-index="${nextIndex}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const activeItem = records[activeIndex] ?? records[0];
  if (!activeItem) return null;

  return (
    <div className={styles.hud} data-active={active ? 'true' : 'false'}>
      <div className={styles.hudTop}>
        <div className={styles.hudIdentity}>
          <span>MISSION EVIDENCE / LIVE</span>
          <strong>{activeItem.title}</strong>
        </div>
        <div className={styles.hudProgress}>
          <div className={styles.progressMeta}>
            <span>
              ARC {String(activeIndex + 1).padStart(2, '0')} / {String(recordCount).padStart(2, '0')}
            </span>
            <span ref={percentRef}>000%</span>
          </div>
          <div ref={progressRef} className={styles.progressTrack}><i /></div>
        </div>
      </div>

      <aside
        ref={railRef}
        className={styles.hudRail}
        aria-label={`Achievement archive chapters, ${recordCount} total`}
      >
        {Array.from({ length: railEnd - railStart + 1 }, (_, offset) => {
          const index = railStart + offset;
          const item = records[index];
          if (!item) return null;
          return (
            <button
              key={item.id}
              type="button"
              data-index={index}
              data-active={index === activeIndex ? 'true' : undefined}
              aria-current={index === activeIndex ? 'step' : undefined}
              aria-label={`Go to chapter ${index + 1} of ${recordCount}: ${item.year} ${item.title}`}
              onClick={() => scrollToChapter(index)}
              onKeyDown={(event) => handleRailKeyDown(event, index)}
            >
              <i aria-hidden="true" />
              <span className={styles.railNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.railLabel} aria-hidden="true">
                {item.year} / {item.title}
              </span>
            </button>
          );
        })}
      </aside>

      <div className={styles.hudBottom}>
        <span>23.8103° N / 90.4125° E</span>
        <span className={styles.scrollCue}>SCROLL / ORBIT / ACQUIRE</span>
        <span>{activeItem.year} / {activeItem.category}</span>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  Main Component                                                     *
 * ================================================================== */
export default function HelixGallery3D() {
  const containerRef = useRef<HTMLElement>(null);
  const projectionRegistryRef = useRef<ProjectionRegistry>({
    cards: new Map(),
  });
  const domHandlesRef = useRef<GalleryDomHandles>({
    root: null,
    cameraLayer: null,
    cards: new Map(),
  });
  const [canvasActive, setCanvasActive] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [shadersReady, setShadersReady] = useState(false);
  const [veilMounted, setVeilMounted] = useState(true);
  // Programs die with their context. Remounting the warm-up rebuilds them
  // behind the same curtain instead of stalling the first restored frame.
  const [warmupGeneration, setWarmupGeneration] = useState(0);
  // Read every frame by SceneRenderLoop, which lives outside <Suspense> so the
  // archive keeps drawing even if the scene below it re-suspends.
  const shaderReadyRef = useRef(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [windowCenter, setWindowCenter] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(() => getReducedMotion());
  const quality = useMemo(() => detectQuality(), []);
  const dprMax = useResponsiveDpr(quality);

  const {
    records,
    total,
    status,
    error,
    loadMore,
    reload,
  } = useContentCollection('achievements', { limit: PAGE_SIZE });

  // The section's height encodes the archive's length, so it must follow the
  // reported total rather than the pages loaded so far — otherwise the
  // document would grow under the reader on every fetch.
  const recordCount = Math.max(records.length, total ?? 0);

  const handleShadersReady = useCallback(() => setShadersReady(true), []);
  const handleContextLost = useCallback((lost: boolean) => {
    setContextLost(lost);
    setShadersReady(false);
    // Every program died with the context. Stop drawing until the remounted
    // warm-up has rebuilt them.
    shaderReadyRef.current = false;
    if (!lost) setWarmupGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!canvasMounted) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    scroll.target = 0;
    scroll.current = 0;
    let frame = 0;
    let sectionTop = 0;
    let travel = 1;
    let disposed = false;

    const updateProgress = () => {
      frame = 0;
      scroll.target = THREE.MathUtils.clamp((window.scrollY - sectionTop) / travel, 0, 1);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    const measure = () => {
      if (disposed) return;
      const bounds = container.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      sectionTop = bounds.top + window.scrollY;
      travel = Math.max(1, container.offsetHeight - viewportHeight);
      scheduleUpdate();
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    // The canvas is created before the reader reaches the archive, so the
    // sections above it may still be settling. Anything that changes the
    // document's height moves `sectionTop`; re-measure on that too, not only
    // when the archive's own box changes.
    resizeObserver.observe(document.body);

    measure();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [canvasMounted]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setCanvasActive(entry.isIntersecting),
      { rootMargin: '25% 0px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Create the context a viewport and a half ahead of the archive, then keep
  // it for the lifetime of the route. Building this scene's GPU programs costs
  // seconds of main thread on a cold context; a canvas that is retired on
  // scroll-away pays that price again every time the reader comes back.
  useEffect(() => {
    if (canvasMounted) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    let idleHandle = 0;
    let fallbackTimer = 0;
    const mount = () => setCanvasMounted(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Hydration and the hero's own first paint come first. Warming the
        // archive during the reader's approach is free; warming it while the
        // page is still becoming interactive is not.
        if (typeof window.requestIdleCallback === 'function') {
          idleHandle = window.requestIdleCallback(mount, { timeout: 1_500 });
        } else {
          fallbackTimer = window.setTimeout(mount, 300);
        }
      },
      { rootMargin: '150% 0px' },
    );
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (idleHandle) window.cancelIdleCallback?.(idleHandle);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [canvasMounted]);

  // Retire the curtain only after its fade, so the archive is never revealed
  // in a single frame and the spinner stops animating once it is gone.
  useEffect(() => {
    if (!shadersReady) {
      setVeilMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setVeilMounted(false), VEIL_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [shadersReady]);

  useEffect(() => () => {
    scroll.target = 0;
    scroll.current = 0;
    archive.position = 0;
  }, []);

  const sectionHeight = Math.max(1, recordCount) * SECTION_SVH_PER_RECORD + SECTION_SVH_PADDING;
  const ready = recordCount > 0;

  return (
    <section
      ref={containerRef}
      id="helix-gallery"
      className={styles.gallerySection}
      style={{ height: `${sectionHeight}svh` }}
    >
      <div className={styles.stickyStage}>
        {ready && (
          <Overlay
            active={canvasActive && canvasMounted}
            records={records}
            recordCount={recordCount}
            reduceMotion={reduceMotion}
          />
        )}

        {canvasMounted && ready && (
          <>
            <Canvas
              dpr={[Math.min(1, dprMax), dprMax]}
              frameloop="demand"
              camera={{
                position: [0, 0.3, 17.5],
                fov: 38,
                near: 0.1,
                far: 300,
              }}
              gl={{
                antialias: false,
                powerPreference: 'high-performance',
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.08,
                alpha: false,
                stencil: false,
              }}
              className={styles.canvas}
              onCreated={({ gl }) => {
                // Three's production default still asks WebGL for every
                // program's info log the first time it is used, which forces
                // the driver to finish the whole scene's parallel compilation
                // in a single multi-second task. All custom shaders stay
                // checked in development; skip only that diagnostic readback
                // in the tested production build.
                if (process.env.NODE_ENV === 'production') gl.debug.checkShaderErrors = false;
                gl.setClearColor('#050504', 1);
              }}
            >
              <HybridFrameGovernor
                startupDurationMs={1_200}
                suspended={!canvasActive}
                reduceMotion={reduceMotion}
              />
              <WebGLRendererLifecycle />
              <WebGLContextMonitor onLost={handleContextLost} />
              {/* Outside the Suspense boundary on purpose: this is what keeps
                  drawing while anything below re-suspends. */}
              <SceneRenderLoop readyRef={shaderReadyRef} />
              <Suspense fallback={null}>
                <Environment />
                <Skydome
                  quality={quality}
                  active={canvasActive}
                  reduceMotion={reduceMotion}
                  scrollState={scroll}
                />
                <CosmicPhenomena3D
                  quality={quality}
                  active={canvasActive}
                  reduceMotion={reduceMotion}
                  scrollState={scroll}
                />
                <HelixGroup
                  registry={projectionRegistryRef.current}
                  domHandles={domHandlesRef.current}
                  records={records}
                  recordCount={recordCount}
                  windowCenter={windowCenter}
                  onWindowCenterChange={setWindowCenter}
                  onNeedMore={loadMore}
                  hoveredSlot={hoveredSlot}
                  quality={quality}
                  active={canvasActive}
                  reduceMotion={reduceMotion}
                />
                <AsyncShaderWarmup
                  key={warmupGeneration}
                  readyRef={shaderReadyRef}
                  onReady={handleShadersReady}
                />
              </Suspense>
            </Canvas>
            <GalleryDomOverlay
              handles={domHandlesRef.current}
              records={records}
              windowCenter={windowCenter}
              hoveredSlot={hoveredSlot}
              onHover={setHoveredSlot}
            />
          </>
        )}

        {veilMounted && (
          <div
            className={styles.canvasFallback}
            data-ready={shadersReady && ready ? 'true' : undefined}
            aria-hidden="true"
          >
            <i /><span>INITIALIZING ORBITAL ARCHIVE</span>
          </div>
        )}
        {status === 'error' && (
          <div className={styles.contextNotice} role="status">
            <span>ARCHIVE LINK INTERRUPTED</span>
            <strong>{error?.message ?? 'The record feed is unreachable.'}</strong>
            <button type="button" className={styles.retryButton} onClick={reload}>
              RETRY TRANSMISSION
            </button>
          </div>
        )}
        {contextLost && (
          <div className={styles.contextNotice} role="status">
            <span>RENDER LINK INTERRUPTED</span>
            <strong>Restoring the orbital archive…</strong>
          </div>
        )}
      </div>

      <div className={styles.edgeFade} aria-hidden="true" />
    </section>
  );
}
