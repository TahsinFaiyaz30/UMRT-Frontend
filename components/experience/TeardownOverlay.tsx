'use client';

import { useEffect, useRef } from 'react';

/**
 * Bottom-center Spatial UI designer button that triggers the 6 s
 * rover teardown effect.
 *
 * Visibility rules:
 *  - Hidden until the user has scrolled into the `free_explore_unlock`
 *    phase (the parent passes `visible`).
 *  - Pressing the button fires `onTrigger` exactly once per click.
 *
 * It is fixed to the viewport (NOT in document flow) so it overlays
 * the live WebGL canvas instead of pushing page content around.
 *
 * The button is keyboard-accessible (Enter / Space).
 *
 * IMPORTANT: we stop pointerdown / mousedown from bubbling to the
 * window. Lenis registers a global pointerdown listener for its
 * smooth-scroll drag gestures; without this guard a click on the
 * teardown button can be misread as the start of a drag and Lenis
 * will animate `scrollY` back toward 0, throwing the user out of the
 * free-explore phase. `e.stopPropagation()` on pointerdown + the
 * already-correct `type="button"` keeps the click purely local to
 * the React tree.
 */
export function TeardownOverlay({
  visible,
  playing,
  onTrigger,
}: {
  visible: boolean;
  /** True while the dismantle animation is currently active. */
  playing: boolean;
  onTrigger: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  // Disable the button while a teardown is mid-play so the user can't
  // stack animations. Restored automatically when `playing` flips back
  // to false.
  useEffect(() => {
    if (!btnRef.current) return;
    btnRef.current.disabled = playing;
  }, [playing]);

  // Keep the global scroll position pinned during the 6 s window.
  // This is a belt-and-braces guard: even if Lenis were to start
  // animating scrollY mid-click (e.g. because the user happens to
  // have momentum still decaying when they tap the button), we
  // restore the prior position on the next frame so the page never
  // jumps to the top of the hero.
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    const lock = () => {
      const targetY = window.scrollY;
      if (window.scrollY !== targetY) {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      }
      raf = requestAnimationFrame(lock);
    };
    raf = requestAnimationFrame(lock);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  if (!visible) return null;

  // Stop pointerdown from reaching Lenis's window-level listener so
  // the click doesn't get reinterpreted as the start of a drag-scroll.
  const stopPointer = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex justify-center px-6"
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
      onTouchStart={stopPointer}
      onClick={stopPointer}
    >
      <button
        ref={btnRef}
        type="button"
        onPointerDown={stopPointer}
        onMouseDown={stopPointer}
        onTouchStart={stopPointer}
        onClick={(e) => {
          e.stopPropagation();
          onTrigger();
        }}
        className={`pointer-events-auto group inline-flex flex-col items-center gap-2 rounded-2xl border border-mars-200/30 bg-black/55 px-7 py-4 text-center text-mars-50 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-mars-300/60 hover:bg-black/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mars-300/70 ${
          playing ? 'cursor-wait opacity-90' : 'cursor-pointer'
        }`}
        aria-label="Trigger rover teardown animation"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.45em] text-mars-200/90">
          Spatial UI Designer
        </span>
        <span className="font-display text-xl tracking-wide md:text-2xl">
          Rover Teardown
        </span>
        <span className="max-w-[18rem] text-[11px] leading-snug text-mars-100/70">
          {playing
            ? 'Reassembling subsystems…'
            : 'Explore the rover from any angle • Dismantle by subsystem'}
        </span>
      </button>
    </div>
  );
}
