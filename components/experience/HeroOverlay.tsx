'use client';

import { useEffect, useRef } from 'react';

export type SectionId =
  | 'hero_intro'
  | 'zoom_in'
  | 'full_model_reveal'
  | 'part_focus_1'
  | 'part_focus_2_left'
  | 'part_focus_3_right'
  | 'final_recenter'
  | 'free_explore_unlock';

export const sectionMeta: { id: SectionId; label: string; title: string; body: string; side: 'left' | 'right' }[] = [
  { id: 'hero_intro', label: 'Approach', title: 'SURFACE ENCOUNTER', body: 'A low rumble of dust. The horizon glows red-orange. Somewhere ahead, the mission begins.', side: 'right' },
  { id: 'zoom_in', label: 'Descent', title: 'CLOSING IN', body: 'Telemetry locks. The rover emerges from the haze as we descend toward the surface.', side: 'left' },
  { id: 'full_model_reveal', label: 'Full Reveal', title: 'THE PAYLOAD', body: 'Solar arrays, instruments, and sampling arms — every system engineered for Mars.', side: 'right' },
  { id: 'part_focus_1', label: 'Sensor Head', title: 'PERCEPTION', body: 'Stereo cameras and LIDAR map the terrain in real time.', side: 'right' },
  { id: 'part_focus_2_left', label: 'Sampling Arm', title: 'SAMPLING', body: 'A 2-metre reach, six degrees of freedom, and a coring drill for subsurface geology.', side: 'right' },
  { id: 'part_focus_3_right', label: 'Comm Array', title: 'COMMUNICATIONS', body: 'High-gain antenna uplinks to orbiters; UHF radios talk to nearby landers.', side: 'left' },
  { id: 'final_recenter', label: 'Recenter', title: 'MISSION READY', body: 'All systems nominal. Ready for hands-on exploration.', side: 'right' },
  { id: 'free_explore_unlock', label: 'Free Explore', title: 'YOUR TURN', body: 'Drag to rotate. Scroll or pinch to zoom. Inspect the rover from any angle.', side: 'right' },
];

const cinematicSections = sectionMeta.filter(
  (s) => s.id !== 'hero_intro' && s.id !== 'free_explore_unlock',
);

/**
 * DOM overlay: hero text, scroll-driven section panels, the loading UI
 * (percent) and the final explore hint.
 *
 * IMPORTANT: The sections must be in normal document flow (relative, not
 * fixed) so they create actual scroll height for the scroll-driven
 * parallax to work. Only decorative elements like the loading bar and
 * progress indicator are fixed/absolute.
 */
export function HeroOverlay({
  loading,
  progress,
  onPhaseAnchor,
}: {
  loading: boolean;
  progress: number;
  onPhaseAnchor?: (id: SectionId) => void;
}) {
  const sectionsRef = useRef<HTMLDivElement>(null);

  // Notify parent of which section is currently most-visible.
  useEffect(() => {
    if (!onPhaseAnchor) return;
    onPhaseAnchor(sectionMeta[0].id);
  }, [onPhaseAnchor]);

  return (
    <>
      {/* Fixed decorative elements (loading bar, progress) */}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-10">
        {/* Top loading bar — visible while assets warm up. */}
        <div
          className={`transition-opacity duration-500 ${
            loading ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="mx-auto mt-3 flex w-full max-w-md items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-xs text-mars-50 backdrop-blur">
            <span className="font-display tracking-widest">PREPARING MISSION</span>
            <div className="relative h-1 flex-1 overflow-hidden rounded bg-mars-700/60">
              <div
                className="absolute inset-y-0 left-0 rounded bg-mars-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="tabular-nums text-mars-100">{Math.round(progress * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Scroll sections — IN DOCUMENT FLOW to create scroll height */}
      <div ref={sectionsRef} className="pointer-events-none relative z-10">
        {/* Hero block */}
        <div
          id="hero_intro"
          data-phase="hero_intro"
          className="relative flex h-screen items-center justify-center"
        >
          <div className="pointer-events-none select-none px-6 text-center">
            <p className="mb-6 text-xs uppercase tracking-[0.5em] text-mars-200/80">UMRT // Mars Rover</p>
            <h1 className="font-display text-[14vw] leading-[0.95] tracking-tight text-mars-50 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] md:text-[10vw]">
              MISSION<br />MARS
            </h1>
            <p className="mt-8 font-body text-base text-mars-100/80 md:text-lg">Scroll to begin the surface encounter</p>
            <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-mars-200/30 px-4 py-2 text-xs uppercase tracking-widest text-mars-100/70">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-mars-300" />
              Scroll down
            </div>
          </div>
        </div>

        {/* Section panels. Each panel sits next to a "phase" id used by the scroll director. */}
        {cinematicSections.map((s) => (
          <div
            key={s.id}
            id={s.id}
            data-phase={s.id}
            className="pointer-events-none relative flex h-screen items-center px-6 md:px-24"
          >
            <div
              className={`pointer-events-auto max-w-xl rounded-3xl bg-black/40 p-8 text-mars-50 backdrop-blur-md ${
                s.side === 'right' ? 'ml-auto' : 'mr-auto'
              }`}
            >
              <p className="mb-3 text-xs uppercase tracking-[0.4em] text-mars-200/80">{s.label}</p>
              <h2 className="font-display text-4xl leading-tight md:text-6xl">{s.title}</h2>
              <p className="mt-4 text-base text-mars-100/85 md:text-lg">{s.body}</p>
            </div>
          </div>
        ))}

        {/* Final phase: free explore. This intentionally renders no
            text/card so the canvas can receive drag gestures directly. */}
        <div
          id="free_explore_unlock"
          data-phase="free_explore_unlock"
          className="pointer-events-none relative min-h-[220vh]"
          aria-hidden="true"
        />
      </div>

      {/* Bottom progress bar (fixed) */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 h-[2px] bg-mars-700/30">
        <div className="h-full bg-mars-300 transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </>
  );
}
