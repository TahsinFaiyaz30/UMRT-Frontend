'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { modelConfig } from '@/lib/modelConfig';

type Milestone = {
  year: string;
  title: string;
  description: string;
  code: string;
};

const MILESTONES: Milestone[] = [
  { year: '2025', title: 'URC TOP 5', description: 'A top-five finish on the world stage — our strongest complete mission run yet.', code: 'M-08' },
  { year: '2024', title: 'TECHNICAL INNOVATION', description: 'Autonomous navigation turned uncertain terrain into decisive movement.', code: 'M-07' },
  { year: '2024', title: 'URC TOP 10', description: 'A complete rover system proved itself at the Mars Desert Research Station.', code: 'M-06' },
  { year: '2023', title: 'ERC POLAND', description: 'UMRT carried its engineering to Europe and finished among the top fifteen.', code: 'M-05' },
  { year: '2022', title: 'BEST ROOKIE TEAM', description: 'The team arrived as a newcomer and left as one of the competition’s revelations.', code: 'M-04' },
  { year: '2022', title: 'URC QUALIFICATION', description: 'The first qualification transformed a workshop ambition into a global mission.', code: 'M-03' },
  { year: '2021', title: 'FIRST PROTOTYPE', description: 'The first rover moved under its own power — a rough machine with a clear future.', code: 'M-02' },
  { year: '2020', title: 'TEAM FOUNDED', description: 'A small multidisciplinary group committed to building beyond the classroom.', code: 'M-01' },
];

const COUNT = MILESTONES.length;
const HELIX_RADIUS = 3.35;
const CAMERA_RADIUS = 8.9;
const TOP_Y = 5.25;
const BOTTOM_Y = -5.25;
const HELIX_TURNS = 1.72;
const CARD_SIZE = 2.28;
const CAMERA_ANGLE_OFFSET = 0.2;

const journey = { target: 0, current: 0 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function pointOnHelix(progress: number, radius = HELIX_RADIUS) {
  const angle = progress * Math.PI * 2 * HELIX_TURNS;
  return {
    angle,
    x: Math.sin(angle) * radius,
    y: THREE.MathUtils.lerp(TOP_Y, BOTTOM_Y, progress),
    z: Math.cos(angle) * radius,
  };
}

function MissionEnvironment() {
  return (
    <>
      <color attach="background" args={['#030303']} />
      <fogExp2 attach="fog" args={['#120502', 0.038]} />
      <ambientLight intensity={0.22} color="#ff9d68" />
      <hemisphereLight args={['#ffb47d', '#070202', 0.38]} />
      <directionalLight
        position={[8, 14, 7]}
        intensity={3.4}
        color="#fff0d8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[-8, 5, 2]} intensity={26} distance={24} color="#ff4f1c" />
      <pointLight position={[7, -4, -2]} intensity={18} distance={22} color="#d8ff4f" />
      <OrbitalDust />
      <DeepGrid />
    </>
  );
}

function DeepGrid() {
  return (
    <group position={[0, BOTTOM_Y - 2.2, 0]}>
      <gridHelper
        args={[42, 42, '#ff5a1f', '#411008']}
        material-transparent
        material-opacity={0.18}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[21, 72]} />
        <meshStandardMaterial color="#100302" roughness={1} />
      </mesh>
    </group>
  );
}

function OrbitalDust() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const radius = 3 + ((index * 29) % count) / count * 15;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = -11 + ((index * 47) % count) / count * 23;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.009;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.13) * 0.18;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#ff9b66" size={0.035} transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function MissionCore() {
  const turntableRef = useRef<THREE.Group>(null);
  const scannerRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelConfig.mainPath) as { scene: THREE.Group };
  const rover = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    });
    return clone;
  }, [gltf.scene]);

  const gantryLevels = useMemo(
    () => Array.from({ length: 15 }, (_, index) => BOTTOM_Y - 0.65 + index * ((TOP_Y - BOTTOM_Y + 1.3) / 14)),
    [],
  );

  useFrame((state, delta) => {
    if (turntableRef.current) turntableRef.current.rotation.y += delta * 0.075;
    if (scannerRef.current) {
      scannerRef.current.position.y = THREE.MathUtils.lerp(TOP_Y, BOTTOM_Y, journey.current);
      scannerRef.current.rotation.y -= delta * 0.34;
    }
  });

  return (
    <group>
      <pointLight position={[0, 1.4, 1]} intensity={22} distance={8} color="#ff6a2b" />
      <pointLight position={[0, -0.4, -1.5]} intensity={12} distance={7} color="#d8ff4f" />

      {/* Four-rail engineering archive gantry: a physical carrier for the real rover. */}
      {[[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]].map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.09, TOP_Y - BOTTOM_Y + 1.6, 0.09]} />
            <meshStandardMaterial color="#2b160e" emissive="#ff4e17" emissiveIntensity={0.22} metalness={0.88} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, 0.055]}>
            <boxGeometry args={[0.025, TOP_Y - BOTTOM_Y + 1.45, 0.018]} />
            <meshBasicMaterial color="#ff7a38" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {gantryLevels.map((y, index) => (
        <group key={y} position={[0, y, 0]} rotation={[0, index % 2 ? Math.PI / 4 : 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.58, 0.055, 0.055]} />
            <meshStandardMaterial color="#4b1d0d" metalness={0.82} roughness={0.3} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[1.58, 0.055, 0.055]} />
            <meshStandardMaterial color="#4b1d0d" metalness={0.82} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.98, index % 3 === 0 ? 0.025 : 0.012, 6, 56]} />
            <meshBasicMaterial color={index % 3 === 0 ? '#d8ff4f' : '#ff5a1f'} transparent opacity={index % 3 === 0 ? 0.28 : 0.12} />
          </mesh>
        </group>
      ))}

      <group position={[0, -1.42, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[2.15, 2.35, 0.22, 72]} />
          <meshStandardMaterial color="#140a06" metalness={0.78} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.92, 0.055, 10, 96]} />
          <meshStandardMaterial color="#1c140d" emissive="#d8ff4f" emissiveIntensity={1.15} metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[1.42, 1.72, 0.32, 12]} />
          <meshStandardMaterial color="#481508" emissive="#7e210b" emissiveIntensity={0.45} metalness={0.74} roughness={0.34} />
        </mesh>
      </group>

      <group ref={turntableRef} position={[0, -1.2, 0]} rotation={[0, -0.32, 0]} scale={1.36}>
        <primitive object={rover} />
      </group>

      <group position={[0, 0.1, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.15, 0.035, 10, 96]} />
          <meshStandardMaterial color="#1a110c" emissive="#d8ff4f" emissiveIntensity={1.3} metalness={0.84} roughness={0.22} />
        </mesh>
        <mesh rotation={[0.35, Math.PI / 2, 0]}>
          <torusGeometry args={[1.82, 0.025, 10, 96]} />
          <meshStandardMaterial color="#280d06" emissive="#ff5a1f" emissiveIntensity={1.05} metalness={0.8} roughness={0.24} />
        </mesh>
      </group>

      <group ref={scannerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.08, 0.022, 8, 96]} />
          <meshBasicMaterial color="#d8ff4f" transparent opacity={0.78} />
        </mesh>
        <pointLight intensity={13} distance={6} color="#d8ff4f" />
      </group>
    </group>
  );
}

function Connector({ progress }: { progress: number }) {
  const point = pointOnHelix(progress);
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setFromPoints([
      new THREE.Vector3(0.38 * Math.sin(point.angle), point.y, 0.38 * Math.cos(point.angle)),
      new THREE.Vector3(point.x, point.y, point.z),
    ]);
    return buffer;
  }, [point.angle, point.x, point.y, point.z]);
  const line = useMemo(
    () => new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0.24 }),
    ),
    [geometry],
  );

  return <primitive object={line} />;
}

function AchievementCard({ item, index }: { item: Milestone; index: number }) {
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
    if (!groupRef.current || !materialRef.current) return;
    const distance = Math.abs(journey.current - itemProgress);
    const focus = 1 - THREE.MathUtils.smoothstep(distance, 0.015, 0.16);
    const desiredScale = 0.86 + focus * 0.18;
    groupRef.current.scale.lerp(scaleTarget.setScalar(desiredScale), 1 - Math.exp(-delta * 7));
    groupRef.current.position.y = point.y + Math.sin(state.clock.elapsedTime * 0.48 + index) * 0.045;
    materialRef.current.emissiveIntensity = 0.18 + focus * 1.15;
    materialRef.current.opacity = 0.72 + focus * 0.24;
    if (htmlRef.current) {
      groupRef.current.getWorldPosition(worldPosition);
      groupRef.current.getWorldQuaternion(worldQuaternion);
      facingNormal.set(0, 0, 1).applyQuaternion(worldQuaternion);
      cameraDirection.copy(state.camera.position).sub(worldPosition).normalize();
      htmlRef.current.style.opacity = facingNormal.dot(cameraDirection) > 0.08 ? '1' : '0';
    }
  });

  return (
    <group ref={groupRef} position={[point.x, point.y, point.z]} rotation={[0, point.angle, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CARD_SIZE, CARD_SIZE, 0.14]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#0b0806"
          emissive="#ff5a1f"
          emissiveIntensity={0.18}
          metalness={0.68}
          roughness={0.28}
          transparent
          opacity={0.78}
        />
        <Edges color="#ff6a2b" />
      </mesh>

      <mesh position={[0, 0, 0.076]}>
        <planeGeometry args={[CARD_SIZE - 0.14, CARD_SIZE - 0.14]} />
        <meshBasicMaterial color="#050504" transparent opacity={0.78} />
      </mesh>

      <Html transform center position={[0, 0, 0.095]} distanceFactor={3.8} pointerEvents="none">
        <article ref={htmlRef} className="achievement-orbit-card">
          <div className="achievement-orbit-card-top">
            <span>{item.code}</span>
            <span>ARCHIVE / VERIFIED</span>
          </div>
          <strong>{item.year}</strong>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="achievement-orbit-card-signal"><i /><span>MISSION MILESTONE</span></div>
        </article>
      </Html>

      <mesh position={[-CARD_SIZE / 2 + 0.16, CARD_SIZE / 2 - 0.16, 0.11]}>
        <boxGeometry args={[0.2, 0.035, 0.035]} />
        <meshBasicMaterial color="#d8ff4f" />
      </mesh>
      <mesh position={[-CARD_SIZE / 2 + 0.075, CARD_SIZE / 2 - 0.075, 0.11]}>
        <boxGeometry args={[0.035, 0.2, 0.035]} />
        <meshBasicMaterial color="#d8ff4f" />
      </mesh>
    </group>
  );
}

function CameraJourney() {
  const { camera, size, pointer, gl } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    journey.current = THREE.MathUtils.lerp(journey.current, journey.target, 1 - Math.exp(-delta * 4.6));
    const progress = journey.current;
    const milestonePosition = progress * (COUNT - 1);
    const segment = Math.min(COUNT - 2, Math.floor(milestonePosition));
    const segmentProgress = milestonePosition - segment;
    const easedSegmentProgress = segmentProgress < 0.5
      ? 4 * segmentProgress ** 3
      : 1 - ((-2 * segmentProgress + 2) ** 3) / 2;
    const cameraProgress = (segment + easedSegmentProgress) / (COUNT - 1);
    const radius = size.width < 700 ? CAMERA_RADIUS * 1.18 : CAMERA_RADIUS;
    const path = pointOnHelix(cameraProgress, radius);
    const cameraAngle = path.angle + (size.width < 700 ? 0.12 : CAMERA_ANGLE_OFFSET);
    const breathing = Math.sin(cameraProgress * Math.PI * 4) * 0.42;

    desired.set(
      Math.sin(cameraAngle) * radius + pointer.x * (size.width < 700 ? 0.06 : 0.28),
      path.y + 0.35 - pointer.y * 0.16,
      Math.cos(cameraAngle) * radius,
    );
    camera.position.lerp(desired, 1 - Math.exp(-delta * 5.2));
    target.set(0, path.y - 0.1, 0);
    camera.lookAt(target);
    camera.rotateZ(Math.sin(cameraProgress * Math.PI * 6) * 0.018);
    (camera as THREE.PerspectiveCamera).fov = (size.width < 700 ? 48 : 40) + breathing;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    gl.toneMappingExposure = 1.04 + Math.sin(progress * Math.PI) * 0.16;
  });

  return null;
}

function Scene() {
  return (
    <>
      <MissionEnvironment />
      <Suspense fallback={null}>
        <MissionCore />
      </Suspense>
      {MILESTONES.map((item, index) => {
        const progress = index / (COUNT - 1);
        return (
          <group key={`${item.year}-${item.code}`}>
            <Connector progress={progress} />
            <AchievementCard item={item} index={index} />
          </group>
        );
      })}
      <CameraJourney />
    </>
  );
}

function GalleryOverlay() {
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let frame = 0;
    let lastPercent = -1;
    let lastIndex = -1;
    const update = () => {
      const percent = Math.round(journey.current * 100);
      const index = Math.min(COUNT - 1, Math.max(0, Math.round(journey.current * (COUNT - 1))));
      if (percent !== lastPercent) {
        lastPercent = percent;
        setProgress(percent);
      }
      if (index !== lastIndex) {
        lastIndex = index;
        setActiveIndex(index);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  const active = MILESTONES[activeIndex];

  return (
    <div className="achievement-helix-overlay">
      <div className="achievement-helix-topline">
        <div>
          <span>UMRT / MISSION ARCHIVE</span>
          <strong>CAMERA HELIX 01</strong>
        </div>
        <div className="achievement-helix-progress">
          <i style={{ width: `${progress}%` }} />
          <span>{String(progress).padStart(3, '0')}%</span>
        </div>
      </div>

      <div className="achievement-helix-focus">
        <span>{active.code} / {active.year}</span>
        <h2 key={active.code}>{active.title}</h2>
        <p>Camera locked to archive node {String(activeIndex + 1).padStart(2, '0')} of {String(COUNT).padStart(2, '0')}</p>
      </div>

      <div className="achievement-helix-core-label">
        <span>LEGACY CORE / LIVE ARTIFACT</span>
        <strong>THE REAL UMRT ROVER</strong>
      </div>

      <div className="achievement-helix-rail" aria-hidden="true">
        {MILESTONES.map((item, index) => (
          <i key={item.code} data-active={index === activeIndex} />
        ))}
      </div>

      <div className="achievement-helix-caption">
        <span>SCROLL / CAMERA DESCENT</span>
        <span>DENSE ARCHIVE ORBIT / CAMERA MOVES / ROVER REMAINS</span>
      </div>
    </div>
  );
}

export default function HelixGallery3D() {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    journey.target = 0;
    journey.current = 0;
    const sync = () => {
      const section = containerRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      journey.target = clamp(-rect.top / travel);
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <section ref={containerRef} id="helix-gallery" className="achievement-helix-section">
      <div className="achievement-helix-sticky">
        <GalleryOverlay />
        <Canvas
          shadows
          camera={{ position: [0, TOP_Y, CAMERA_RADIUS], fov: 40, near: 0.1, far: 80 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.04,
          }}
        >
          <Scene />
        </Canvas>
      </div>
    </section>
  );
}

useGLTF.preload(modelConfig.mainPath);
