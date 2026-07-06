'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ScrollControls, useScroll, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/* ================================================================== */
/*  Achievement Data                                                   */
/* ================================================================== */

interface Achievement {
  year: string;
  title: string;
  description: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    year: '2025',
    title: 'URC Top 5 Finish',
    description: 'Achieved a top 5 placement at URC 2025',
  },
  {
    year: '2024',
    title: 'Technical Innovation',
    description: 'Won the autonomous navigation category',
  },
  {
    year: '2024',
    title: 'URC Top 10',
    description: 'Top 10 at Mars Desert Research Station',
  },
  {
    year: '2023',
    title: 'European Rover Challenge',
    description: 'Top 15 finish at ERC in Poland',
  },
  {
    year: '2022',
    title: 'Best Rookie Team',
    description: 'Most promising newcomer at URC 2022',
  },
  {
    year: '2022',
    title: 'URC Qualification',
    description: 'First-ever qualification for URC',
  },
  {
    year: '2021',
    title: 'First Rover Prototype',
    description: 'Built and tested our first rover',
  },
  {
    year: '2020',
    title: 'Team Founded',
    description: 'UMRT was established',
  },
];

/* ================================================================== */
/*  Constants for helix geometry                                       */
/* ================================================================== */

const HELIX_RADIUS = 3.2;
const HELIX_VERTICAL_SPACING = 2.4;
const HELIX_TOTAL_ROTATION = Math.PI * 3; // 1.5 full turns
const SLAB_WIDTH = 2.4;
const SLAB_HEIGHT = 1.4;
const SLAB_DEPTH = 0.22;
const COLUMN_RADIUS = 0.55;
const COLUMN_HEIGHT = ACHIEVEMENTS.length * HELIX_VERTICAL_SPACING + 6;

/* ================================================================== */
/*  Stone Material (Weathered, Matte)                                  */
/* ================================================================== */

function useStoneMaterial(darker = false) {
  const texture = useTexture('/textures/image_c345c3.jpg');

  return useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    return new THREE.MeshStandardMaterial({
      map: texture,
      color: darker ? new THREE.Color('#3a2a1a') : new THREE.Color('#5a4530'),
      roughness: 0.95,
      metalness: 0.02,
      bumpMap: texture,
      bumpScale: 0.06,
    });
  }, [texture, darker]);
}

/* ================================================================== */
/*  Ground Plane                                                       */
/* ================================================================== */

function Ground() {
  const texture = useTexture('/textures/image_c345c3.jpg');

  const mat = useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);

    return new THREE.MeshStandardMaterial({
      map: texture,
      color: new THREE.Color('#2a1c0e'),
      roughness: 1,
      metalness: 0,
      bumpMap: texture,
      bumpScale: 0.08,
    });
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ================================================================== */
/*  Central Stone Column                                               */
/* ================================================================== */

function StoneColumn() {
  const material = useStoneMaterial(true);

  return (
    <mesh position={[0, COLUMN_HEIGHT / 2 - 3, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS * 1.15, COLUMN_HEIGHT, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ================================================================== */
/*  Achievement Slab (single stone tablet with text)                   */
/* ================================================================== */

function AchievementSlab({
  achievement,
  index,
  total,
}: {
  achievement: Achievement;
  index: number;
  total: number;
}) {
  const material = useStoneMaterial(false);
  const slabRef = useRef<THREE.Group>(null);

  // Helix position calculation
  const angle = (index / total) * HELIX_TOTAL_ROTATION;
  const x = Math.cos(angle) * HELIX_RADIUS;
  const z = Math.sin(angle) * HELIX_RADIUS;
  const y = -index * HELIX_VERTICAL_SPACING;

  // Face the slab toward the central column
  const lookAtAngle = Math.atan2(-z, -x);

  return (
    <group
      ref={slabRef}
      position={[x, y, z]}
      rotation={[0, lookAtAngle, 0]}
    >
      {/* Stone slab */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[SLAB_WIDTH, SLAB_HEIGHT, SLAB_DEPTH]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Year text — carved into the slab face */}
      <Text
        position={[0, 0.25, SLAB_DEPTH / 2 + 0.01]}
        fontSize={0.32}
        color="#c4a95a"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.15}
        maxWidth={SLAB_WIDTH - 0.4}
      >
        {achievement.year}
      </Text>

      {/* Title text */}
      <Text
        position={[0, -0.12, SLAB_DEPTH / 2 + 0.01]}
        fontSize={0.15}
        color="#d4c4a0"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
        maxWidth={SLAB_WIDTH - 0.4}
      >
        {achievement.title.toUpperCase()}
      </Text>

      {/* Description text */}
      <Text
        position={[0, -0.38, SLAB_DEPTH / 2 + 0.01]}
        fontSize={0.09}
        color="#a09070"
        anchorX="center"
        anchorY="middle"
        maxWidth={SLAB_WIDTH - 0.6}
        lineHeight={1.4}
      >
        {achievement.description}
      </Text>
    </group>
  );
}

/* ================================================================== */
/*  Helix Group — scroll-driven rotation and lift                      */
/* ================================================================== */

function HelixGroup() {
  const groupRef = useRef<THREE.Group>(null);
  const scroll = useScroll();

  useFrame(() => {
    if (!groupRef.current) return;

    const offset = scroll.offset; // 0 → 1

    // Lift the entire helix upward as user scrolls
    const totalLift = (ACHIEVEMENTS.length - 1) * HELIX_VERTICAL_SPACING + 4;
    groupRef.current.position.y = offset * totalLift;

    // Rotate the helix — 1.5 full rotations
    groupRef.current.rotation.y = offset * Math.PI * 3;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {ACHIEVEMENTS.map((achievement, i) => (
        <AchievementSlab
          key={`${achievement.year}-${achievement.title}`}
          achievement={achievement}
          index={i}
          total={ACHIEVEMENTS.length}
        />
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Floating Dust Particles                                            */
/* ================================================================== */

function DustParticles() {
  const count = 300;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = Math.random() * 25 - 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const posAttr = ref.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += delta * 0.15;
      arr[i * 3] += Math.sin(Date.now() * 0.001 + i) * delta * 0.03;
      if (arr[i * 3 + 1] > 22) arr[i * 3 + 1] = -3;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8a7050"
        size={0.04}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ================================================================== */
/*  Scene Setup — fog, lighting, camera                                */
/* ================================================================== */

function SceneSetup() {
  const { scene } = useThree();

  useMemo(() => {
    scene.fog = new THREE.FogExp2('#1a0f06', 0.045);
    scene.background = new THREE.Color('#0d0804');
  }, [scene]);

  return null;
}

/* ================================================================== */
/*  Inner Scene (must be inside Canvas + ScrollControls)               */
/* ================================================================== */

function InnerScene() {
  return (
    <>
      <SceneSetup />

      {/* Warm directional sunlight — harsh desert feel */}
      <directionalLight
        position={[8, 15, 5]}
        intensity={2.2}
        color="#e8c080"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={25}
        shadow-camera-bottom={-10}
        shadow-bias={-0.001}
      />

      {/* Fill light — very subtle warm bounce */}
      <directionalLight
        position={[-5, 3, -8]}
        intensity={0.3}
        color="#c09060"
      />

      {/* Ambient — minimal, keeping shadows deep */}
      <ambientLight intensity={0.12} color="#8a6040" />

      {/* Ground */}
      <Ground />

      {/* Central monolithic column */}
      <StoneColumn />

      {/* Helix of achievement slabs */}
      <HelixGroup />

      {/* Atmospheric dust */}
      <DustParticles />
    </>
  );
}

/* ================================================================== */
/*  HTML Overlay                                                       */
/* ================================================================== */

function HtmlOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-start pt-8 sm:pt-12">
      {/* Main title */}
      <h1
        className="font-display select-none text-center text-5xl font-bold uppercase tracking-[0.35em] sm:text-7xl md:text-8xl lg:text-9xl"
        style={{
          color: '#9a8555',
          textShadow:
            '0 2px 8px rgba(0,0,0,0.7), 0 0 40px rgba(154,133,85,0.15)',
          letterSpacing: '0.35em',
        }}
      >
        ACHIEVEMENTS
      </h1>

      {/* Subtitle */}
      <p
        className="mt-3 select-none text-center text-xs uppercase tracking-[0.5em] sm:mt-4 sm:text-sm"
        style={{
          color: '#6a5a3a',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        Monuments of Progress
      </p>

      {/* Scroll hint at bottom */}
      <div className="absolute bottom-8 flex flex-col items-center gap-2 opacity-50">
        <p
          className="text-[10px] uppercase tracking-[0.4em]"
          style={{ color: '#7a6a4a' }}
        >
          Scroll to explore
        </p>
        <svg
          width="20"
          height="28"
          viewBox="0 0 20 28"
          fill="none"
          className="animate-bounce"
        >
          <rect
            x="1"
            y="1"
            width="18"
            height="26"
            rx="9"
            stroke="#7a6a4a"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="9" r="2" fill="#9a8555">
            <animate
              attributeName="cy"
              values="8;16;8"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.3;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Exported Component                                            */
/* ================================================================== */

export default function AchievementsMonolith() {
  return (
    <div className="relative h-screen w-full" style={{ background: '#0d0804' }}>
      {/* HTML overlay on top of the 3D scene */}
      <HtmlOverlay />

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{
          position: [0, 2, 10],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ScrollControls pages={5} damping={0.25}>
          <InnerScene />
        </ScrollControls>
      </Canvas>
    </div>
  );
}
