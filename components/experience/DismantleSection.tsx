'use client';

/**
 * DismantleSection — The DOM section wrapper that appears at the end
 * of the landing page (before the footer). Contains:
 * - A separate R3F Canvas for the teardown 3D scene
 * - A spatial-UI styled "Dismantle" button
 * - A stage pill showing current teardown phase
 *
 * The teardown animation plays for ~6 seconds total:
 *   0→1 over 3s (teardown) + hold 0.5s + 1→0 over 2.5s (reassemble)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { stageName } from '@/lib/teardownConfig';

// Dynamically import the scene to avoid SSR issues with Three.js
const DismantleScene = dynamic(
  () => import('./DismantleScene').then((m) => ({ default: m.DismantleScene })),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/*  Animation timing constants                                         */
/* ------------------------------------------------------------------ */

const TEARDOWN_DURATION = 3000;   // ms to go from 0 → 1
const HOLD_DURATION = 500;        // ms to hold at 1.0
const REASSEMBLE_DURATION = 2500; // ms to go from 1 → 0
// Total ≈ 6 seconds

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DismantleSection() {
  const progressRef = useRef(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // IntersectionObserver: mount/unmount the canvas as section enters/leaves viewport.
  // This prevents two WebGL contexts from existing simultaneously (hero + dismantle),
  // which can cause "Context Lost" on GPUs with limited WebGL context slots.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { rootMargin: '100px' }, // Start loading slightly before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Dismantle animation handler
  const handleDismantle = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;

      let p: number;
      if (elapsed < TEARDOWN_DURATION) {
        // Phase 1: teardown 0 → 1
        p = elapsed / TEARDOWN_DURATION;
        // Ease out cubic for dramatic start
        p = 1 - Math.pow(1 - p, 3);
      } else if (elapsed < TEARDOWN_DURATION + HOLD_DURATION) {
        // Phase 2: hold at 1.0
        p = 1.0;
      } else if (elapsed < TEARDOWN_DURATION + HOLD_DURATION + REASSEMBLE_DURATION) {
        // Phase 3: reassemble 1 → 0
        const reassembleElapsed = elapsed - TEARDOWN_DURATION - HOLD_DURATION;
        p = 1 - reassembleElapsed / REASSEMBLE_DURATION;
        // Ease in-out for smooth reassembly
        p = p * p * (3 - 2 * p);
      } else {
        // Done
        p = 0;
        progressRef.current = 0;
        setDisplayProgress(0);
        setIsAnimating(false);
        return;
      }

      progressRef.current = Math.max(0, Math.min(1, p));
      setDisplayProgress(Math.round(p * 100));
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [isAnimating]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const currentStage = stageName(progressRef.current);

  return (
    <section
      ref={sectionRef}
      id="dismantle-section"
      className="relative w-full"
      style={{ height: '100vh', minHeight: '600px' }}
    >
      {/* Dark space background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 72%, rgba(170, 67, 16, 0.28), rgba(22, 28, 44, 0.62) 42%, rgba(5, 8, 20, 1) 76%),
            linear-gradient(180deg, #030614 0%, #09111f 58%, #1a0d09 100%)
          `,
        }}
      />

      {/* R3F Canvas for the 3D teardown scene */}
      {isVisible && (
        <div className="absolute inset-0 z-0">
          <Canvas
            shadows={false}
            dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1.5]}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.96,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            camera={{
              position: [5.2, 3.5, 7.0],
              fov: 42,
              near: 0.05,
              far: 200,
            }}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <DismantleScene progressRef={progressRef} />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-16">
        {/* Stage pill */}
        <div className="pointer-events-auto mb-4">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-wide"
            style={{
              background: 'rgba(255, 118, 34, 0.18)',
              color: '#ffd5b5',
              border: '1px solid rgba(255, 118, 34, 0.25)',
            }}
          >
            {isAnimating ? `Stage: ${currentStage}` : 'Ready • Rotate to inspect'}
          </span>
        </div>

        {/* Dismantle button — spatial UI design */}
        <div className="pointer-events-auto">
          <button
            id="dismantle-btn"
            onClick={handleDismantle}
            disabled={isAnimating}
            className="group relative overflow-hidden rounded-2xl px-8 py-4 font-display text-lg font-bold tracking-wide transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed"
            style={{
              background: isAnimating
                ? 'rgba(255, 109, 28, 0.35)'
                : 'rgba(255, 109, 28, 0.92)',
              border: '1px solid rgba(255, 160, 90, 0.62)',
              color: 'white',
              backdropFilter: 'blur(12px)',
              boxShadow: isAnimating
                ? '0 0 30px rgba(255, 109, 28, 0.2), inset 0 0 20px rgba(255, 109, 28, 0.1)'
                : '0 8px 32px rgba(255, 109, 28, 0.35), 0 0 0 1px rgba(255, 160, 90, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            }}
          >
            {/* Animated glow ring */}
            <span
              className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: 'radial-gradient(circle at center, rgba(255, 138, 77, 0.25) 0%, transparent 70%)',
              }}
            />

            {/* Progress bar background during animation */}
            {isAnimating && (
              <span
                className="absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-100"
                style={{
                  width: `${displayProgress}%`,
                  background: 'linear-gradient(90deg, #ff7622, #ffb27c)',
                }}
              />
            )}

            <span className="relative z-10 flex items-center gap-3">
              {/* Icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-500 ${isAnimating ? 'animate-spin' : 'group-hover:rotate-45'}`}
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>

              {isAnimating ? 'Dismantling...' : 'Dismantle'}
            </span>
          </button>
        </div>

        {/* Subtle hint text */}
        <p className="mt-3 text-xs text-white/50">
          {isAnimating
            ? `${displayProgress}% — subsystem-by-subsystem separation`
            : 'Click to trigger a 6-second semantic teardown'}
        </p>
      </div>

      {/* Section title — top area */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-center pt-10">
        <div
          className="rounded-2xl px-6 py-4 text-center"
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <p className="mb-1 text-xs uppercase tracking-[0.4em] text-orange-300/80">
            Spatial UI Designer
          </p>
          <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
            Rover Teardown
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Explore the rover from any angle • Dismantle by subsystem
          </p>
        </div>
      </div>
    </section>
  );
}
