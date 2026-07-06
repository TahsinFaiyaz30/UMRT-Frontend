/**
 * Teardown configuration extracted from the curiosity_semantic_real_teardown HTML.
 * Contains all semantic part metadata, motion definitions, internal module specs,
 * and easing helpers needed by the DismantleScene component.
 */

import type { Vector3Tuple } from 'three';

/* ------------------------------------------------------------------ */
/*  Easing helpers                                                     */
/* ------------------------------------------------------------------ */

export const clampT = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const localT = (t: number, s: number, e: number) =>
  clampT((t - s) / Math.max(0.0001, e - s));

/* ------------------------------------------------------------------ */
/*  Model centre / bounds                                              */
/* ------------------------------------------------------------------ */

export const teardownCenter: Vector3Tuple = [0.004125714302062988, 1.1152029410004616, 0.31309938430786133];
export const teardownBoundsMin: Vector3Tuple = [-1.3867778778076172, 0.007619485259056091, -1.659246802330017];
export const teardownBoundsMax: Vector3Tuple = [1.3950293064117432, 2.222786396741867, 2.2854455709457397];

/* ------------------------------------------------------------------ */
/*  Per-subsystem motion definitions                                   */
/* ------------------------------------------------------------------ */

export type TeardownMotion = {
  explode: Vector3Tuple;
  rot: Vector3Tuple;
  start: number;
  end: number;
};

export const teardownMotions: Record<string, TeardownMotion> = {
  camera_mast:          { explode: [0.0, 1.65, 0.2],          rot: [0.0, 0.12, 0.0],    start: 0.04, end: 0.2  },
  robotic_arm_turret:   { explode: [1.28, 0.62, 1.02],        rot: [0.16, 0.2, -0.1],   start: 0.1,  end: 0.3  },
  upper_deck:           { explode: [0.0, 0.82, 0.2],          rot: [0.05, 0.0, 0.0],    start: 0.18, end: 0.4  },
  rear_power_comms:     { explode: [-0.65, 0.38, -1.02],      rot: [0.0, -0.18, 0.05],  start: 0.24, end: 0.48 },
  warm_electronics_box: { explode: [0.0, 0.28, 0.0],          rot: [0.0, 0.0, 0.0],     start: 0.28, end: 0.54 },
  central_frame:        { explode: [0.0, -0.4, 0.0],          rot: [0.06, 0.0, 0.0],    start: 0.34, end: 0.62 },
  left_rocker_bogie:    { explode: [-0.95, -0.2, 0.0],        rot: [0.05, -0.12, 0.05], start: 0.42, end: 0.7  },
  right_rocker_bogie:   { explode: [0.95, -0.2, 0.0],         rot: [0.05, 0.12, -0.05], start: 0.42, end: 0.7  },
  wheel_left_front:     { explode: [-0.76, -0.48, 0.72],      rot: [0.0, -0.3, 0.12],   start: 0.5,  end: 0.76 },
  wheel_left_mid:       { explode: [-1.02, -0.24, 0.0],       rot: [0.0, -0.3, 0.12],   start: 0.52, end: 0.78 },
  wheel_left_rear:      { explode: [-0.76, -0.34, -0.72],     rot: [0.0, -0.3, 0.12],   start: 0.54, end: 0.8  },
  wheel_right_front:    { explode: [0.76, -0.48, 0.72],       rot: [0.0, 0.3, -0.12],   start: 0.5,  end: 0.76 },
  wheel_right_mid:      { explode: [1.02, -0.24, 0.0],        rot: [0.0, 0.3, -0.12],   start: 0.52, end: 0.78 },
  wheel_right_rear:     { explode: [0.76, -0.34, -0.72],      rot: [0.0, 0.3, -0.12],   start: 0.54, end: 0.8  },
};

/* ------------------------------------------------------------------ */
/*  Internal module definitions                                        */
/* ------------------------------------------------------------------ */

export type InternalModuleDef = {
  name: string;
  explode: Vector3Tuple;
  rot: Vector3Tuple;
  start: number;
  end: number;
};

export const internalModules: InternalModuleDef[] = [
  { name: 'SAM suite',                  explode: [-1.15, 0.35, 0.85],  rot: [0.05, -0.18, 0.04], start: 0.56, end: 0.84 },
  { name: 'CheMin',                     explode: [1.15, 0.32, 0.80],   rot: [0.04, 0.20, -0.04], start: 0.58, end: 0.86 },
  { name: 'avionics',                   explode: [0, 0.80, -0.45],     rot: [0.02, 0.00, 0.00],  start: 0.64, end: 0.90 },
  { name: 'power batteries radios',     explode: [0, -0.72, -0.70],    rot: [0.05, 0.00, 0.00],  start: 0.68, end: 0.96 },
  { name: 'wiring harness',             explode: [0, 0.22, 0],         rot: [0, 0, 0],            start: 0.78, end: 1.0  },
];

/* ------------------------------------------------------------------ */
/*  Materials palette                                                  */
/* ------------------------------------------------------------------ */

export type MaterialDef = {
  color: number;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
};

export const materialPalette: Record<string, MaterialDef> = {
  metal:     { color: 0xb6bbc0, metalness: 0.86, roughness: 0.24, envMapIntensity: 1.6 },
  darkMetal: { color: 0x4e555a, metalness: 0.82, roughness: 0.30, envMapIntensity: 1.4 },
  gold:      { color: 0xd8ad48, metalness: 0.9,  roughness: 0.22, envMapIntensity: 1.8 },
  copper:    { color: 0xc06b2c, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.8 },
  pcb:       { color: 0x0e6437, metalness: 0.06, roughness: 0.46, envMapIntensity: 1.0 },
  chip:      { color: 0x08090b, metalness: 0.2,  roughness: 0.32, envMapIntensity: 0.7 },
  blue:      { color: 0x2b70d8, metalness: 0.32, roughness: 0.3,  envMapIntensity: 1.2 },
  cyan:      { color: 0x38c9de, metalness: 0.25, roughness: 0.28, envMapIntensity: 1.2 },
  white:     { color: 0xd4d1c4, metalness: 0.38, roughness: 0.42, envMapIntensity: 1.0 },
  glass:     { color: 0x090a0e, metalness: 0.1,  roughness: 0.08, envMapIntensity: 2.0 },
};

/* ------------------------------------------------------------------ */
/*  Stage name helper                                                  */
/* ------------------------------------------------------------------ */

export function stageName(t: number): string {
  if (t < 0.10) return 'Assembled';
  if (t < 0.30) return 'Mast / arm / deck release';
  if (t < 0.50) return 'Body opens';
  if (t < 0.70) return 'Mobility system separates';
  if (t < 0.88) return 'Internal modules reveal';
  return 'Full semantic teardown';
}
