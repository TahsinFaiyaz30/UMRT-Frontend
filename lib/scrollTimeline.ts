/**
 * Normalised scroll timeline (0..1) and phase helpers.
 * Keep phase ranges and easings in one place so the scroll director
 * and any debug UI stay in sync.
 */

export type PhaseName =
  | 'hero_intro'
  | 'zoom_in'
  | 'full_model_reveal'
  | 'part_focus_1'
  | 'part_focus_2_left'
  | 'part_focus_3_right'
  | 'final_recenter'
  | 'free_explore_unlock';

export type Phase = {
  name: PhaseName;
  start: number;
  end: number;
  label: string;
  hotspotIndex: number | null;
  /** Horizontal model offset during this phase (-1..1). */
  modelOffsetX: number;
};

export const phases: Phase[] = [
  { name: 'hero_intro',          start: 0.00, end: 0.12, label: 'Approach',          hotspotIndex: null, modelOffsetX: 0 },
  { name: 'zoom_in',             start: 0.12, end: 0.28, label: 'Approach',          hotspotIndex: null, modelOffsetX: 0 },
  { name: 'full_model_reveal',   start: 0.28, end: 0.42, label: 'Full Reveal',       hotspotIndex: null, modelOffsetX: 0 },
  { name: 'part_focus_1',        start: 0.42, end: 0.55, label: 'Sensor Head',       hotspotIndex: 0,    modelOffsetX: 0 },
  { name: 'part_focus_2_left',   start: 0.55, end: 0.68, label: 'Sampling Arm',      hotspotIndex: 1,    modelOffsetX: -1.4 },
  { name: 'part_focus_3_right',  start: 0.68, end: 0.82, label: 'Comm Array',        hotspotIndex: 2,    modelOffsetX: 1.4 },
  { name: 'final_recenter',      start: 0.82, end: 0.94, label: 'Recenter',          hotspotIndex: null, modelOffsetX: 0 },
  { name: 'free_explore_unlock', start: 0.94, end: 1.00, label: 'Free Explore',      hotspotIndex: null, modelOffsetX: 0 },
];

/** Linear interpolation, clamped. */
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Smoothstep easing. */
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Get the local 0..1 progress within a phase. */
export function localProgress(p: Phase, global: number): number {
  if (p.end === p.start) return 1;
  return clamp((global - p.start) / (p.end - p.start));
}

/** Eased local progress. */
export function easedProgress(p: Phase, global: number): number {
  return smoothstep(localProgress(p, global));
}

/** Look up the active phase for a global progress value. */
export function phaseAt(global: number): Phase {
  for (const p of phases) {
    if (global <= p.end) return p;
  }
  return phases[phases.length - 1];
}

/** Interpolate model horizontal offset (uses phase targets). */
export function modelOffsetXAt(global: number): number {
  if (phases.length === 0) return 0;
  let prev = phases[0];
  for (const p of phases) {
    if (global <= p.end) {
      const local = localProgress(p, global);
      return prev.modelOffsetX + (p.modelOffsetX - prev.modelOffsetX) * smoothstep(local);
    }
    prev = p;
  }
  return prev.modelOffsetX;
}

/** Hotspot in focus for a given global progress (or null). */
export function activeHotspot(global: number): number | null {
  const p = phaseAt(global);
  return p.hotspotIndex;
}

/** Has the user reached the free-explore phase yet? */
export const isInFreeExplore = (global: number) => global >= phases[phases.length - 1].start;
