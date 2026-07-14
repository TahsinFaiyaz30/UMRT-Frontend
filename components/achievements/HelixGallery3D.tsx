'use client';

import {
  createContext,
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
import { useResponsiveDpr } from '@/components/performance/useResponsiveDpr';
import CosmicPhenomena3D from './CosmicPhenomena3D';
import ProceduralSolarSystem3D from './ProceduralSolarSystem3D';
import styles from './HelixGallery3D.module.css';

/* ================================================================== *
 *  Gallery Data                                                       *
 * ================================================================== */
interface GalleryItem {
  year: string;
  title: string;
  description: string;
  category: string;
  metric: string;
}

const ITEMS: GalleryItem[] = [
  { year: '2025', title: 'URC TOP 5', category: 'Field result', metric: 'TOP 05', description: 'After rigorous testing in harsh desert environments, the rover showcased advanced autonomous capability and secured a top-five finish.' },
  { year: '2024', title: 'INNOVATION', category: 'Autonomy', metric: 'SLAM / 01', description: 'Recognized for real-time SLAM and obstacle avoidance that sharpened the rover\'s spatial awareness in uncertain terrain.' },
  { year: '2024', title: 'URC TOP 10', category: 'Field result', metric: 'TOP 10', description: 'Mechanical reliability and precise manipulator control carried UMRT into the international top ten.' },
  { year: '2023', title: 'ERC POLAND', category: 'International', metric: 'ERC / PL', description: 'UMRT entered the European Rover Challenge and completed complex maintenance tasks under severe time pressure.' },
  { year: '2022', title: 'BEST ROOKIE', category: 'Award', metric: 'ROOKIE / 01', description: 'A robust suspension and determined debut earned the team the competition\'s Best Rookie distinction.' },
  { year: '2022', title: 'URC QUAL', category: 'Qualification', metric: 'URC / GO', description: 'The team qualified for the University Rover Challenge for the first time after thousands of hours of design and manufacturing.' },
  { year: '2021', title: 'PROTOTYPE', category: 'Engineering', metric: '6 × 6', description: 'The first six-wheel rocker-bogie prototype proved the drive system across demanding local terrain.' },
  { year: '2020', title: 'FOUNDED', category: 'Origin', metric: 'T−00', description: 'UMRT formed around a shared mission: push student engineering beyond the road and toward planetary exploration.' },
];

/* ================================================================== *
 *  Helix Layout Constants                                             *
 * ================================================================== */
const N            = ITEMS.length;
const HELIX_R      = 7.15;
const HELIX_TURNS  = 1;             // number of full helical turns
const HELIX_ANGLE  = Math.PI * 2 * HELIX_TURNS;
const TOTAL_Y_DROP = 21.5;
const Y_STEP       = TOTAL_Y_DROP / Math.max(1, N - 1);

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
const ARCHIVE_POSITION_SPAN = Math.max(1, N - 1) + EDGE_TRAVEL * 2;

/* ================================================================== *
 *  Scroll Animation Constants                                         *
 * ================================================================== */
const SCROLL_ROT       = ((N - 1) / N) * HELIX_ANGLE;  // Positive = right-to-left rotation
const INITIAL_Y_OFFSET = -TOTAL_Y_DROP * 0.5;
const TOTAL_LIFT       = TOTAL_Y_DROP;
const SCROLL_DAMPING   = 7.5;
const SOLAR_TOP_OVERSCAN = 3.4;
const SOLAR_BOTTOM_OVERSCAN = 5.8;

/* ================================================================== *
 *  Shared scroll state                                                *
 * ================================================================== */
const scroll = { target: 0, current: 0 };

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

function focusFor(index: number, progress: number) {
  const distance = Math.abs(progress * (N - 1) - index);
  const acquireProgress = (
    FOCUS_ACQUIRE_RADIUS - distance
  ) / (FOCUS_ACQUIRE_RADIUS - FOCUS_LOCK_RADIUS);
  return smootherStep(acquireProgress);
}

function archivePositionForScroll(progress: number) {
  return progress * ARCHIVE_POSITION_SPAN - EDGE_TRAVEL;
}

function scrollProgressForChapter(index: number) {
  return (index + EDGE_TRAVEL) / ARCHIVE_POSITION_SPAN;
}

function presentationProgress(progress: number, reduceMotion: boolean) {
  const archivePosition = archivePositionForScroll(progress);
  const outsideChapterRange = archivePosition < 0 || archivePosition > N - 1;
  const presentedPosition = reduceMotion && !outsideChapterRange
    ? Math.round(archivePosition)
    : archivePosition;
  return presentedPosition / Math.max(1, N - 1);
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
 *  Image Plane — Tangent to the cylinder surface                      *
 *                                                                     *
 *  In the reference image, the planes form a continuous ribbon.       *
 *  rotation.y = Math.atan2(x, z) makes them face directly outward.    *
 * ================================================================== */
function ImagePlane({
  index,
  hovered,
  reduceMotion,
}: {
  index: number;
  hovered: boolean;
  reduceMotion: boolean;
}) {
  const registry = useContext(ProjectionRegistryContext);
  const groupRef = useRef<THREE.Group>(null);
  const plateRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const presentationRef = useRef<{
    group: THREE.Group | null;
    plate: THREE.Group | null;
    surface: THREE.MeshPhysicalMaterial | null;
    progress: number;
    viewportWidth: number;
    hovered: boolean;
  }>({
    group: null,
    plate: null,
    surface: null,
    progress: Number.NaN,
    viewportWidth: Number.NaN,
    hovered: !hovered,
  });

  // 1. Calculate the angle around the Y axis
  // Add Math.PI / 2 so the first item (index 0) starts perfectly facing the camera (z = R, x = 0)
  const angle = (index / N) * HELIX_ANGLE + Math.PI / 2;
  
  // 2. Calculate X and Z for circular placement
  const y = (TOTAL_Y_DROP / 2) - (index * Y_STEP);
  const faceAngle = Math.atan2(Math.cos(angle), Math.sin(angle));

  useFrame(({ size }) => {
    const group = groupRef.current;
    const plate = plateRef.current;
    const surface = surfaceRef.current;
    if (!group || !plate || !surface) return;
    const stagedProgress = presentationProgress(scroll.current, reduceMotion);
    const previous = presentationRef.current;
    if (
      previous.group === group
      && previous.plate === plate
      && previous.surface === surface
      && previous.progress === stagedProgress
      && previous.viewportWidth === size.width
      && previous.hovered === hovered
    ) return;

    const focus = focusFor(index, stagedProgress);
    const compact = size.width <= 430;
    const narrow = size.width <= 700;
    const helixRadius = helixRadiusFor(size.width);
    const plateScale = compact ? 410 / 720 : narrow ? 460 / 720 : size.width <= 900 ? 600 / 720 : 1;
    const radiusBoost = compact ? 1.15 : narrow ? 1.5 : FOCUS_RADIUS_BOOST;
    const baseScale = compact ? 0.66 : narrow ? 0.7 : 0.76;
    const focusScale = compact ? 1.42 : narrow ? 1.35 : FOCUS_SCALE;
    const radius = helixRadius + focus * radiusBoost;
    group.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const scale = baseScale + focus * (focusScale - baseScale);
    group.scale.setScalar(scale);
    plate.scale.setScalar(plateScale);
    surface.opacity = 0.18 + focus * 0.62 + (hovered ? 0.08 : 0);
    surface.emissiveIntensity = 0.035 + focus * 0.16;
    presentationRef.current = {
      group,
      plate,
      surface,
      progress: stagedProgress,
      viewportWidth: size.width,
      hovered,
    };
  }, -1);

  return (
    <group ref={groupRef} position={[Math.cos(angle) * HELIX_R, y, Math.sin(angle) * HELIX_R]} rotation={[0, faceAngle, 0]}>
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
          if (anchor) registry.cards.set(index, anchor);
          else registry.cards.delete(index);
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

function GalleryDomOverlay({
  handles,
  hoveredIndex,
  onHover,
}: {
  handles: GalleryDomHandles;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
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
        {ITEMS.map((item, index) => {
          const hovered = hoveredIndex === index;
          return (
            <article
              key={`gallery-card-${index}`}
              ref={(element) => {
                if (element) handles.cards.set(index, element);
                else handles.cards.delete(index);
              }}
              className={styles.archiveCard}
              aria-label={`${item.year}: ${item.title}. ${item.description}`}
              onMouseEnter={() => onHover(index)}
              onMouseLeave={() => onHover(null)}
            >
              <div className={styles.cardFrame} data-hovered={hovered ? 'true' : undefined}>
                <div className={styles.cardGrid} aria-hidden="true" />
                <div className={styles.cardHead}>
                  <span>ARC / {String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.status}><i /> VERIFIED</span>
                </div>
                <div className={styles.cardCore}>
                  <p className={styles.cardCategory}>{item.category}</p>
                  <div className={styles.cardIdentity}>
                    <strong>{item.year}</strong>
                    <h3>{item.title}</h3>
                  </div>
                  <p className={styles.cardDescription}>{item.description}</p>
                </div>
                <div className={styles.cardFoot}>
                  <span>{item.metric}</span>
                  <span>UIU / MARS ROVER TEAM</span>
                </div>
                <i className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
                <i className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />
              </div>
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
  hoveredIndex,
  quality,
  active,
  reduceMotion,
}: {
  registry: ProjectionRegistry;
  domHandles: GalleryDomHandles;
  hoveredIndex: number | null;
  quality: Quality;
  active: boolean;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const viewPosition = useMemo(() => new THREE.Vector3(), []);
  const transformRef = useRef<{ group: THREE.Group | null; progress: number }>({
    group: null,
    progress: Number.NaN,
  });
  const projectionRef = useRef<{
    group: THREE.Group | null;
    root: HTMLDivElement | null;
    cameraLayer: HTMLDivElement | null;
    camera: THREE.Camera | null;
    progress: number;
    width: number;
    height: number;
  }>({
    group: null,
    root: null,
    cameraLayer: null,
    camera: null,
    progress: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
  });

  // Scroll state must settle before card-local transforms run. ImagePlane uses
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

    const presentation = presentationProgress(scroll.current, reduceMotion);
    // The extra presentation range is only for the small -> focus -> small
    // boundary pulse. Holding the parent helix at its physical endpoints keeps
    // the Sun high on entry and Neptune low beside the footer on departure.
    const motionProgress = THREE.MathUtils.clamp(presentation, 0, 1);
    const previous = transformRef.current;
    if (
      previous.group !== groupRef.current
      || previous.progress !== motionProgress
    ) {
      // Spin the helix as user scrolls.
      groupRef.current.rotation.y = motionProgress * SCROLL_ROT;
      // Lift the helix to bring lower elements up, starting from the offset.
      groupRef.current.position.y = INITIAL_Y_OFFSET + motionProgress * TOTAL_LIFT;
      transformRef.current = { group: groupRef.current, progress: motionProgress };
    }
  }, -2);

  useFrame(({ camera, size }) => {
    const group = groupRef.current;
    if (!group) return;

    const p = presentationProgress(scroll.current, reduceMotion);

    const root = domHandles.root;
    const cameraLayer = domHandles.cameraLayer;
    if (!root || !cameraLayer) return;

    const previous = projectionRef.current;
    if (
      previous.group === group
      && previous.root === root
      && previous.cameraLayer === cameraLayer
      && previous.camera === camera
      && previous.progress === p
      && previous.width === size.width
      && previous.height === size.height
    ) return;

    // The Canvas and DOM overlay are separate React roots. Validate every
    // corresponding handle before touching the overlay, but only after the
    // unchanged-state fast path. This avoids an array plus eight object
    // allocations on every animation frame.
    for (let index = 0; index < N; index += 1) {
      if (!registry.cards.get(index) || !domHandles.cards.get(index)) return;
    }

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

    for (let index = 0; index < N; index += 1) {
      const anchor = registry.cards.get(index)!;
      const element = domHandles.cards.get(index)!;
      const focus = focusFor(index, p);
      element.style.setProperty('--card-focus', focus.toFixed(4));
      element.dataset.active = focus >= 0.82 ? 'true' : 'false';

      anchor.updateWorldMatrix(true, false);
      anchor.getWorldPosition(worldPosition);
      viewPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
      const visible = viewPosition.z < -camera.near && viewPosition.z > -camera.far;
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
      progress: p,
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
          topY={TOTAL_Y_DROP * 0.5 + SOLAR_TOP_OVERSCAN}
          bottomY={-TOTAL_Y_DROP * 0.5 - SOLAR_BOTTOM_OVERSCAN}
        />
        {ITEMS.map((_, i) => (
          <ImagePlane
            key={`ribbon-${i}`}
            index={i}
            hovered={hoveredIndex === i}
            reduceMotion={reduceMotion}
          />
        ))}
      </group>
    </ProjectionRegistryContext.Provider>
  );
}

/* ================================================================== *
 *  HTML Overlay                                                       *
 * ================================================================== */
function Overlay({
  active,
  reduceMotion,
}: {
  active: boolean;
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
        Math.round(archivePositionForScroll(scroll.current)),
        0,
        N - 1,
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
  }, [active]);

  const scrollToChapter = (index: number) => {
    const gallery = document.getElementById('helix-gallery');
    if (!gallery) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const sectionTop = gallery.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, gallery.offsetHeight - viewportHeight);
    const chapterProgress = scrollProgressForChapter(index);

    // Update the HUD immediately while native smooth scrolling advances the
    // same global scroll state used by the WebGL and DOM projection layers.
    setActiveIndex(index);
    window.scrollTo({
      top: sectionTop + travel * chapterProgress,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  const handleRailKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = Math.min(N - 1, index + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = N - 1;
    } else {
      return;
    }

    event.preventDefault();
    const buttons = railRef.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[nextIndex]?.focus({ preventScroll: true });
    scrollToChapter(nextIndex);
  };

  const activeItem = ITEMS[activeIndex] ?? ITEMS[0];

  return (
    <div className={styles.hud} data-active={active ? 'true' : 'false'}>
      <div className={styles.hudTop}>
        <div className={styles.hudIdentity}>
          <span>MISSION EVIDENCE / LIVE</span>
          <strong>{activeItem.title}</strong>
        </div>
        <div className={styles.hudProgress}>
          <div className={styles.progressMeta}>
            <span>ARC {String(activeIndex + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}</span>
            <span ref={percentRef}>000%</span>
          </div>
          <div ref={progressRef} className={styles.progressTrack}><i /></div>
        </div>
      </div>

      <aside
        ref={railRef}
        className={styles.hudRail}
        aria-label="Achievement archive chapters"
      >
        {ITEMS.map((item, index) => (
          <button
            key={`${item.year}-${item.title}`}
            type="button"
            data-active={index === activeIndex ? 'true' : undefined}
            aria-current={index === activeIndex ? 'step' : undefined}
            aria-label={`Go to chapter ${index + 1}: ${item.year} ${item.title}`}
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
        ))}
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() => getReducedMotion());
  const unmountTimerRef = useRef<number | null>(null);
  const quality = useMemo(() => detectQuality(), []);
  const dprMax = useResponsiveDpr(quality);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (unmountTimerRef.current) {
            window.clearTimeout(unmountTimerRef.current);
            unmountTimerRef.current = null;
          }
          setCanvasMounted(true);
          return;
        }
        if (unmountTimerRef.current) window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = window.setTimeout(() => {
          setCanvasMounted(false);
          unmountTimerRef.current = null;
        }, 3_000);
      },
      { rootMargin: '50% 0px' },
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (unmountTimerRef.current) {
        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!canvasMounted) {
      setHoveredIndex(null);
      setContextLost(false);
      projectionRegistryRef.current.cards.clear();
      domHandlesRef.current.cards.clear();
      domHandlesRef.current.root = null;
      domHandlesRef.current.cameraLayer = null;
      return undefined;
    }
    return () => {
      scroll.target = 0;
      scroll.current = 0;
    };
  }, [canvasMounted]);

  return (
    <section
      ref={containerRef}
      id="helix-gallery"
      className={styles.gallerySection}
      style={{ height: `${N * 88 + 96}svh` }}
    >
      <div className={styles.stickyStage}>
        <Overlay
          active={canvasActive && canvasMounted}
          reduceMotion={reduceMotion}
        />

        {canvasMounted && (
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
            >
              <HybridFrameGovernor
                startupDurationMs={1_200}
                suspended={!canvasActive}
                reduceMotion={reduceMotion}
              />
              <WebGLRendererLifecycle />
              <WebGLContextMonitor onLost={setContextLost} />
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
                  hoveredIndex={hoveredIndex}
                  quality={quality}
                  active={canvasActive}
                  reduceMotion={reduceMotion}
                />

              </Suspense>
            </Canvas>
            <GalleryDomOverlay
              handles={domHandlesRef.current}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />
          </>
        )}

        {!canvasMounted && (
          <div className={styles.canvasFallback} aria-hidden="true"><i /><span>INITIALIZING ORBITAL ARCHIVE</span></div>
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
