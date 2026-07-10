'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { SceneCanvas } from './SceneCanvas';
import { HeroOverlay } from './HeroOverlay';
import { Footer } from './Footer';
import { PremiumNavbar } from '@/components/navbar';
import { TeardownOverlay } from './TeardownOverlay';
import { MissionLoader } from './MissionLoader';
import { getReducedMotion } from '@/lib/performance';
import { phases } from '@/lib/scrollTimeline';

const MANUAL_TEARDOWN_DURATION = 6.4;
const FREE_EXPLORE_START = phases[phases.length - 1].start;
const AUTO_TEARDOWN_START = 0.755;
const AUTO_TEARDOWN_PEAK = 0.82;
const AUTO_TEARDOWN_HOLD = 0.855;
const AUTO_TEARDOWN_END = FREE_EXPLORE_START;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export default function MarsExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const lastUiProgressRef = useRef(-1);
  const [uiProgress, setUiProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [freeExplore, setFreeExplore] = useState(false);
  const [showDismantleButton, setShowDismantleButton] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);

  const dismantleProgressRef = useRef(0);
  const dismantleTimelineRef = useRef(0);
  const [manualDismantle, setManualDismantle] = useState(false);
  const [autoDismantle, setAutoDismantle] = useState(false);
  const [scrubDismantle, setScrubDismantle] = useState(0);
  const scrubDismantleRef = useRef(0);
  const manualDismantleRef = useRef(false);
  const dismantleStartRef = useRef<number | null>(null);
  const dismantleRafRef = useRef(0);

  const triggerDismantle = useCallback(() => {
    if (manualDismantleRef.current) return;
    scrubDismantleRef.current = 0;
    setScrubDismantle(0);
    manualDismantleRef.current = true;
    setManualDismantle(true);
    dismantleStartRef.current = null;

    const tick = (now: number) => {
      if (dismantleStartRef.current === null) dismantleStartRef.current = now;
      const elapsed = (now - dismantleStartRef.current) / 1000;
      const explodeEnd = 2.15;
      const holdEnd = 3.7;

      dismantleTimelineRef.current = clamp(elapsed / MANUAL_TEARDOWN_DURATION);
      dismantleProgressRef.current =
        elapsed < explodeEnd
          ? smooth(elapsed / explodeEnd)
          : elapsed < holdEnd
            ? 1
            : 1 - smooth((elapsed - holdEnd) / (MANUAL_TEARDOWN_DURATION - holdEnd));

      if (elapsed < MANUAL_TEARDOWN_DURATION) {
        dismantleRafRef.current = requestAnimationFrame(tick);
        return;
      }

      dismantleProgressRef.current = 0;
      dismantleTimelineRef.current = 0;
      dismantleStartRef.current = null;
      manualDismantleRef.current = false;
      setManualDismantle(false);
    };

    dismantleRafRef.current = requestAnimationFrame(tick);
  }, []);

  const completeLoader = useCallback(() => setLoaderVisible(false), []);

  const syncScrollProgress = useCallback(() => {
    const footerTop = document.querySelector<HTMLElement>('[data-page-footer]')?.offsetTop;
    const heroEnd = footerTop ?? document.documentElement.scrollHeight;
    const scrollable = Math.max(1, heroEnd - window.innerHeight);
    const progress = clamp(window.scrollY / scrollable);
    progressRef.current = progress;

    if (Math.abs(progress - lastUiProgressRef.current) >= 0.0025) {
      lastUiProgressRef.current = progress;
      setUiProgress(progress);
    }

    const explore = progress >= FREE_EXPLORE_START;
    setFreeExplore((current) => (current === explore ? current : explore));
    setShowDismantleButton(explore && progress < 0.988);

    if (!manualDismantleRef.current) {
      const automatic = progress >= AUTO_TEARDOWN_START && progress < AUTO_TEARDOWN_END;
      setAutoDismantle((current) => (current === automatic ? current : automatic));

      if (automatic) {
        dismantleTimelineRef.current = clamp(
          (progress - AUTO_TEARDOWN_START) / (AUTO_TEARDOWN_END - AUTO_TEARDOWN_START),
        );
        dismantleProgressRef.current =
          progress < AUTO_TEARDOWN_PEAK
            ? smooth((progress - AUTO_TEARDOWN_START) / (AUTO_TEARDOWN_PEAK - AUTO_TEARDOWN_START))
            : progress < AUTO_TEARDOWN_HOLD
              ? 1
              : 1 - smooth((progress - AUTO_TEARDOWN_HOLD) / (AUTO_TEARDOWN_END - AUTO_TEARDOWN_HOLD));
      } else if (progress >= FREE_EXPLORE_START) {
        dismantleProgressRef.current = scrubDismantleRef.current;
        dismantleTimelineRef.current = scrubDismantleRef.current > 0 ? 0.5 : 0;
      } else {
        dismantleProgressRef.current = 0;
        dismantleTimelineRef.current = 0;
      }
    }
  }, []);

  useEffect(() => {
    syncScrollProgress();
    window.addEventListener('scroll', syncScrollProgress, { passive: true });
    window.addEventListener('resize', syncScrollProgress);
    return () => {
      window.removeEventListener('scroll', syncScrollProgress);
      window.removeEventListener('resize', syncScrollProgress);
    };
  }, [syncScrollProgress]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      const y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      pointerRef.current.x += (x - pointerRef.current.x) * 0.28;
      pointerRef.current.y += (y - pointerRef.current.y) * 0.28;
      rootRef.current?.style.setProperty('--pointer-x', pointerRef.current.x.toFixed(3));
      rootRef.current?.style.setProperty('--pointer-y', pointerRef.current.y.toFixed(3));
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  const scrubTeardown = useCallback((value: number) => {
    if (manualDismantleRef.current) return;
    const progress = clamp(value);
    scrubDismantleRef.current = progress;
    dismantleProgressRef.current = progress;
    dismantleTimelineRef.current = progress > 0 ? 0.5 : 0;
    setScrubDismantle(progress);
  }, []);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) setNoWebGL(true);
    } catch {
      setNoWebGL(true);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(getReducedMotion() || (media?.matches ?? false));
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || loaderVisible) return undefined;
    const lenis = new Lenis({
      duration: 1.05,
      easing: (value: number) => Math.min(1, 1.001 - Math.pow(2, -10 * value)),
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.12,
    });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    lenis.on('scroll', syncScrollProgress);
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [loaderVisible, reduceMotion, syncScrollProgress]);

  useEffect(() => {
    if (!manualDismantle) return undefined;
    const lockedY = window.scrollY;
    let frame = 0;
    const lock = () => {
      if (Math.abs(window.scrollY - lockedY) > 0.5) window.scrollTo(0, lockedY);
      frame = requestAnimationFrame(lock);
    };
    frame = requestAnimationFrame(lock);
    return () => cancelAnimationFrame(frame);
  }, [manualDismantle]);

  useEffect(() => {
    const shell = rootRef.current?.querySelector<HTMLElement>('.mission-canvas');
    if (!shell) return undefined;
    const keepWheelInLab = (event: WheelEvent) => {
      const progress = progressRef.current;
      if (progress >= 0.952 && progress < 0.988) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    shell.addEventListener('wheel', keepWheelInLab, { passive: false });
    return () => shell.removeEventListener('wheel', keepWheelInLab);
  }, []);

  useEffect(() => () => cancelAnimationFrame(dismantleRafRef.current), []);

  if (noWebGL) {
    return (
      <main className="page-pre-paint grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="mission-kicker justify-center">UIU MARS ROVER TEAM</p>
          <h1 className="mt-6 font-display text-6xl font-semibold tracking-[-0.07em] sm:text-8xl">BUILT BEYOND EARTH</h1>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-white/60">This mission needs WebGL. Open it in a modern browser with hardware acceleration to enter the 3D rover experience.</p>
        </div>
      </main>
    );
  }

  const dismantleActive = manualDismantle || autoDismantle || scrubDismantle > 0;

  return (
    <div ref={rootRef} className="mission-experience">
      {loaderVisible && <MissionLoader ready={sceneReady} onComplete={completeLoader} />}
      <PremiumNavbar />

      <div className={`mission-canvas ${freeExplore ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <SceneCanvas
          progressRef={progressRef}
          pointerRef={pointerRef}
          reduceMotion={reduceMotion}
          dismantleProgressRef={dismantleProgressRef}
          dismantleTimelineRef={dismantleTimelineRef}
          dismantleActive={dismantleActive}
          onReady={() => setSceneReady(true)}
        />
      </div>

      <HeroOverlay progress={uiProgress} />

      <TeardownOverlay
        visible={showDismantleButton}
        playing={manualDismantle}
        progress={scrubDismantle}
        onScrub={scrubTeardown}
        onTrigger={triggerDismantle}
      />

      <Footer data-page-footer />
    </div>
  );
}
