'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { HeroOverlay, sectionMeta, type SectionId } from './HeroOverlay';
import { Footer } from './Footer';
import { PremiumNavbar } from '@/components/navbar';
import { TeardownOverlay } from './TeardownOverlay';
import { detectQuality, getReducedMotion } from '@/lib/performance';
import { phases } from '@/lib/scrollTimeline';

/**
 * Length of the teardown animation in seconds.
 * 3 s explode out + 3 s reassemble back to the original form.
 */
const TEARDOWN_DURATION_S = 6;

// NOTE: Lenis, gsap, and ScrollTrigger are imported lazily inside the
// first-interaction effect below so they don't initialise during the
// dynamic import() of this component (which would compete with first
// paint). ScrollTrigger is only registered right before the first
// ScrollTrigger call inside the boot function.

/** Threshold for entering free-explore mode (last phase start). */
const FREE_EXPLORE_START = phases[phases.length - 1].start;

/**
 * Threshold just before the footer section begins scrolling into view.
 * Scroll progress is measured only across the Mars hero/explore area,
 * so 1.0 means the footer is about to enter the viewport.
 */
const FOOTER_START = 0.985;

/**
 * Top-level client component for the Mars landing experience.
 *
 * - Boots Lenis smooth scroll and syncs it with GSAP ScrollTrigger.
 * - Feeds normalized progress (0..1) to the 3D canvas.
 * - Renders the DOM overlay (sections, footer, hint, teardown button).
 * - Unlocks free pan/zoom/rotate on the 3D model at the end of scroll.
 *
 * NO staged loading: the WebGL Canvas mounts immediately when this
 * component runs. The canvas's <Suspense> fallback paints the same
 * clear colour as the live scene, so the page appears fully loaded
 * before the GLB finishes parsing. The teardown button only becomes
 * interactable after the user reaches the free-explore phase.
 */
export default function MarsExperience() {
  const progressRef = useRef(0);
  const [uiProgress, setUiProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [freeExplore, setFreeExplore] = useState(false);
  const [showDismantleButton, setShowDismantleButton] = useState(false);
  const lastUiProgressRef = useRef(-1);

  // -------- Teardown (Rover Teardown button) state --------
  const dismantleProgressRef = useRef(0);
  const dismantleTimelineRef = useRef(0);
  const [dismantleActive, setDismantleActive] = useState(false);
  const dismantleStartRef = useRef<number | null>(null);
  const dismantleRafRef = useRef<number>(0);

  const triggerDismantle = useCallback(() => {
    if (dismantleActive) return;
    setDismantleActive(true);
    dismantleStartRef.current = null;
    const tick = (now: number) => {
      if (dismantleStartRef.current === null) {
        dismantleStartRef.current = now;
      }
      const start = dismantleStartRef.current;
      const elapsed = (now - start) / 1000;
      const half = TEARDOWN_DURATION_S / 2;
      dismantleTimelineRef.current = Math.min(1, elapsed / TEARDOWN_DURATION_S);
      const phase =
        elapsed < half
          ? Math.sin((elapsed / half) * Math.PI / 2)
          : Math.max(0, Math.cos(((elapsed - half) / half) * Math.PI / 2));
      dismantleProgressRef.current = phase;

      if (elapsed < TEARDOWN_DURATION_S) {
        dismantleRafRef.current = requestAnimationFrame(tick);
      } else {
        dismantleProgressRef.current = 0;
        dismantleTimelineRef.current = 0;
        dismantleStartRef.current = null;
        setDismantleActive(false);
      }
    };
    dismantleRafRef.current = requestAnimationFrame(tick);
  }, [dismantleActive]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(dismantleRafRef.current);
    };
  }, []);

  const syncScrollProgress = useCallback(() => {
    const footerTop = document.querySelector<HTMLElement>('[data-page-footer]')?.offsetTop;
    const heroEnd = footerTop ?? document.documentElement.scrollHeight;
    const h = heroEnd - window.innerHeight;
    const p = h > 0 ? window.scrollY / h : 0;
    const clamped = Math.max(0, Math.min(1, p));

    progressRef.current = clamped;

    if (Math.abs(clamped - lastUiProgressRef.current) >= 0.005) {
      lastUiProgressRef.current = clamped;
      setUiProgress(clamped);
    }

    const shouldExplore = clamped >= FREE_EXPLORE_START;
    setFreeExplore((prev) => (prev !== shouldExplore ? shouldExplore : prev));

    const shouldShowButton = shouldExplore && clamped < FOOTER_START;
    setShowDismantleButton((prev) => (prev !== shouldShowButton ? shouldShowButton : prev));
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

  // Pin scroll during teardown so Lenis/OrbitControls can't push the
  // page back to the top while the animation is playing.
  const pinnedScrollYRef = useRef<number | null>(null);
  useEffect(() => {
    if (!dismantleActive) {
      pinnedScrollYRef.current = null;
      return undefined;
    }
    pinnedScrollYRef.current = window.scrollY;
    let raf = 0;
    const lock = () => {
      const target = pinnedScrollYRef.current ?? window.scrollY;
      if (Math.abs(window.scrollY - target) > 0.5) {
        window.scrollTo({ top: target, behavior: 'auto' });
      }
      raf = requestAnimationFrame(lock);
    };
    raf = requestAnimationFrame(lock);
    return () => {
      cancelAnimationFrame(raf);
      pinnedScrollYRef.current = null;
    };
  }, [dismantleActive]);

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

  // Reduced-motion preference.
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(getReducedMotion() || (m?.matches ?? false));
    apply();
    m?.addEventListener?.('change', apply);
    return () => m?.removeEventListener?.('change', apply);
  }, []);

  // Lenis + ScrollTrigger sync — DEFERRED until first user interaction
  // so we never compete with first paint. The 3D Canvas still mounts
  // immediately; only the smooth-scroll rAF loop is delayed.
  useEffect(() => {
    if (reduceMotion) return undefined;

    let rafId = 0;
    type LenisInstance = {
      raf: (t: number) => void;
      on: (event: 'scroll', cb: () => void) => void;
      destroy: () => void;
    };
    let lenis: LenisInstance | null = null;
    let mounted = true;
    let booted = false;
    let pendingBoot: number | null = null;

    const boot = async () => {
      if (booted || !mounted) return;
      booted = true;
      window.removeEventListener('scroll', onInteract);
      window.removeEventListener('wheel', onInteract);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      window.removeEventListener('touchstart', onInteract);

      const [{ default: LenisMod }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (!mounted) return;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new LenisMod({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);

      const onScroll = () => {
        ScrollTrigger.update();
        syncScrollProgress();
      };
      lenis.on('scroll', onScroll);

      requestAnimationFrame(() => ScrollTrigger.refresh());
    };

    const onInteract = () => {
      if (booted) return;
      if (pendingBoot !== null) return;
      pendingBoot = window.requestAnimationFrame(() => {
        pendingBoot = null;
        void boot();
      });
    };

    window.addEventListener('scroll', onInteract, { once: true, passive: true });
    window.addEventListener('wheel', onInteract, { once: true, passive: true });
    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    window.addEventListener('touchstart', onInteract, { once: true, passive: true });
    window.addEventListener('keydown', onInteract, { once: true });

    return () => {
      mounted = false;
      window.removeEventListener('scroll', onInteract);
      window.removeEventListener('wheel', onInteract);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('touchstart', onInteract);
      window.removeEventListener('keydown', onInteract);
      if (pendingBoot !== null) cancelAnimationFrame(pendingBoot);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, [reduceMotion, syncScrollProgress]);

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
    <>
      {/* ROOT: a single stacking context that owns the Canvas, the
          hero overlay sections, and the Footer. Making this root
          `relative isolate` lets the Footer's `z-10` reliably stack
          above the fixed Canvas wrapper inside the same context —
          otherwise the fixed Canvas paints on top because fixed
          elements live in the page-level stacking context by default. */}
      <div className="relative isolate w-full bg-mars-900 text-mars-50">
        {/* Premium navigation bar — fixed at top, z-50 floats above
            everything else inside this stacking context. */}
        <PremiumNavbar />

        {/* Quality badge for devs. Positioned below the navbar (top-20)
            so it doesn't overlap the fixed nav bar. */}
        <div className="pointer-events-none fixed left-4 top-20 z-30 rounded-full bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-mars-200/80 backdrop-blur">
          Quality: {detectQuality()}
        </div>

        {/* Canvas: full-viewport, fixed inside the same stacking
            context as the overlay + footer. Stays at z-0 so all DOM
            siblings in this root (overlay sections, footer) can stack
            above it. It is `pointer-events-none` while the user is
            being driven by scroll, and `pointer-events-auto` once
            free-explore unlocks so OrbitControls can drag on it. */}
        <div
          className={`fixed inset-0 z-0 ${
            freeExplore ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <SceneCanvas
            progressRef={progressRef}
            reduceMotion={reduceMotion}
            dismantleProgressRef={dismantleProgressRef}
            dismantleTimelineRef={dismantleTimelineRef}
            dismantleActive={dismantleActive}
          />
        </div>

        {/* DOM overlay: scroll-driving sections in document flow */}
        <HeroOverlay loading={false} progress={uiProgress} />

        {/* Section markers used as ScrollTrigger anchors */}
        {sectionMeta.map((s) => (
          <span key={s.id} id={`anchor-${s.id}`} data-phase={s.id satisfies SectionId} className="block h-0 w-0" />
        ))}

        {/* Rover Teardown button. Fixed bottom-center, sits inside
            this root's stacking context at z-20 so it overlays the
            canvas but stays BELOW the Footer. */}
        <TeardownOverlay
          visible={showDismantleButton}
          playing={dismantleActive}
          onTrigger={triggerDismantle}
        />

        {/* Footer: Earth + starfield backdrop + three columns +
            "Meet Our Webmasters" CTA. `relative z-10` inside the
            SAME stacking context as the canvas, so the Footer's
            opaque black background reliably covers the canvas when
            the user scrolls past the free-explore panel. */}
        <Footer data-page-footer />
      </div>
    </>
  );
}
