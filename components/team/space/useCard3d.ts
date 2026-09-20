'use client';

/**
 * Gives a DOM element real 3-D behaviour and wires it into the scene behind it.
 *
 * The element tilts on `rotateX`/`rotateY` inside a perspective parent and
 * lifts on `translateZ`, while its inner layers sit at their own depths — so a
 * tilt produces genuine parallax between portrait, text and bloom rather than a
 * flat skew. The browser runs the same projection maths the WebGL field does.
 *
 * Rotation goes through Framer motion values rather than CSS, because Framer
 * owns `transform` on these elements for the entrance reveal; a competing CSS
 * transform would simply be overwritten. The pointer-tracked sheen is a plain
 * custom property, which cannot collide.
 *
 * One rect is cached per hover and nothing is read during movement, so tracking
 * costs no layout and never re-renders React.
 */

import { useCallback, useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

interface Card3dOptions {
  /** Peak tilt in degrees at the element's corner. */
  max?: number;
  /** How far the element rises toward the viewer, in px of Z. */
  lift?: number;
  /** Resonance strength pushed into the 3-D field on hover. 0 disables. */
  resonance?: number;
}

const SPRING = { stiffness: 260, damping: 26, mass: 0.45 } as const;
const RESONANCE_THROTTLE_MS = 220;

export function useCard3d({ max = 8, lift = 26, resonance = 0.6 }: Card3dOptions = {}) {
  const reduce = useReducedMotion();

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const tz = useMotionValue(0);

  const rotateX = useSpring(rx, SPRING);
  const rotateY = useSpring(ry, SPRING);
  const translateZ = useSpring(tz, SPRING);

  const rect = useRef<DOMRect | null>(null);
  const lastPulse = useRef(0);

  const onPointerEnter = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Touch has no hover state; a tilt left stuck after a tap reads as broken,
      // and the tap already drives the field through the pointer rig.
      if (event.pointerType === 'touch') return;

      const r = event.currentTarget.getBoundingClientRect();
      rect.current = r;
      if (!reduce) tz.set(lift);

      if (resonance > 0) {
        const now = performance.now();
        if (now - lastPulse.current > RESONANCE_THROTTLE_MS) {
          lastPulse.current = now;
          // Imported lazily so a page without the field never pulls the module.
          void import('./spaceState').then(({ requestResonance }) =>
            requestResonance(r.left + r.width / 2, r.top + r.height / 2, resonance),
          );
        }
      }
    },
    [reduce, lift, resonance, tz],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch' || reduce) return;

      const el = event.currentTarget;
      const r = rect.current ?? el.getBoundingClientRect();
      if (!rect.current) rect.current = r;

      const px = (event.clientX - r.left) / r.width;
      const py = (event.clientY - r.top) / r.height;

      ry.set((px - 0.5) * 2 * max);
      rx.set(-(py - 0.5) * 2 * max);

      // Specular sheen follows the cursor across the surface.
      el.style.setProperty('--card-mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--card-my', `${(py * 100).toFixed(1)}%`);
    },
    [reduce, max, rx, ry],
  );

  const onPointerLeave = useCallback(() => {
    rect.current = null;
    rx.set(0);
    ry.set(0);
    tz.set(0);
  }, [rx, ry, tz]);

  return {
    handlers: { onPointerEnter, onPointerMove, onPointerLeave },
    /** Spread onto the Framer element's `style`. */
    style: reduce ? {} : { rotateX, rotateY, translateZ },
  };
}
