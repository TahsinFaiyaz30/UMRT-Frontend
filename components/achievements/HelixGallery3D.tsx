'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
  image: string | null;
}

// Base 8 items
const BASE_ITEMS: GalleryItem[] = [
  { year: '2025', title: 'URC TOP 5', image: null },
  { year: '2024', title: 'INNOVATION', image: null },
  { year: '2024', title: 'URC TOP 10', image: null },
  { year: '2023', title: 'ERC POLAND', image: null },
  { year: '2022', title: 'BEST ROOKIE', image: null },
  { year: '2022', title: 'URC QUAL', image: null },
  { year: '2021', title: 'PROTOTYPE', image: null },
  { year: '2020', title: 'FOUNDED', image: null },
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
const SCROLL_ROT       = -((N - 1) / N) * HELIX_ANGLE; // Exact rotation to bring last item to front
const INITIAL_Y_OFFSET = -6.0;                         // Exact offset to center first item at y=2
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
    // Fog matches the bg-mars-900 color (#180804) so items fade out naturally
    scene.fog = new THREE.FogExp2('#180804', 0.03);
    // Background is null to let the DOM background show through
    scene.background = null;
  }, [scene]);

  return (
    <>
      <directionalLight position={[10, 20, 10]} intensity={1.5} color="#dbe5ff" />
      <ambientLight intensity={0.4} color="#a0b0d0" />
    </>
  );
}

/* ================================================================== *
 *  Floor Grid (to match the reference image's visual grounding)       *
 * ================================================================== */
function FloorGrid() {
  return (
    <gridHelper 
      args={[40, 40, '#ff8a4d', '#ff8a4d']} 
      position={[0, -TOTAL_Y_DROP / 2 - 2, 0]} 
      material-opacity={0.05} 
      material-transparent 
    />
  );
}

/* ================================================================== *
 *  Image Plane — Tangent to the cylinder surface                      *
 *                                                                     *
 *  In the reference image, the planes form a continuous ribbon.       *
 *  rotation.y = Math.atan2(x, z) makes them face directly outward.    *
 * ================================================================== */
function ImagePlane({ item, index }: { item: GalleryItem; index: number }) {
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
      {/* ── Main Image Box (Glassy Mars Theme) ── */}
      <mesh>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial 
          color="#2a0d06" // Dark reddish-brown
          roughness={0.2}
          metalness={0.5}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
        {/* Safe Edges component from Drei */}
        <Edges scale={1} color="#ff8a4d" />
      </mesh>

      {/* ── Text Content via DOM (Prevents WebGL Context Crashes) ── */}
      <Html
        transform
        position={[0, 0, 0.02]}
        center
        scale={0.01} // scale down the DOM exact pixels to WebGL units
        occlude="blending"
        className="pointer-events-none flex flex-col justify-end p-6"
        style={{ width: '400px', height: '250px' }} // Maps to CARD_W=4.0 and CARD_H=2.5
      >
        {/* Blank Image Placeholder */}
        <div className="absolute inset-0 m-3 rounded border border-white/10 bg-white/5 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] backdrop-blur-sm" />
        
        {/* Content Container */}
        <div className="relative z-10 px-4 pb-2 text-left">
          <span className="font-display text-5xl font-bold tracking-widest text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            {item.year}
          </span>
          <p className="mt-3 font-body text-base font-medium leading-relaxed tracking-wider text-mars-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {item.title} — This is a description placeholder for the picture. You can add more context about the achievement here without zooming.
          </p>
        </div>
      </Html>
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
      {ITEMS.map((item, i) => (
        <ImagePlane key={`ribbon-${i}`} item={item} index={i} />
      ))}
    </group>
  );
}

/* ================================================================== *
 *  HTML Overlay                                                       *
 * ================================================================== */
function Overlay() {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    let raf: number;
    const update = () => {
      setScrollPct(Math.round(scroll.current * 100));
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

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

/* ================================================================== *
 *  Main Component                                                     *
 * ================================================================== */
export default function HelixGallery3D() {
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <section
      ref={containerRef}
      id="helix-gallery"
      className="relative"
      style={{ height: '500vh' }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: 'transparent' }}
      >
        <Overlay />

        <Canvas
          camera={{
            position: [0, 2, 16],
            fov: 40,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            alpha: true, // Allow transparent background
          }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Environment />
          <FloorGrid />
          <HelixGroup />
        </Canvas>
      </div>
    </section>
  );
}
