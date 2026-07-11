'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json';
import {
  ACHIEVEMENT_MILESTONES,
  type AchievementMilestone,
} from '@/components/achievements/achievementData';
import { COSMIC_SYSTEMS } from '@/components/achievements/cosmicArchiveConfig';
import {
  SystemCorridor,
  type CosmicJourney,
  type CosmicJourneyRef,
} from '@/components/achievements/CosmicUniverse';
import {
  detectQuality,
  dprFor,
  getReducedMotion,
  type Quality,
} from '@/lib/performance';
import { hasWebGLSupport } from '@/lib/webglSupport';

const MILESTONES = ACHIEVEMENT_MILESTONES;
const COUNT = MILESTONES.length;
const ARCHIVE_FONT = new FontLoader().parse(helvetikerFont);

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoother = (value: number) => {
  const next = clamp(value);
  return next * next * next * (next * (next * 6 - 15) + 10);
};

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotion());
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reducedMotion;
}

function wrapTitle(title: string) {
  const words = title.toUpperCase().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 19 && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function GeometryLabel({
  text,
  size,
  position,
  color,
  align = 'left',
  depth = 0.006,
}: {
  text: string;
  size: number;
  position: readonly [number, number, number];
  color: string;
  align?: 'left' | 'center' | 'right';
  depth?: number;
}) {
  const luminousColor = useMemo(() => new THREE.Color(color).multiplyScalar(6), [color]);
  const geometry = useMemo(() => {
    const next = new TextGeometry(text, {
      font: ARCHIVE_FONT,
      size,
      depth,
      curveSegments: 3,
      bevelEnabled: false,
    });
    next.computeBoundingBox();
    const width = next.boundingBox ? next.boundingBox.max.x - next.boundingBox.min.x : 0;
    if (align === 'center') next.translate(-width * 0.5, 0, 0);
    if (align === 'right') next.translate(-width, 0, 0);
    return next;
  }, [align, depth, size, text]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={position} renderOrder={100} frustumCulled={false}>
      <shaderMaterial
        uniforms={{ uColor: { value: luminousColor } }}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
        vertexShader={`
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          void main() {
            gl_FragColor = vec4(uColor, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function SignalMonument({
  item,
  index,
  journey,
  active,
}: {
  item: AchievementMilestone;
  index: number;
  journey: CosmicJourneyRef;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const faceMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const backingMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const { camera, size } = useThree();
  const systemPosition = COSMIC_SYSTEMS[index].position;
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const targetScale = useMemo(() => new THREE.Vector3(), []);
  const systemCenter = useMemo(() => new THREE.Vector3(...systemPosition), [systemPosition]);
  const rightAxis = useMemo(() => new THREE.Vector3(), []);
  const upAxis = useMemo(() => new THREE.Vector3(), []);
  const depthAxis = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Object3D(), []);
  const tiltQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const desiredQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tilt = useMemo(() => new THREE.Euler(), []);
  const titleLines = useMemo(() => wrapTitle(item.title), [item.title]);

  useFrame((_, delta) => {
    if (!active || !groupRef.current || !faceMaterialRef.current || !backingMaterialRef.current) return;
    const archivePosition = journey.current.current * (COUNT - 1);
    const local = archivePosition - index;
    const portrait = size.height > size.width * 1.08;
    const focus = 1 - THREE.MathUtils.smoothstep(Math.abs(local), 0.08, 0.88);
    const lane = ((index * 17) % 7 - 3) * 0.11;
    camera.matrixWorld.extractBasis(rightAxis, upAxis, depthAxis);
    targetPosition.copy(systemCenter)
      .addScaledVector(rightAxis, portrait ? 0 : 2.25)
      .addScaledVector(upAxis, portrait ? 1.35 : 0.52)
      .addScaledVector(depthAxis, portrait ? 0.75 : 0.42);

    if (local < 0) {
      const approach = smoother((local + 1.35) / 1.35);
      targetPosition
        .addScaledVector(rightAxis, (1 - approach) * (portrait ? 1.65 : 5.4 + lane))
        .addScaledVector(upAxis, (1 - approach) * (portrait ? 1.25 : 3.1 - lane))
        .addScaledVector(depthAxis, -(1 - approach) * (portrait ? 4.5 : 5.8));
      tilt.set(
        THREE.MathUtils.lerp(-0.42, 0, approach),
        THREE.MathUtils.lerp(-1.0, 0, approach),
        THREE.MathUtils.lerp(0.32, 0, approach),
      );
    } else {
      const departure = smoother((local - 0.28) / 0.92);
      targetPosition
        .addScaledVector(rightAxis, -departure * (portrait ? 1.8 : 5.8 - lane))
        .addScaledVector(upAxis, -departure * (portrait ? 1.3 : 3.2 + lane))
        .addScaledVector(depthAxis, -departure * (portrait ? 4.8 : 6.6));
      tilt.set(departure * 0.44, departure * 1.08, -departure * 0.38);
    }

    const smoothing = 1 - Math.exp(-delta * 8.2);
    groupRef.current.visible = Math.abs(local) < 1.48;
    groupRef.current.position.lerp(targetPosition, smoothing);
    targetScale.setScalar((portrait ? 0.84 : 1) * (0.6 + focus * 0.4));
    groupRef.current.scale.lerp(targetScale, smoothing);

    lookTarget.position.copy(groupRef.current.position);
    lookTarget.lookAt(camera.position);
    desiredQuaternion.copy(lookTarget.quaternion);
    tiltQuaternion.setFromEuler(tilt);
    desiredQuaternion.multiply(tiltQuaternion);
    groupRef.current.quaternion.slerp(desiredQuaternion, smoothing);

    faceMaterialRef.current.emissiveIntensity = 0.015 + focus * 0.055;
    backingMaterialRef.current.emissiveIntensity = 0.025 + focus * 0.08;
  });

  const accent = index % 3 === 1 ? '#d8ff4f' : '#ff5a1f';
  const corners = [
    [-1.91, 1.1, 0.13], [1.91, 1.1, 0.13],
    [-1.91, -1.1, 0.13], [1.91, -1.1, 0.13],
  ] as const;

  return (
    <group ref={groupRef} visible={index === 0}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4.1, 2.48, 0.16]} />
        <meshPhysicalMaterial
          ref={faceMaterialRef}
          color="#080706"
          emissive={accent}
          emissiveIntensity={0.15}
          metalness={0.8}
          roughness={0.24}
          clearcoat={0.42}
          clearcoatRoughness={0.2}
        />
        <Edges color={accent} threshold={18} />
      </mesh>
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[4.24, 2.6, 0.16]} />
        <meshStandardMaterial ref={backingMaterialRef} color="#110805" emissive="#441307" emissiveIntensity={0.1} metalness={0.86} roughness={0.3} />
      </mesh>

      {corners.map((position, corner) => (
        <mesh key={corner} position={position}>
          <boxGeometry args={[0.18, 0.18, 0.2]} />
          <meshStandardMaterial color="#1c100a" emissive={corner % 2 ? '#d8ff4f' : '#ff5a1f'} emissiveIntensity={0.85} metalness={0.9} roughness={0.22} />
        </mesh>
      ))}

      <mesh position={[0, 0.93, 0.098]}>
        <boxGeometry args={[3.42, 0.014, 0.018]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[1.62, -0.84, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.011, 5, 44]} />
        <meshBasicMaterial color="#d8ff4f" transparent opacity={0.62} toneMapped={false} depthWrite={false} />
      </mesh>

      <group position={[0, 0, 0.22]}>
        <GeometryLabel text={`${item.code} / CELESTIAL RECORD`} size={0.074} position={[-1.7, 0.72, 0]} color="#a49e94" />
        <GeometryLabel text={item.category.toUpperCase()} size={0.07} position={[1.7, 0.72, 0]} color={accent} align="right" />
        <GeometryLabel text={item.year} size={0.49} position={[-1.7, 0.08, 0]} color="#d8ff4f" depth={0.012} />
        {titleLines.map((line, lineIndex) => (
          <GeometryLabel key={line} text={line} size={0.205} position={[-1.68, -0.39 - lineIndex * 0.29, 0]} color="#f2efe8" depth={0.008} />
        ))}
        <GeometryLabel text="SIGNAL AUTHENTICATED" size={0.064} position={[-1.7, -0.96, 0]} color="#9b958b" />
        <GeometryLabel text={`${String(index + 1).padStart(2, '0')} / ${String(COUNT).padStart(2, '0')}`} size={0.064} position={[1.7, -0.96, 0]} color="#9b958b" align="right" />
      </group>
    </group>
  );
}

function CameraJourney({
  journey,
  active,
  onUpdate,
}: {
  journey: CosmicJourneyRef;
  active: boolean;
  onUpdate: (index: number, percent: number) => void;
}) {
  const { camera, size, gl } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const fromSystem = useMemo(() => new THREE.Vector3(), []);
  const toSystem = useMemo(() => new THREE.Vector3(), []);
  const lastIndex = useRef(-1);
  const lastPercent = useRef(-1);

  useFrame((_, delta) => {
    if (!active) return;
    journey.current.current = THREE.MathUtils.damp(journey.current.current, journey.current.target, 5.2, delta);
    const archivePosition = journey.current.current * (COUNT - 1);
    const segment = Math.min(COUNT - 2, Math.floor(archivePosition));
    const segmentProgress = archivePosition - segment;
    // Hold each system long enough to inspect it, then compress the interstellar
    // leap into a decisive portal crossing around the middle of each chapter.
    const eased = smoother((segmentProgress - 0.38) / 0.24);
    const from = COSMIC_SYSTEMS[segment].position;
    const to = COSMIC_SYSTEMS[segment + 1].position;
    fromSystem.set(from[0], from[1], from[2]);
    toSystem.set(to[0], to[1], to[2]);
    const portrait = size.height > size.width * 1.08;
    const cameraDistance = portrait ? 11.7 : 9.6;
    const transitionDive = Math.sin(eased * Math.PI);

    desired.copy(fromSystem).lerp(toSystem, eased);
    desired.z += cameraDistance - transitionDive * 0.55;
    desired.x += Math.sin(eased * Math.PI * 2) * (portrait ? 0.3 : 0.72);
    desired.y += Math.sin(eased * Math.PI) * (portrait ? 0.24 : 0.52);
    camera.position.lerp(desired, 1 - Math.exp(-delta * 5.4));

    target.copy(fromSystem).lerp(toSystem, eased);
    target.x += portrait ? 0 : 0.35;
    target.y += portrait ? 0.42 : 0.08;
    target.z -= transitionDive * 0.85;
    camera.lookAt(target);

    const perspective = camera as THREE.PerspectiveCamera;
    const desiredFov = portrait ? 54 : size.width < 700 ? 51 : 42;
    if (Math.abs(perspective.fov - desiredFov) > 0.01) {
      perspective.fov = desiredFov;
      perspective.updateProjectionMatrix();
    }
    gl.toneMappingExposure = 1.02;

    const nextIndex = Math.min(COUNT - 1, Math.max(0, Math.round(archivePosition)));
    const nextPercent = Math.round(journey.current.current * 100);
    if (nextIndex !== lastIndex.current || nextPercent !== lastPercent.current) {
      lastIndex.current = nextIndex;
      lastPercent.current = nextPercent;
      onUpdate(nextIndex, nextPercent);
    }
  });
  return null;
}

function CosmicScene({
  journey,
  quality,
  active,
  onUpdate,
}: {
  journey: CosmicJourneyRef;
  quality: Quality;
  active: boolean;
  onUpdate: (index: number, percent: number) => void;
}) {
  return (
    <>
      <color attach="background" args={['#010102']} />
      <fogExp2 attach="fog" args={['#020103', 0.012]} />
      <ambientLight color="#28100a" intensity={0.32} />
      <SystemCorridor quality={quality} journey={journey} active={active} />
      {MILESTONES.map((item, index) => (
        <SignalMonument key={item.code} item={item} index={index} journey={journey} active={active} />
      ))}
      <CameraJourney journey={journey} active={active} onUpdate={onUpdate} />
    </>
  );
}

function MilestoneNavigation({ activeIndex, onSelect }: { activeIndex: number; onSelect: (index: number) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    const compactGrid = window.matchMedia('(max-width: 700px)').matches;
    if (event.key === 'ArrowDown') next = Math.min(COUNT - 1, index + (compactGrid ? 4 : 1));
    else if (event.key === 'ArrowUp') next = Math.max(0, index - (compactGrid ? 4 : 1));
    else if (event.key === 'ArrowRight') next = Math.min(COUNT - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = COUNT - 1;
    else return;
    event.preventDefault();
    onSelect(next);
    refs.current[next]?.focus({ preventScroll: true });
  };

  return (
    <nav className="achievement-cosmic-nav" aria-label="Achievement systems">
      {MILESTONES.map((item, index) => (
        <button
          key={item.code}
          ref={(node) => { refs.current[index] = node; }}
          type="button"
          aria-label={`${item.year}: ${item.title}`}
          aria-current={index === activeIndex ? 'step' : undefined}
          data-active={index === activeIndex}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <i aria-hidden="true" />
          <span>{item.year}</span>
        </button>
      ))}
    </nav>
  );
}

function CosmicOverlay({
  progress,
  activeIndex,
  onSelect,
}: {
  progress: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const active = MILESTONES[activeIndex];
  const system = COSMIC_SYSTEMS[activeIndex];
  return (
    <div className="achievement-cosmic-overlay">
      <header className="achievement-cosmic-topline">
        <div><span>UMRT / Multiverse archive</span><strong>{system.name}</strong></div>
        <div className="achievement-cosmic-progress" aria-hidden="true">
          <span>{String(progress).padStart(3, '0')}%</span>
          <i><b style={{ width: `${progress}%` }} /></i>
        </div>
      </header>
      <aside className="achievement-cosmic-readout" aria-live="polite">
        <span>System {String(activeIndex + 1).padStart(2, '0')} / Closest approach</span>
        <strong>{active.year}</strong>
        <p>{active.code} / {active.category}</p>
        <small>{active.title}</small>
        <em>{active.description}</em>
      </aside>
      <MilestoneNavigation activeIndex={activeIndex} onSelect={onSelect} />
      <footer className="achievement-cosmic-caption" aria-hidden="true">
        <span>Scroll to cross the next planetary system</span>
        <span>Seven transition gates / eight verified signals</span>
      </footer>
    </div>
  );
}

function SemanticMilestoneList() {
  return (
    <ol className="sr-only">
      {MILESTONES.map((item) => (
        <li key={item.code}><article><p>{item.year} / {item.category}</p><h3>{item.title}</h3><p>{item.description}</p></article></li>
      ))}
    </ol>
  );
}

export function StaticAchievementArchive() {
  return (
    <section id="cosmic-archive" className="achievement-static-archive" aria-labelledby="static-archive-title">
      <header>
        <p>Motion-free multiverse record / 2020—2025</p>
        <h2 id="static-archive-title">Eight systems. One trajectory.</h2>
        <span>The complete UMRT achievement record, presented chronologically without WebGL or animated movement.</span>
      </header>
      <div className="achievement-static-constellation" aria-hidden="true">
        {MILESTONES.map((item) => <i key={item.code} />)}
      </div>
      <ol className="achievement-static-list">
        {MILESTONES.map((item, index) => (
          <li key={item.code}>
            <article>
              <div><span>{item.code}</span><b>{item.category}</b></div>
              <strong>{item.year}</strong><h3>{item.title}</h3><p>{item.description}</p>
              <small>{String(index + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}</small>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CapabilityCheck() {
  return (
    <section className="achievement-cosmic-section achievement-cosmic-loading" aria-label="Checking 3D archive support">
      <div className="achievement-cosmic-sticky"><div className="achievement-archive-loader" role="status"><span aria-hidden="true" /><strong>Mapping deep-space corridor</strong><small>Eight systems / seven gates</small></div></div>
    </section>
  );
}

export default function HelixGallery3D() {
  const containerRef = useRef<HTMLElement>(null);
  const journey = useRef<CosmicJourney>({ target: 0, current: 0 });
  const reducedMotion = useReducedMotionPreference();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<Quality>('medium');
  const [dpr, setDpr] = useState(1);
  const [sectionActive, setSectionActive] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setWebgl(hasWebGLSupport());
    const nextQuality = detectQuality();
    setQuality(nextQuality);
    setDpr(dprFor(nextQuality));
  }, []);

  useEffect(() => {
    if (reducedMotion || webgl !== true) return;
    const section = containerRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setSectionActive(entry.isIntersecting), { rootMargin: '28% 0px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, [reducedMotion, webgl]);

  useEffect(() => {
    if (reducedMotion || webgl !== true) return;
    journey.current.target = 0;
    journey.current.current = 0;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const section = containerRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      journey.current.target = clamp(-rect.top / travel);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(sync); };
    sync();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion, webgl]);

  const updateHud = useCallback((nextIndex: number, nextPercent: number) => {
    setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    setProgress((current) => current === nextPercent ? current : nextPercent);
  }, []);

  const selectMilestone = useCallback((index: number) => {
    const section = containerRef.current;
    if (!section) return;
    const travel = Math.max(1, section.offsetHeight - window.innerHeight);
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    // Leave a full reading viewport before the sticky scene yields to the
    // footer; 0.94 still resolves to milestone 08 and the final system.
    const milestoneProgress = index === COUNT - 1 ? 0.94 : index / (COUNT - 1);
    window.scrollTo({ top: sectionTop + travel * milestoneProgress, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  if (reducedMotion || webgl === false) return <StaticAchievementArchive />;
  if (webgl === null) return <CapabilityCheck />;

  return (
    <section ref={containerRef} id="cosmic-archive" className="achievement-cosmic-section" aria-label="Scroll-driven multiverse achievement archive">
      <SemanticMilestoneList />
      <div className="achievement-cosmic-sticky">
        <CosmicOverlay progress={progress} activeIndex={activeIndex} onSelect={selectMilestone} />
        <Canvas
          shadows={quality !== 'low'}
          frameloop={sectionActive ? 'always' : 'demand'}
          dpr={dpr}
          camera={{ position: [0, 0, 9.6], fov: 42, near: 0.08, far: 230 }}
          gl={{ antialias: quality === 'high', alpha: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
          performance={{ min: 0.55 }}
        >
          <CosmicScene journey={journey} quality={quality} active={sectionActive} onUpdate={updateHud} />
        </Canvas>
      </div>
    </section>
  );
}
