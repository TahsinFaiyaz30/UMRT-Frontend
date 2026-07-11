'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  ACHIEVEMENT_MILESTONES,
  type AchievementMilestone,
} from '@/components/achievements/achievementData';
import { modelConfig } from '@/lib/modelConfig';
import {
  detectQuality,
  dprFor,
  getReducedMotion,
  type Quality,
} from '@/lib/performance';

const MILESTONES = ACHIEVEMENT_MILESTONES;
const COUNT = MILESTONES.length;

const HELIX_RADIUS = 4.2;
const HELIX_TOP_Y = 2.05;
const HELIX_BOTTOM_Y = -0.2;
const HELIX_TURNS = 1.4;
const HELIX_START_ANGLE = -0.4;
const CAMERA_RADIUS = 8.2;
const CAMERA_LEAD = -0.74;
const CARD_WIDTH = 1.72;
const CARD_HEIGHT = 1.02;

type Journey = {
  target: number;
  current: number;
};

type JourneyRef = React.MutableRefObject<Journey>;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function pointOnHelix(progress: number, radius = HELIX_RADIUS) {
  const angle = HELIX_START_ANGLE + progress * Math.PI * 2 * HELIX_TURNS;
  return {
    angle,
    x: Math.sin(angle) * radius,
    y: THREE.MathUtils.lerp(HELIX_TOP_Y, HELIX_BOTTOM_Y, progress),
    z: Math.cos(angle) * radius,
  };
}

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

function SparseDust({ quality, active }: { quality: Quality; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = quality === 'high' ? 170 : quality === 'medium' ? 100 : 0;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const radius = 3.2 + ((index * 37) % Math.max(1, count)) / Math.max(1, count) * 12;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = -1.4 + ((index * 53) % Math.max(1, count)) / Math.max(1, count) * 7;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  useFrame((state) => {
    if (!active || !ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.006;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.09) * 0.08;
  });

  if (count === 0) return null;

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#c86b3c"
        size={quality === 'high' ? 0.085 : 0.1}
        transparent
        opacity={0.28}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function MissionEnvironment({
  quality,
  active,
}: {
  quality: Quality;
  active: boolean;
}) {
  const shadowSize = quality === 'high' ? 1024 : 512;

  return (
    <>
      <color attach="background" args={['#030303']} />
      <fogExp2 attach="fog" args={['#120502', 0.032]} />
      <ambientLight intensity={0.32} color="#ff9d68" />
      <hemisphereLight args={['#ffb47d', '#070202', 0.48]} />
      <directionalLight
        position={[7, 11, 6]}
        intensity={2.8}
        color="#fff0d8"
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <pointLight position={[-5, 3.5, 2]} intensity={13} distance={18} color="#ff4f1c" />
      <pointLight position={[5, 1, -3]} intensity={8} distance={14} color="#d8ff4f" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow={quality !== 'low'}>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color="#0e0604" roughness={1} />
      </mesh>
      <gridHelper position={[0, -0.405, 0]} args={[30, 30, '#63210f', '#24100a']} material-transparent material-opacity={0.16} />
      <SparseDust quality={quality} active={active} />
    </>
  );
}

function CoreSegment({
  index,
  journey,
  active,
}: {
  index: number;
  journey: JourneyRef;
  active: boolean;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!active || !materialRef.current) return;
    const position = journey.current.current * (COUNT - 1);
    const distance = Math.abs(position - index);
    const completed = position >= index - 0.08;
    const focus = 1 - THREE.MathUtils.smoothstep(distance, 0, 0.78);
    materialRef.current.emissiveIntensity = (completed ? 0.58 : 0.08) + focus * 1.4;
    materialRef.current.opacity = (completed ? 0.72 : 0.2) + focus * 0.25;
  });

  return (
    <group rotation={[0, index * (Math.PI * 2 / COUNT), 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.04, 0.035, 7, 18, Math.PI * 0.18]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#2c180f"
          emissive="#d8ff4f"
          emissiveIntensity={0.08}
          metalness={0.78}
          roughness={0.24}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

function MissionCore({
  journey,
  quality,
  active,
}: {
  journey: JourneyRef;
  quality: Quality;
  active: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const pulseMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const gltf = useGLTF(modelConfig.mainPath) as { scene: THREE.Group };
  const rover = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = quality !== 'low';
      mesh.receiveShadow = quality !== 'low';
    });
    return clone;
  }, [gltf.scene, quality]);

  useFrame((state) => {
    if (!active || !pulseRef.current || !pulseMaterialRef.current) return;
    const phase = (state.clock.elapsedTime * 0.22) % 1;
    pulseRef.current.scale.setScalar(0.9 + phase * 0.28);
    pulseMaterialRef.current.opacity = 0.18 * (1 - phase);
  });

  return (
    <group>
      <pointLight position={[0, 1.1, 1]} intensity={10} distance={7} color="#ff6a2b" />

      <group position={[0, -0.3, 0]}>
        <mesh receiveShadow={quality !== 'low'}>
          <cylinderGeometry args={[2.34, 2.45, 0.2, 64]} />
          <meshStandardMaterial color="#130906" metalness={0.76} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.18, 0.028, 8, 72]} />
          <meshStandardMaterial color="#26150d" emissive="#ff5a1f" emissiveIntensity={0.7} metalness={0.84} roughness={0.22} />
        </mesh>
        {MILESTONES.map((item, index) => (
          <CoreSegment key={item.code} index={index} journey={journey} active={active} />
        ))}
        <mesh ref={pulseRef} position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.25, 2.29, 72]} />
          <meshBasicMaterial ref={pulseMaterialRef} color="#d8ff4f" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>

      <group
        position={modelConfig.basePosition}
        rotation={[0, modelConfig.rotationY, 0]}
        scale={modelConfig.scale * 1.05}
      >
        <primitive object={rover} />
      </group>

      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.45, 0.018, 6, 80]} />
        <meshBasicMaterial color="#d8ff4f" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]} rotation={[0.38, Math.PI / 2, 0]}>
        <torusGeometry args={[2.02, 0.014, 6, 72]} />
        <meshBasicMaterial color="#ff5a1f" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HelixRail() {
  const curve = useMemo(() => {
    const samples = Array.from({ length: 97 }, (_, index) => {
      const point = pointOnHelix(index / 96);
      return new THREE.Vector3(point.x, point.y, point.z);
    });
    return new THREE.CatmullRomCurve3(samples, false, 'catmullrom', 0.2);
  }, []);

  return (
    <mesh>
      <tubeGeometry args={[curve, 160, 0.018, 6, false]} />
      <meshStandardMaterial
        color="#4d210f"
        emissive="#ff5a1f"
        emissiveIntensity={0.68}
        metalness={0.6}
        roughness={0.38}
        transparent
        opacity={0.72}
      />
    </mesh>
  );
}

function Connector({
  progress,
  index,
  journey,
  active,
}: {
  progress: number;
  index: number;
  journey: JourneyRef;
  active: boolean;
}) {
  const point = pointOnHelix(progress);
  const geometry = useMemo(() => {
    const innerRadius = 2.3;
    const buffer = new THREE.BufferGeometry();
    buffer.setFromPoints([
      new THREE.Vector3(
        Math.sin(point.angle) * innerRadius,
        THREE.MathUtils.clamp(point.y, 0.05, 0.85),
        Math.cos(point.angle) * innerRadius,
      ),
      new THREE.Vector3(point.x, point.y, point.z),
    ]);
    return buffer;
  }, [point.angle, point.x, point.y, point.z]);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ff6a2b', transparent: true, opacity: 0.1 }),
    [],
  );
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    if (!active) return;
    const distance = Math.abs(journey.current.current * (COUNT - 1) - index);
    const focus = 1 - THREE.MathUtils.smoothstep(distance, 0, 1.25);
    material.opacity = 0.1 + focus * 0.62;
  });

  return <primitive object={line} />;
}

function AchievementCard({
  item,
  index,
  journey,
  active,
}: {
  item: AchievementMilestone;
  index: number;
  journey: JourneyRef;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const htmlRef = useRef<HTMLElement>(null);
  const itemProgress = index / (COUNT - 1);
  const point = pointOnHelix(itemProgress);
  const scaleTarget = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const worldQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const facingNormal = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!active || !groupRef.current || !materialRef.current) return;
    const milestonePosition = journey.current.current * (COUNT - 1);
    const distance = Math.abs(milestonePosition - index);
    const nearest = Math.round(milestonePosition) === index;
    const focus = 1 - THREE.MathUtils.smoothstep(distance, 0, 0.9);
    const neighbour = 1 - THREE.MathUtils.smoothstep(distance, 0.35, 1.6);
    const desiredScale = 0.76 + focus * 0.24;

    groupRef.current.scale.lerp(scaleTarget.setScalar(desiredScale), 1 - Math.exp(-delta * 8));
    materialRef.current.emissiveIntensity = 0.12 + focus * 0.92;
    materialRef.current.opacity = 0.12 + neighbour * 0.34 + focus * 0.42;

    if (htmlRef.current) {
      groupRef.current.getWorldPosition(worldPosition);
      groupRef.current.getWorldQuaternion(worldQuaternion);
      facingNormal.set(0, 0, 1).applyQuaternion(worldQuaternion);
      cameraDirection.copy(state.camera.position).sub(worldPosition).normalize();
      const facingCamera = facingNormal.dot(cameraDirection) > 0.06;
      htmlRef.current.style.opacity = nearest && facingCamera ? '1' : '0';
    }
  });

  return (
    <group ref={groupRef} position={[point.x, point.y, point.z]} rotation={[0, point.angle, 0]}>
      <mesh>
        <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, 0.09]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#0a0705"
          emissive="#ff5a1f"
          emissiveIntensity={0.12}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.42}
        />
        <Edges color="#5d2412" />
      </mesh>

      <Html
        transform
        center
        position={[0, 0, 0.052]}
        distanceFactor={3.72}
        pointerEvents="none"
        zIndexRange={[6, 1]}
      >
        <article ref={htmlRef} className="achievement-orbit-card" aria-hidden="true">
          <div className="achievement-orbit-card-top">
            <span>{item.code}</span>
            <span>{item.category}</span>
          </div>
          <strong>{item.year}</strong>
          <h3>{item.title}</h3>
          <div className="achievement-orbit-card-signal">
            <i />
            <span>Verified milestone</span>
          </div>
        </article>
      </Html>
    </group>
  );
}

function CameraJourney({
  journey,
  active,
  onUpdate,
}: {
  journey: JourneyRef;
  active: boolean;
  onUpdate: (index: number, percent: number) => void;
}) {
  const { camera, size, gl } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const lastIndex = useRef(-1);
  const lastPercent = useRef(-1);

  useFrame((_, delta) => {
    if (!active) return;
    journey.current.current = THREE.MathUtils.lerp(
      journey.current.current,
      journey.current.target,
      1 - Math.exp(-delta * 5.2),
    );

    const progress = journey.current.current;
    const milestonePosition = progress * (COUNT - 1);
    const segment = Math.min(COUNT - 2, Math.floor(milestonePosition));
    const segmentProgress = milestonePosition - segment;
    const easedSegmentProgress = segmentProgress < 0.5
      ? 4 * segmentProgress ** 3
      : 1 - ((-2 * segmentProgress + 2) ** 3) / 2;
    const cameraProgress = (segment + easedSegmentProgress) / (COUNT - 1);
    const mobile = size.width < 640;
    const radius = mobile ? CAMERA_RADIUS * 1.32 : CAMERA_RADIUS;
    const cardPath = pointOnHelix(cameraProgress, radius);
    const cameraAngle = cardPath.angle + (mobile ? CAMERA_LEAD - 0.12 : CAMERA_LEAD);
    const cameraY = THREE.MathUtils.lerp(mobile ? 2.62 : 2.25, mobile ? 1.68 : 1.25, cameraProgress);

    desired.set(
      Math.sin(cameraAngle) * radius,
      cameraY,
      Math.cos(cameraAngle) * radius,
    );
    camera.position.lerp(desired, 1 - Math.exp(-delta * 5.6));
    const targetBias = mobile ? 0.68 : 0.54;
    target.set(
      Math.sin(cardPath.angle) * targetBias,
      mobile ? 0.78 : 0.7,
      Math.cos(cardPath.angle) * targetBias,
    );
    camera.lookAt(target);

    const desiredFov = mobile ? 53 : 39;
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (Math.abs(perspectiveCamera.fov - desiredFov) > 0.01) {
      perspectiveCamera.fov = desiredFov;
      perspectiveCamera.updateProjectionMatrix();
    }
    gl.toneMappingExposure = 1.02;

    const nextIndex = Math.min(COUNT - 1, Math.max(0, Math.round(milestonePosition)));
    const nextPercent = Math.round(progress * 100);
    if (nextIndex !== lastIndex.current || nextPercent !== lastPercent.current) {
      lastIndex.current = nextIndex;
      lastPercent.current = nextPercent;
      onUpdate(nextIndex, nextPercent);
    }
  });

  return null;
}

function Scene({
  journey,
  quality,
  active,
  onUpdate,
}: {
  journey: JourneyRef;
  quality: Quality;
  active: boolean;
  onUpdate: (index: number, percent: number) => void;
}) {
  return (
    <>
      <MissionEnvironment quality={quality} active={active} />
      <Suspense fallback={null}>
        <MissionCore journey={journey} quality={quality} active={active} />
      </Suspense>
      <HelixRail />
      {MILESTONES.map((item, index) => {
        const progress = index / (COUNT - 1);
        return (
          <group key={item.code}>
            <Connector progress={progress} index={index} journey={journey} active={active} />
            <AchievementCard item={item} index={index} journey={journey} active={active} />
          </group>
        );
      })}
      <CameraJourney journey={journey} active={active} onUpdate={onUpdate} />
    </>
  );
}

function MilestoneNavigation({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav className="achievement-helix-rail" aria-label="Achievement milestones">
      {MILESTONES.map((item, index) => (
        <button
          key={item.code}
          type="button"
          aria-label={`${item.year}: ${item.title}`}
          aria-current={index === activeIndex ? 'step' : undefined}
          data-active={index === activeIndex}
          onClick={() => onSelect(index)}
        >
          <i aria-hidden="true" />
          <span>{item.year}</span>
        </button>
      ))}
    </nav>
  );
}

function GalleryOverlay({
  progress,
  activeIndex,
  onSelect,
}: {
  progress: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const active = MILESTONES[activeIndex];

  return (
    <div className="achievement-helix-overlay">
      <div className="achievement-helix-topline">
        <div>
          <span>UMRT / Chronological archive</span>
          <strong>Rover development core</strong>
        </div>
        <div className="achievement-helix-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
          <span>{String(progress).padStart(3, '0')}%</span>
        </div>
      </div>

      <article className="achievement-helix-focus" aria-live="off">
        <div>
          <span>{active.code} / {active.year}</span>
          <b>{active.category}</b>
        </div>
        <h2 key={active.code}>{active.title}</h2>
        <p>{active.description}</p>
        <small>Milestone {String(activeIndex + 1).padStart(2, '0')} of {String(COUNT).padStart(2, '0')}</small>
      </article>

      <MilestoneNavigation activeIndex={activeIndex} onSelect={onSelect} />

      <div className="achievement-helix-caption" aria-hidden="true">
        <span>Scroll / orbit through the archive</span>
        <span>The machine remains at the centre</span>
      </div>
    </div>
  );
}

function SemanticMilestoneList() {
  return (
    <ol className="sr-only">
      {MILESTONES.map((item) => (
        <li key={item.code}>
          <article>
            <p>{item.year} / {item.category}</p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}

function StaticAchievementArchive() {
  return (
    <section id="helix-gallery" className="achievement-static-archive" aria-labelledby="static-archive-title">
      <header>
        <p>Reduced-motion archive / 2020—2025</p>
        <h2 id="static-archive-title">The milestones behind the machine</h2>
        <span>Every result is presented in a motion-free chronological record.</span>
      </header>

      <div className="achievement-static-core" aria-label="Rover development core">
        <i aria-hidden="true" />
        <div>
          <span>Development artifact</span>
          <strong>Rover engineering core</strong>
          <p>Eight milestones, one continuously evolving machine.</p>
        </div>
      </div>

      <ol className="achievement-static-list">
        {MILESTONES.map((item, index) => (
          <li key={item.code}>
            <article>
              <div>
                <span>{item.code}</span>
                <b>{item.category}</b>
              </div>
              <strong>{item.year}</strong>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>{String(index + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}</small>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function HelixGallery3D() {
  const containerRef = useRef<HTMLElement>(null);
  const journey = useRef<Journey>({ target: 0, current: 0 });
  const reducedMotion = useReducedMotionPreference();
  const [quality, setQuality] = useState<Quality>('medium');
  const [dpr, setDpr] = useState(1);
  const [sectionActive, setSectionActive] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const nextQuality = detectQuality();
    setQuality(nextQuality);
    setDpr(dprFor(nextQuality));
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    useGLTF.preload(modelConfig.mainPath);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const section = containerRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSectionActive(entry.isIntersecting),
      { rootMargin: '35% 0px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
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
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);
    return () => {
      window.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  const updateHud = useCallback((nextIndex: number, nextPercent: number) => {
    setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    setProgress((current) => current === nextPercent ? current : nextPercent);
  }, []);

  const selectMilestone = useCallback((index: number) => {
    const section = containerRef.current;
    if (!section) return;
    const travel = Math.max(1, section.offsetHeight - window.innerHeight);
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const destination = sectionTop + travel * (index / (COUNT - 1));
    window.scrollTo({ top: destination, behavior: 'smooth' });
  }, []);

  if (reducedMotion) return <StaticAchievementArchive />;

  return (
    <section ref={containerRef} id="helix-gallery" className="achievement-helix-section" aria-label="Chronological achievement archive">
      <SemanticMilestoneList />
      <div className="achievement-helix-sticky">
        <GalleryOverlay progress={progress} activeIndex={activeIndex} onSelect={selectMilestone} />
        <Canvas
          shadows={quality !== 'low'}
          frameloop={sectionActive ? 'always' : 'demand'}
          dpr={dpr}
          camera={{ position: [3.1, 2.25, 7.6], fov: 39, near: 0.1, far: 60 }}
          gl={{
            antialias: quality === 'high',
            alpha: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.02,
          }}
          performance={{ min: 0.5 }}
        >
          <Scene journey={journey} quality={quality} active={sectionActive} onUpdate={updateHud} />
        </Canvas>
      </div>
    </section>
  );
}
