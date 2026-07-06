'use client';

import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SceneCanvas } from './SceneCanvas';
import { HeroOverlay, sectionMeta, type SectionId } from './HeroOverlay';
import { LoadingCanvasShell } from './LoadingCanvasShell';
import { detectQuality, getReducedMotion } from '@/lib/performance';
import { phases } from '@/lib/scrollTimeline';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/** Threshold for entering free-explore mode (last phase start). */
const FREE_EXPLORE_START = phases[phases.length - 1].start;

/**
 * Schedule work after the browser has had a chance to paint the initial
 * frame. Falls back to setTimeout when `requestIdleCallback` is missing
 * (older Safari). Caps the delay so we never wait forever.
 */
function whenIdle(cb: () => void, timeout = 250) {
  if (typeof window === 'undefined') return;
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(cb, { timeout });
  } else {
    window.setTimeout(cb, Math.min(timeout, 50));
  }
}

/**
 * Top-level client component for the Mars landing experience.
 * - Boots Lenis smooth scroll and syncs it with GSAP ScrollTrigger.
 * - Triggers @react-three/drei <Preload> via the ScrollTrigger timeline
 *   and feeds normalized progress (0..1) to the 3D canvas.
 * - Renders the DOM overlay (sections, loading UI, hint).
 * - Unlocks free pan/zoom/rotate on the 3D model at the end of scroll.
 */
export default function MarsExperience() {
  const progressRef = useRef(0);
  const [uiProgress, setUiProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [freeExplore, setFreeExplore] = useState(false);
  // Defer mounting the WebGL Canvas until the browser has painted the
  // DOM shell and gone idle. This is the key change that prevents the
  // "page isn't responding" warning at startup.
  const [canvasReady, setCanvasReady] = useState(false);

  // Probe for WebGL support — degrade to a static hero if missing.
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setNoWebGL(true);
    } catch {
      setNoWebGL(true);
    }
  }, []);

  // Schedule the canvas mount for after first paint + idle time.
  useEffect(() => {
    whenIdle(() => setCanvasReady(true), 400);
  }, []);

  // Reduced-motion preference (also re-checked inside SceneCanvas).
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(getReducedMotion() || (m?.matches ?? false));
    apply();
    m?.addEventListener?.('change', apply);
    return () => m?.removeEventListener?.('change', apply);
  }, []);

  // Lenis + ScrollTrigger sync.
  useEffect(() => {
    if (reduceMotion) return undefined;

    // Defer one frame so layout is stable before we boot Lenis and
    // register ScrollTrigger. This avoids an early forced reflow on
    // the first paint, which was a contributor to long tasks.
    let rafId = 0;
    let lenis: Lenis | null = null;
    let mounted = true;

    const boot = () => {
      if (!mounted) return;
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);

      // Throttle React state updates: we mutate progressRef freely (every
      // frame for the 3D scene) but only call setState when the visible
      // progress changes by ≥0.5% — that keeps React from re-rendering
      // HeroOverlay on every scroll tick.
      let lastUi = -1;
      const onScroll = () => {
        ScrollTrigger.update();
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const p = h > 0 ? window.scrollY / h : 0;
        const clamped = Math.max(0, Math.min(1, p));
        progressRef.current = clamped;

        if (Math.abs(clamped - lastUi) >= 0.005) {
          lastUi = clamped;
          setUiProgress(clamped);
        }

        // Toggle free-explore mode when we reach the final phase.
        const shouldExplore = clamped >= FREE_EXPLORE_START;
        setFreeExplore((prev) => (prev !== shouldExplore ? shouldExplore : prev));
      };
      // Lenis already dispatches scroll events; no need for a second listener.
      lenis.on('scroll', onScroll);

      // Initialise ScrollTrigger after layout
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };

    const handle = requestAnimationFrame(boot);

    return () => {
      mounted = false;
      cancelAnimationFrame(handle);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, [reduceMotion]);

  // -------------------------------------------------------------------
  if (noWebGL) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-mars-900 text-mars-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#b8431b_0%,#2f0f06_60%,#180804_100%)]" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-7xl tracking-tight md:text-9xl">MISSION MARS</h1>
          <p className="mt-6 max-w-xl text-mars-100/80">
            Your browser does not support WebGL. We still want you to see the mission —
            here&apos;s the static experience.
          </p>
          <p className="mt-2 text-sm text-mars-200/60">UMRT // Mars Rover</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-mars-900 text-mars-50">
      {/* Quality badge for devs; also serves as a header. */}
      <div className="pointer-events-none fixed left-4 top-4 z-20 rounded-full bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mars-200/80 backdrop-blur">
        Quality: {detectQuality()}
      </div>

      {/* Canvas: full-viewport background, fixed to viewport.
          pointer-events are enabled in free-explore mode so OrbitControls
          can receive mouse/touch input for pan, rotate, and zoom.
          We render the lightweight loading scene first and only swap in
          the heavy Canvas after the browser goes idle — this keeps the
          first paint cheap and prevents the "page isn't responding"
          warning while still showing the animated rover. */}
      <div
        className={`fixed inset-0 ${freeExplore ? 'z-30' : 'z-0 pointer-events-none'}`}
      >
        {canvasReady ? (
          <SceneCanvas progressRef={progressRef} reduceMotion={reduceMotion} />
        ) : (
          <LoadingCanvasShell />
        )}
      </div>

      {/* DOM overlay: scroll-driving sections in document flow */}
      <HeroOverlay loading={!canvasReady} progress={uiProgress} />

      {/* Section markers used as ScrollTrigger anchors */}
      {sectionMeta.map((s) => (
        <span key={s.id} id={`anchor-${s.id}`} data-phase={s.id satisfies SectionId} className="block h-0 w-0" />
      ))}
    </div>
  );
}
