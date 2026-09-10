/**
 * Shared entrance-reveal props for the team views.
 *
 * All three views animate identically through this helper, and every reveal
 * collapses to nothing when the visitor prefers reduced motion — content is
 * never left behind an animation that will not run.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export interface RevealOptions {
  /** Vertical offset to rise from. */
  y?: number;
  /** Horizontal offset to slide from. */
  x?: number;
  /** Scale to grow from. */
  scale?: number;
  delay?: number;
  duration?: number;
  /** Re-run the reveal each time the element scrolls back into view. */
  repeat?: boolean;
}

/**
 * Build `whileInView` reveal props.
 *
 * @param reduce Result of framer-motion's `useReducedMotion()`.
 */
export function reveal(reduce: boolean | null, options: RevealOptions = {}) {
  if (reduce) return {};

  const { y = 18, x = 0, scale, delay = 0, duration = 0.65, repeat = false } = options;

  return {
    initial: { opacity: 0, y, x, ...(scale !== undefined ? { scale } : {}) },
    whileInView: { opacity: 1, y: 0, x: 0, ...(scale !== undefined ? { scale: 1 } : {}) },
    viewport: { once: !repeat, margin: '-60px 0px' },
    transition: { duration, delay, ease: EASE },
  } as const;
}

/** Staggered container variants, used for card grids. */
export function stagger(reduce: boolean | null, step = 0.07) {
  if (reduce) return {};

  return {
    variants: {
      hidden: {},
      visible: { transition: { staggerChildren: step } },
    },
    initial: 'hidden',
    whileInView: 'visible',
    viewport: { once: true, margin: '-60px 0px' },
  } as const;
}

/** Child variants that pair with `stagger`. */
export function staggerItem(reduce: boolean | null) {
  if (reduce) return {};

  return {
    variants: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
    },
  } as const;
}
