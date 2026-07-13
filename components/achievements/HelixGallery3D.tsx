'use client';

import {
  useRef,
  useMemo,
  useEffect,
  useState,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html, Stars, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, BrightnessContrast, SMAA, Vignette } from '@react-three/postprocessing';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { detectQuality, dprFor } from '@/lib/performance';
import { disposeRenderer } from '@/lib/threeDisposal';

/* ================================================================== *
 *  GSAP ScrollTrigger                                                 *
 * ================================================================== */
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ================================================================== *
 *  Gallery Data                                                       *
 * ================================================================== */
interface GalleryItem {
  year: string;
  title: string;
  description: string;
  image: string | null;
}

// Expanded Dummy Data
const BASE_ITEMS: GalleryItem[] = [
  { year: '2025', title: 'URC TOP 5', description: 'After rigorous testing in harsh desert environments, the rover showcased unparalleled autonomous capabilities, securing a top 5 finish.', image: null },
  { year: '2024', title: 'INNOVATION', description: 'Awarded for groundbreaking real-time SLAM and obstacle avoidance algorithms, vastly improving spatial awareness.', image: null },
  { year: '2024', title: 'URC TOP 10', description: 'A breakthrough year where mechanical reliability and advanced robotic arm dexterity catapulted us into the top 10.', image: null },
  { year: '2023', title: 'ERC POLAND', description: 'Competed internationally at the European Rover Challenge, mastering the complex maintenance task under extreme time pressure.', image: null },
  { year: '2022', title: 'BEST ROOKIE', description: 'Debuted at the University Rover Challenge with a robust suspension system that stunned the judges, earning the Rookie Award.', image: null },
  { year: '2022', title: 'URC QUAL', description: 'The historic moment our team officially qualified for URC, validating thousands of hours of design and manufacturing.', image: null },
  { year: '2021', title: 'PROTOTYPE', description: 'The foundation was laid with our first 6-wheel rocker-bogie prototype, proving our drive systems in local rough terrain.', image: null },
  { year: '2020', title: 'FOUNDED', description: 'UMRT was born from a shared vision to push the boundaries of student engineering and space exploration technology.', image: null },
];

// To create the dense, continuous ribbon effect seen in the reference image,
// we duplicate the items to form a long continuous spiral.
const RIBBON_COUNT = 8; 
const ITEMS: GalleryItem[] = Array.from({ length: RIBBON_COUNT }).map((_, i) => {
  return BASE_ITEMS[i % BASE_ITEMS.length];
});

/* ================================================================== *
 *  Helix Layout Constants                                             *
 * ================================================================== */
const N            = ITEMS.length;
const HELIX_R      = 7.5;           // larger orbit radius for large cards
const HELIX_TURNS  = 1;             // number of full helical turns
const HELIX_ANGLE  = Math.PI * 2 * HELIX_TURNS;
const TOTAL_Y_DROP = 16;            // total height of the spiral
const Y_STEP       = TOTAL_Y_DROP / N;

const CARD_W       = 4.0;           // much larger width for picture holder
const CARD_H       = 2.5;           // proportional height

/* ================================================================== *
 *  Scroll Animation Constants                                         *
 * ================================================================== */
const SCROLL_ROT       = ((N - 1) / N) * HELIX_ANGLE;  // Positive = right-to-left rotation
const INITIAL_Y_OFFSET = -8.0;                         // Lowered to center panels below navbar
const TOTAL_LIFT       = 14.0;                         // Exact lift to center last item at y=2
const LERP_SPEED       = 0.08;

/* ================================================================== *
 *  Shared scroll state                                                *
 * ================================================================== */
const scroll = { target: 0, current: 0 };

/* ================================================================== *
 *  Environment — Dark, cinematic background                           *
 * ================================================================== */
function Environment() {
  const { scene } = useThree();

  useMemo(() => {
    // Transparent background to allow HTML CSS gradient to show through
    scene.fog = null;
    scene.background = null;
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.05} color="#ffffff" />
    </>
  );
}

/* ================================================================== *
 *  Skydome (replaces HTML background to prevent scroll bugs)          *
 * ================================================================== */
function Skydome() {
  const texture = useTexture('/textures/starfield.png');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); // Tile the stars to make them look tiny and distant

  return (
    <mesh>
      <sphereGeometry args={[150, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} transparent opacity={0.15} />
    </mesh>
  );
}

/* ================================================================== *
 *  Image Plane — Tangent to the cylinder surface                      *
 *                                                                     *
 *  In the reference image, the planes form a continuous ribbon.       *
 *  rotation.y = Math.atan2(x, z) makes them face directly outward.    *
 * ================================================================== */
function ImagePlane({ item, index }: { item: GalleryItem; index: number }) {
  const [hovered, setHovered] = useState(false);

  // 1. Calculate the angle around the Y axis
  // Add Math.PI / 2 so the first item (index 0) starts perfectly facing the camera (z = R, x = 0)
  const angle = (index / N) * HELIX_ANGLE + Math.PI / 2;
  
  // 2. Calculate X and Z for circular placement
  const x = Math.cos(angle) * HELIX_R;
  const z = Math.sin(angle) * HELIX_R;
  
  // 3. Calculate descending Y position
  const y = (TOTAL_Y_DROP / 2) - (index * Y_STEP);
  
  // 4. Calculate rotation so the plane's normal points radially outward
  const faceAngle = Math.atan2(x, z);

  return (
    <group position={[x, y, z]} rotation={[0, faceAngle, 0]}>
      {/* ── Main Image Box (Greyish Glass Theme) ── */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshPhysicalMaterial 
          color="#999999"
          roughness={0.2}
          metalness={0.3}
          clearcoat={1.0}
          transparent
          opacity={hovered ? 0.4 : 0.15}
          side={THREE.DoubleSide}
        />
        <Edges scale={1} color={hovered ? '#ffffff' : 'rgba(255,255,255,0.1)'} />
      </mesh>

      {/* ── Interactive DOM Content ── */}
      <Html
        transform
        position={[0, 0, 0.02]}
        center
        scale={0.01}
        occlude="blending"
        className="flex flex-col justify-end"
        style={{ width: '400px', height: '250px', pointerEvents: 'auto' }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: 'pointer',
            transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease',
            transform: hovered ? 'scale(1.1) translateY(-10px)' : 'scale(1)',
            boxShadow: hovered
              ? '0 20px 50px rgba(255,255,255,0.15), inset 0 0 30px rgba(255,255,255,0.5)'
              : '0 4px 20px rgba(0,0,0,0.5)',
            borderRadius: '16px',
            overflow: 'hidden',
            zIndex: hovered ? 50 : 1,
          }}
        >
          {/* Greyish Blurry Glass Background */}
          <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gray-500/10 backdrop-blur-xl transition-all duration-300 group-hover:bg-gray-400/20" />

          {/* Always-visible: Year + Title */}
          <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-5 text-left">
            <span className="font-display text-5xl font-extrabold tracking-widest text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {item.year}
            </span>
            <p className="mt-1 font-body text-xl font-bold tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {item.title}
            </p>
          </div>

          {/* Hover overlay — slides up with dummy description data */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '24px',
              background: 'linear-gradient(to top, rgba(200,200,200,0.95) 0%, rgba(200,200,200,0.7) 50%, rgba(200,200,200,0.2) 100%)',
              backdropFilter: 'blur(12px)',
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
              borderRadius: '12px',
              zIndex: 20,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: '#333333',
                fontWeight: 800,
                marginBottom: '8px',
              }}
            >
              {item.year} — {item.title}
            </span>
            <p
              style={{
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#111111',
                fontWeight: 600,
                margin: 0,
              }}
            >
              {item.description}
            </p>
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ================================================================== *
 *  Vertical Solar System Centerpiece                                  *
 * ================================================================== */
interface MoonData {
  name: string;
  dist: number;
  size: number;
  speed: number;
}

interface PlanetData {
  name: string;
  textureMap: string;
  size: number;
  hasGlow?: boolean;
  ring?: {
    inner: number;
    outer: number;
    color: string;
  };
  moons: MoonData[];
}

const SOLAR_DATA: PlanetData[] = [
  { name: 'SUN',     textureMap: '/textures/sunmap.jpg', size: 3.5, hasGlow: true, moons: [] },
  { name: 'MERCURY', textureMap: '/textures/mercurymap.jpg', size: 0.25, moons: [] },
  { name: 'VENUS',   textureMap: '/textures/venusmap.jpg', size: 0.45, moons: [] },
  { name: 'EARTH',   textureMap: '/textures/earthmap1k.jpg', size: 0.55, moons: [{ name: 'MOON', dist: 1.0, size: 0.08, speed: 2 }] },
  { name: 'MARS',    textureMap: '/textures/marsmap1k.jpg', size: 0.35, moons: [{ name: 'PHOBOS', dist: 0.7, size: 0.05, speed: 2.5 }, { name: 'DEIMOS', dist: 0.9, size: 0.04, speed: 1.8 }] },
  { name: 'JUPITER', textureMap: '/textures/jupitermap.jpg', size: 1.5, moons: [
      { name: 'IO', dist: 2.1, size: 0.08, speed: 3.0 },
      { name: 'EUROPA', dist: 2.5, size: 0.06, speed: 2.4 },
      { name: 'GANYMEDE', dist: 3.0, size: 0.09, speed: 1.8 },
      { name: 'CALLISTO', dist: 3.6, size: 0.07, speed: 1.2 },
  ] },
  { name: 'SATURN',  textureMap: '/textures/saturnmap.jpg', size: 1.2, ring: { inner: 1.5, outer: 2.6, color: '#c9b897' }, moons: [
      { name: 'TITAN', dist: 3.2, size: 0.09, speed: 1.5 },
      { name: 'RHEA', dist: 3.8, size: 0.06, speed: 1.1 },
      { name: 'IAPETUS', dist: 4.4, size: 0.05, speed: 0.8 },
  ] },
  { name: 'URANUS',  textureMap: '/textures/uranusmap.jpg', size: 0.8, ring: { inner: 1.1, outer: 1.5, color: '#a3c2ce' }, moons: [
      { name: 'MIRANDA', dist: 1.8, size: 0.05, speed: 1.7 },
      { name: 'ARIEL', dist: 2.2, size: 0.06, speed: 1.3 },
      { name: 'UMBRIEL', dist: 2.6, size: 0.06, speed: 1.0 },
  ] },
  { name: 'NEPTUNE', textureMap: '/textures/neptunemap.jpg', size: 0.8, moons: [ { name: 'TRITON', dist: 1.6, size: 0.08, speed: 1.9 }] },
  { name: 'PLUTO',   textureMap: '/textures/plutomap1k.jpg', size: 0.15, moons: [{ name: 'CHARON', dist: 0.5, size: 0.05, speed: 1.5 }] },
];

const GALLERY_TEXTURE_URLS = [
  '/textures/starfield.png',
  '/textures/moonmap1k.jpg',
  ...SOLAR_DATA.map((planet) => planet.textureMap),
];

function Moon({ moon }: { moon: MoonData }) {
  const orbitRef = useRef<THREE.Group>(null);
  const timeOffset = useMemo(() => Math.random() * 100, []);
  
  // All moons share the moon texture
  const texture = useTexture('/textures/moonmap1k.jpg');

  useFrame(({ clock }) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = (clock.getElapsedTime() + timeOffset) * moon.speed;
    }
  });

  return (
    <group>
      {/* Orbit Line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[moon.dist, moon.dist + 0.005, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Moon Body */}
      <group ref={orbitRef}>
        <mesh position={[moon.dist, 0, 0]}>
          <sphereGeometry args={[moon.size, 32, 32]} />
          <meshStandardMaterial map={texture} roughness={0.8} />
        </mesh>
        <Html position={[moon.dist + 0.1, 0, 0]} center className="pointer-events-none">
          <span className="whitespace-nowrap font-display text-[7px] font-bold tracking-widest text-white/50">
            {moon.name}
          </span>
        </Html>
      </group>
    </group>
  );
}

function PlanetBody({ data, yPos }: { data: PlanetData; yPos: number }) {
  const planetRef = useRef<THREE.Group>(null);
  const timeOffset = useMemo(() => Math.random() * 100, []);
  
  const texture = useTexture(data.textureMap);

  useFrame(({ clock }) => {
    if (planetRef.current) {
      planetRef.current.rotation.y = (clock.getElapsedTime() + timeOffset) * 0.2;
    }
  });

  return (
    <group position={[0, yPos, 0]}>
      {/* Planet Label */}
      <Html position={[data.size + 0.5, 0, 0]} center className="pointer-events-none">
        <span className="whitespace-nowrap font-display text-[9px] font-bold tracking-widest text-white/70 drop-shadow-md">
          {data.name}
        </span>
      </Html>

      {/* Tilt the planet system slightly to match the reference image's perspective */}
      <group rotation={[0.15, 0, 0]} ref={planetRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[data.size, 64, 64]} />
          {data.hasGlow ? (
            <meshStandardMaterial 
              map={texture} 
              emissiveMap={texture}
              emissive="#ff5500"
              emissiveIntensity={10.0}
              roughness={1.0}
            />
          ) : (
            <meshStandardMaterial 
              map={texture} 
              roughness={0.3} 
              metalness={0.2}
              bumpMap={texture}
              bumpScale={0.6}
            />
          )}
        </mesh>

        {/* Sun atmospheric glow overlay & Solar Flares */}
        {data.hasGlow && (
          <group>
            {/* Multiple volumetric glowing halos for photorealistic soft corona */}
            <mesh>
              <sphereGeometry args={[data.size * 1.1, 32, 32]} />
              <meshBasicMaterial color="#ffddaa" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[data.size * 1.3, 32, 32]} />
              <meshBasicMaterial color="#ff8800" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[data.size * 1.6, 32, 32]} />
              <meshBasicMaterial color="#ff3300" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[data.size * 2.0, 32, 32]} />
              <meshBasicMaterial color="#aa0000" transparent opacity={0.02} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Solar flares simulation (toroidal arcs sticking out randomly) */}
            {[...Array(6)].map((_, i) => (
              <mesh key={`flare-${i}`} rotation={[Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, 0]} position={[0, 0, 0]}>
                <torusGeometry args={[data.size * 1.02, Math.random() * 0.05 + 0.02, 16, 50, Math.PI / (Math.random() * 2 + 1.5)]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
            ))}
          </group>
        )}

        {/* Planet Rings */}
        {data.ring && (
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <ringGeometry args={[data.ring.inner, data.ring.outer, 128]} />
            <meshStandardMaterial color={data.ring.color} side={THREE.DoubleSide} transparent opacity={0.65} />
          </mesh>
        )}

        {/* Moons */}
        {data.moons.map((moon, idx) => (
          <Moon key={idx} moon={moon} />
        ))}
      </group>
    </group>
  );
}

function SolarSystem() {
  const N_BODIES = SOLAR_DATA.length;
  // Space them out vertically matching the helix height
  const SPACING = (TOTAL_Y_DROP + 12) / (N_BODIES - 1);
  const START_Y = (TOTAL_Y_DROP / 2) + 6;
  const END_Y = START_Y - ((N_BODIES - 1) * SPACING);

  return (
    <group>
      {/* 
        Lighting: Pouring light from the Sun downwards.
        - directionalLight is offset slightly to cast beautiful angular shadows across the cratored surfaces.
      */}
      <ambientLight intensity={0.25} color="#ffffff" />
      <directionalLight 
        position={[5, START_Y + 10, 5]} 
        intensity={4.0} 
        color="#ffeadd" 
        castShadow 
        target-position={[0, -100, 0]}
      />
      
      {/* Sun Core Light (gives an extra kick to the inner planets) */}
      <pointLight 
        position={[0, START_Y, 0]} 
        intensity={150.0} 
        color="#ff7733" 
        distance={40} 
        decay={2.0} 
      />

      {/* Milky Way cluster at the bottom right near the footer */}
      <group position={[20, END_Y - 5, -30]}>
        <mesh>
          <sphereGeometry args={[10, 32, 32]} />
          <meshBasicMaterial color="#4466ff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <pointLight intensity={10.0} color="#6688ff" distance={30} decay={2} />
      </group>
      
      {/* Central Alignment Axis Line (Faint glowing core string) */}
      <mesh position={[0, (START_Y + END_Y) / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, Math.abs(START_Y - END_Y) + 4, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>

      <Suspense fallback={null}>
        {SOLAR_DATA.map((planet, i) => (
          <PlanetBody key={planet.name} data={planet} yPos={START_Y - (i * SPACING)} />
        ))}
      </Suspense>
    </group>
  );
}

/* ================================================================== *
 *  Scroll-Driven Helix Group                                          *
 * ================================================================== */
function HelixGroup() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    scroll.current = THREE.MathUtils.lerp(
      scroll.current,
      scroll.target,
      LERP_SPEED
    );

    const p = scroll.current;

    // Spin the helix as user scrolls
    groupRef.current.rotation.y = p * SCROLL_ROT;
    // Lift the helix to bring lower elements up, starting from the offset
    groupRef.current.position.y = INITIAL_Y_OFFSET + p * TOTAL_LIFT;
  });

  return (
    <group ref={groupRef}>
      <SolarSystem />
      {ITEMS.map((item, i) => (
        <ImagePlane key={`ribbon-${i}`} item={item} index={i} />
      ))}
    </group>
  );
}

/* ================================================================== *
 *  HTML Overlay                                                       *
 * ================================================================== */
function Overlay({ active }: { active: boolean }) {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    let raf: number;
    let lastPercentage = -1;
    const update = () => {
      const nextPercentage = Math.round(scroll.current * 100);
      if (nextPercentage !== lastPercentage) {
        lastPercentage = nextPercentage;
        setScrollPct(nextPercentage);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-10">
      <div className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-body text-[10px] uppercase tracking-[0.4em] text-white/30">
            Achievements
          </span>
          <span className="font-display text-sm tracking-[0.2em] text-white/80">
            PHOTO GALLERY
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-px w-24 bg-white/10">
            <div 
              className="h-full bg-blue-400/70" 
              style={{ width: `${scrollPct}%` }} 
            />
          </div>
          <span className="font-body text-xs tabular-nums tracking-widest text-white/40">
            {String(scrollPct).padStart(3, '0')}%
          </span>
        </div>
      </div>

      <div className="flex justify-center pb-4 opacity-50">
        <span className="font-body text-[10px] uppercase tracking-[0.5em] text-white/30 animate-pulse">
          Scroll Down
        </span>
      </div>
    </div>
  );
}

function GalleryPostProcessing() {
  const composerRef = useRef<EffectComposerImpl | null>(null);

  useEffect(() => {
    const composer = composerRef.current;
    return () => composer?.dispose();
  }, []);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      <Bloom luminanceThreshold={1.2} mipmapBlur intensity={1.5} />
      <BrightnessContrast brightness={0.05} contrast={0.3} />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
      <SMAA />
    </EffectComposer>
  );
}

/* ================================================================== *
 *  Main Component                                                     *
 * ================================================================== */
export default function HelixGallery3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [canvasActive, setCanvasActive] = useState(false);
  const quality = useMemo(() => detectQuality(), []);
  const dprMax = useMemo(() => dprFor(quality), [quality]);

  useEffect(() => {
    scroll.target = 0;
    scroll.current = 0;

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scroll.target = self.progress;
      },
    });

    return () => trigger.kill();
  }, []);

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

  useEffect(() => () => {
    GALLERY_TEXTURE_URLS.forEach((url) => useTexture.clear(url));
    disposeRenderer(rendererRef.current);
    rendererRef.current = null;
    scroll.target = 0;
    scroll.current = 0;
  }, []);

  return (
    <section
      ref={containerRef}
      id="helix-gallery"
      className="relative bg-black"
      style={{ height: '500vh' }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: 'black', zIndex: 10 }}
      >
        <Overlay active={canvasActive} />

        <Canvas
          shadows
          dpr={[1, dprMax]}
          frameloop={canvasActive ? 'always' : 'never'}
          camera={{
            position: [0, 2, 16],
            fov: 40,
            near: 0.1,
            far: 300,
          }}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            alpha: false,
          }}
          style={{ position: 'absolute', inset: 0 }}
          onCreated={(state) => {
            rendererRef.current = state.gl;
          }}
        >
          <Suspense fallback={null}>
            <Environment />
            <Skydome />
            <HelixGroup />

            {/* SMAA preserves clean edges without the multi-hundred-MB
                8x multisampled post-processing target. */}
            <GalleryPostProcessing />
          </Suspense>
        </Canvas>
      </div>

      {/* Scrolling Gradient Overlay (Brown -> Transparent -> Brown) */}
      {/* Placed AFTER the sticky container with higher zIndex so planets fade into the fog naturally! */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, #2a0d06 0%, transparent 8%, transparent 92%, #2a0d06 100%)',
          zIndex: 20
        }}
      />
    </section>
  );
}
