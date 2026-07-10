import type { Group, Object3D, Vector3Tuple } from 'three';

/**
 * Centralised configuration for the user 3D model and the camera.
 * Tweak this file (or import overrides) to re-skin the experience
 * without touching component code.
 */

export type Hotspot = {
  id: string;
  label: string;
  /** Local offset from the model group pivot (in world units, after scale). */
  position: Vector3Tuple;
  /** The position the camera should look at when focusing this hotspot. */
  focusTarget: Vector3Tuple;
  /** Where the model should be placed horizontally: -1 (left) … 0 … 1 (right). */
  modelOffsetX: number;
  /** Approximate distance from the camera when framed on this hotspot. */
  cameraDistance: number;
};

export type ModelConfig = {
  mainPath: string;
  lowPolyPath: string | null;
  /** Scale applied to the loaded model group. */
  scale: number;
  /** Initial model group position (before any scroll-driven offsets). */
  basePosition: Vector3Tuple;
  /** Y-axis rotation in radians. */
  rotationY: number;
  /** Names of animations on the model to consider "running". */
  runningAnimationNames: string[];
  hotspots: Hotspot[];
};

export type CameraConfig = {
  fov: number;
  near: number;
  far: number;
  /** Camera position at scroll progress 0. */
  start: Vector3Tuple;
  /** Camera position at the "full model reveal" stage. */
  reveal: Vector3Tuple;
  /** Camera position when framed on the model close-up. */
  closeup: Vector3Tuple;
  /** Camera target at progress 0. */
  targetStart: Vector3Tuple;
  /** Camera target for the full reveal. */
  targetReveal: Vector3Tuple;
};

export const modelConfig: ModelConfig = {
  // The semantic Curiosity GLB has all the proper part labels
  // (`wheel_left_front__013`, `camera_mast__006`, etc.) — this is the
  // SAME file DismantleScene already loads, so drei caches it the
  // first time and the hero scene pays 0 network cost after that.
  mainPath: '/models/curiosity_v4_semantic_external.glb',
  lowPolyPath: null,
  // Authored bounds (~2.22 m tall) — keep scale at 1, no auto-normalisation.
  scale: 1,
  // The authored wheel contact plane is ~0.007 m above the model origin.
  // The displaced terrain settles at ~-0.15 m in the central landing zone.
  basePosition: [0, -0.16, 0],
  rotationY: -0.32,
  runningAnimationNames: ['run', 'Run', 'running', 'Running', 'walk', 'Walk'],
  hotspots: [
    {
      id: 'head',
      label: 'Sensor Head',
      position: [0, 1.6, 0],
      focusTarget: [0, 1.6, 0],
      modelOffsetX: 0,
      cameraDistance: 3.2,
    },
    {
      id: 'left-arm',
      label: 'Sampling Arm',
      position: [-0.9, 1.0, 0],
      focusTarget: [-0.9, 1.0, 0],
      modelOffsetX: -1.2,
      cameraDistance: 2.4,
    },
    {
      id: 'right-arm',
      label: 'Comm Array',
      position: [0.9, 1.2, 0],
      focusTarget: [0.9, 1.2, 0],
      modelOffsetX: 1.2,
      cameraDistance: 2.4,
    },
  ],
};

export const cameraConfig: CameraConfig = {
  fov: 34,
  near: 0.1,
  far: 200,
  start: [5.2, 2.7, 8.4],
  reveal: [-3.6, 2.15, 5.2],
  closeup: [2.25, 1.85, 3.35],
  targetStart: [0, 1.05, 0],
  targetReveal: [0, 1.05, 0],
};

/** Type alias for the group of the loaded model. */
export type ModelGroup = Group & { __isModelRoot?: boolean };

/** Helper: find the first Object3D by name (case-insensitive). */
export function findObject(root: Object3D, name: string): Object3D | null {
  const lower = name.toLowerCase();
  let found: Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    if (obj.name && obj.name.toLowerCase() === lower) found = obj;
  });
  return found;
}
