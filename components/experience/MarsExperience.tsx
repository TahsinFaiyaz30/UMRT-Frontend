'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { SceneCanvas } from './SceneCanvas';
import { HeroOverlay } from './HeroOverlay';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';
import { TeardownOverlay } from './TeardownOverlay';
import { MissionLoader } from './MissionLoader';
import { SolarCalibrationPanel } from './SolarCalibrationPanel';
import { getReducedMotion } from '@/lib/performance';
import { phases } from '@/lib/scrollTimeline';

const MANUAL_TEARDOWN_DURATION = 6.4;
const FREE_EXPLORE_START = phases[phases.length - 1].start;
const AUTO_TEARDOWN_START = 0.755;
const AUTO_TEARDOWN_PEAK = 0.82;
const AUTO_TEARDOWN_HOLD = 0.855;
const AUTO_TEARDOWN_END = FREE_EXPLORE_START;
// About three CSS pixels on the current mission length. This retains React's
// no-op filtering at the end of Lenis' sub-pixel tail without reducing active
// overlay motion to an observable half-rate cadence.
const UI_PROGRESS_EPSILON = 0.00025;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export default function MarsExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const lastUiProgressRef = useRef(-1);
  const scrollableDistanceRef = useRef(1);
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

  const resetMissionToTop = useCallback(() => {
    cancelAnimationFrame(dismantleRafRef.current);
    dismantleRafRef.current = 0;
    dismantleStartRef.current = null;
    manualDismantleRef.current = false;
    dismantleProgressRef.current = 0;
    dismantleTimelineRef.current = 0;
    scrubDismantleRef.current = 0;
    progressRef.current = 0;
    lastUiProgressRef.current = 0;
    pointerRef.current.x = 0;
    pointerRef.current.y = 0;

    setUiProgress(0);
    setFreeExplore(false);
    setShowDismantleButton(false);
    setManualDismantle(false);
    setAutoDismantle(false);
    setScrubDismantle(0);

    const root = rootRef.current;
    const atmosphere = root?.querySelector<HTMLElement>('.mission-atmosphere');
    atmosphere?.style.setProperty('--pointer-x', '0');
    atmosphere?.style.setProperty('--pointer-y', '0');
    cursorRef.current?.style.setProperty('--cursor-x', '50vw');
    cursorRef.current?.style.setProperty('--cursor-y', '50vh');
    root?.removeAttribute('data-cursor-active');
    root?.removeAttribute('data-cursor-pressed');

    if (window.scrollX !== 0 || window.scrollY !== 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  // A Next.js route transition can carry the previous page's document scroll
  // into Home. That stale Y value used to reach syncScrollProgress first,
  // putting the camera, hero copy, teardown state, and controls into a later
  // mission phase. Reset before paint for plain `/` visits. Explicit
  // `/#section` links remain valid and keep their intended anchor position.
  useLayoutEffect(() => {
    if (window.location.hash) return undefined;

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    let frame = 0;

    const restoreInitialMission = () => {
      if (window.location.pathname !== '/' || window.location.hash) return;
      resetMissionToTop();
    };

    restoreInitialMission();
    frame = window.requestAnimationFrame(restoreInitialMission);
    window.addEventListener('pageshow', restoreInitialMission);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pageshow', restoreInitialMission);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [resetMissionToTop]);

  // Browser/Next scroll restoration can run after the page mounts. Correct a
  // stale position when its scroll event arrives instead of repeating the full
  // mission reset on every display frame while the loading curtain is visible.
  useEffect(() => {
    if (!loaderVisible || window.location.hash) return undefined;
    const holdInitialScroll = () => {
      if (window.location.pathname !== '/' || window.location.hash) return;
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };
    holdInitialScroll();
    window.addEventListener('scroll', holdInitialScroll, { passive: true });
    return () => window.removeEventListener('scroll', holdInitialScroll);
  }, [loaderVisible]);

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

  const measureScrollableDistance = useCallback(() => {
    const footerTop = rootRef.current?.querySelector<HTMLElement>('[data-page-footer]')?.offsetTop;
    const heroEnd = footerTop ?? document.documentElement.scrollHeight;
    scrollableDistanceRef.current = Math.max(1, heroEnd - window.innerHeight);
  }, []);

  const syncScrollProgress = useCallback(() => {
    const progress = clamp(window.scrollY / scrollableDistanceRef.current);
    progressRef.current = progress;

    if (Math.abs(progress - lastUiProgressRef.current) >= UI_PROGRESS_EPSILON) {
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
    measureScrollableDistance();
    syncScrollProgress();
    let measureFrame = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(measureFrame);
      measureFrame = window.requestAnimationFrame(() => {
        measureScrollableDistance();
        syncScrollProgress();
      });
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleResize);
    if (rootRef.current) resizeObserver?.observe(rootRef.current);
    window.addEventListener('scroll', syncScrollProgress, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(measureFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', syncScrollProgress);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureScrollableDistance, syncScrollProgress]);

  useEffect(() => {
    let pointerUiFrame = 0;
    let latestClientX = 0;
    let latestClientY = 0;
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const atmosphere = root?.querySelector<HTMLElement>('.mission-atmosphere');

    const flushPointerUi = () => {
      pointerUiFrame = 0;
      if (!root || !cursor || !atmosphere) return;
      // Keep high-frequency custom properties on the three elements that
      // consume them. Writing inherited variables on the experience root
      // invalidated styles for the entire page on every pointer frame.
      atmosphere.style.setProperty('--pointer-x', pointerRef.current.x.toFixed(3));
      atmosphere.style.setProperty('--pointer-y', pointerRef.current.y.toFixed(3));
      cursor.style.setProperty('--cursor-x', `${latestClientX}px`);
      cursor.style.setProperty('--cursor-y', `${latestClientY}px`);
      if (!root.hasAttribute('data-cursor-active')) {
        root.setAttribute('data-cursor-active', 'true');
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      const y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      pointerRef.current.x += (x - pointerRef.current.x) * 0.28;
      pointerRef.current.y += (y - pointerRef.current.y) * 0.28;
      latestClientX = event.clientX;
      latestClientY = event.clientY;
      if (!pointerUiFrame) pointerUiFrame = window.requestAnimationFrame(flushPointerUi);
    };
    const onPointerLeave = () => {
      if (pointerUiFrame) {
        window.cancelAnimationFrame(pointerUiFrame);
        pointerUiFrame = 0;
      }
      root?.removeAttribute('data-cursor-active');
      root?.removeAttribute('data-cursor-pressed');
    };
    const onPointerDown = () => root?.setAttribute('data-cursor-pressed', 'true');
    const onPointerUp = () => root?.removeAttribute('data-cursor-pressed');
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerLeave, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    return () => {
      if (pointerUiFrame) window.cancelAnimationFrame(pointerUiFrame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
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
      else gl.getExtension('WEBGL_lose_context')?.loseContext();
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
    let activeUntil = performance.now() + 120;

    const wake = () => {
      activeUntil = performance.now() + 120;
      if (!frame && !document.hidden) frame = requestAnimationFrame(raf);
    };

    const raf = (time: number) => {
      frame = 0;
      if (document.hidden) return;
      lenis.raf(time);
      const targetDistance = Math.abs(lenis.targetScroll - lenis.animatedScroll);
      if (
        lenis.isScrolling !== false
        || targetDistance > 0.05
        || Math.abs(lenis.velocity) > 0.01
        || time < activeUntil
      ) {
        frame = requestAnimationFrame(raf);
      }
    };

    const stopVirtualScrollListener = lenis.on('virtual-scroll', wake);
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        wake();
      }
    };

    window.addEventListener('scroll', wake, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    wake();

    return () => {
      cancelAnimationFrame(frame);
      stopVirtualScrollListener();
      window.removeEventListener('scroll', wake);
      document.removeEventListener('visibilitychange', handleVisibility);
      lenis.destroy();
    };
  }, [loaderVisible, reduceMotion]);

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
      <div ref={cursorRef} className="mission-custom-cursor" aria-hidden="true"><i /><b /><span>SURFACE / TRACE</span></div>
      {loaderVisible && <MissionLoader ready={sceneReady} onComplete={completeLoader} />}
      <PremiumNavbar />
      {!loaderVisible && <SolarCalibrationPanel />}

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

      <SiteFooter data-page-footer />
    </div>
  );
}
