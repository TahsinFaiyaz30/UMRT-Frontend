'use client';

/**
 * Shared mutable state for the team space field.
 *
 * The pointer rig writes here every frame and the debris simulation reads it;
 * routing that through React state would re-render the tree 60 times a second,
 * so this is deliberately a plain mutable object handed around by reference.
 *
 * The same object carries the shockwave pool, which is what couples the DOM to
 * the scene: a card's `pointerenter` handler and a fast mouse flick both end up
 * pushing an entry here, and the simulation does not care which produced it.
 */

import * as THREE from 'three';

export type ShockKind =
  /** A fast cursor flick. Damages debris. */
  | 'impact'
  /** A DOM element was hovered. Gathers debris rather than breaking it. */
  | 'resonance';

export interface Shockwave {
  origin: THREE.Vector3;
  /** Seconds since the wave was fired. Negative marks the slot as free. */
  age: number;
  /** Seconds the wave lives for. */
  life: number;
  /** World units per second the ring expands at. */
  speed: number;
  /** 0..1 — scales both the push and the damage. */
  strength: number;
  kind: ShockKind;
}

const SHOCK_POOL = 10;

export interface SpaceState {
  /** Pointer projected onto the debris plane, in world space. */
  pointer: THREE.Vector3;
  /** World-space pointer velocity, units per second. */
  pointerVelocity: THREE.Vector3;
  /** Magnitude of `pointerVelocity`, smoothed. */
  pointerSpeed: number;

  /**
   * The cursor as a ray through the scene rather than a point on one plane.
   *
   * A sphere parked at a single depth can only touch the thin slice of the
   * field that happens to sit at that depth — which is why the cursor used to
   * hit almost nothing. Testing against the whole ray means anything visually
   * under the cursor is in reach, at any distance.
   */
  rayOrigin: THREE.Vector3;
  rayDir: THREE.Vector3;
  /** Camera distance to the pointer plane, used to scale screen-space units. */
  pointerRefDist: number;
  /** False when the pointer has left the window or has never moved. */
  pointerActive: boolean;
  /** Normalised device coords, used for camera parallax. */
  ndc: THREE.Vector2;
  /** Page scroll in world units — how far we have travelled into the field. */
  travel: number;
  /** Current travel velocity in world units/second. */
  travelSpeed: number;
  /** Normalized scroll progress (0..1) through the page. */
  scrollProgress: number;
  /** Fixed-size ring of live shockwaves. */
  shocks: Shockwave[];
  shockCursor: number;
  /** True when the visitor asked for reduced motion. */
  reducedMotion: boolean;
}

export function createSpaceState(): SpaceState {
  return {
    pointer: new THREE.Vector3(),
    pointerVelocity: new THREE.Vector3(),
    pointerSpeed: 0,
    rayOrigin: new THREE.Vector3(),
    rayDir: new THREE.Vector3(0, 0, -1),
    pointerRefDist: 34,
    pointerActive: false,
    ndc: new THREE.Vector2(),
    travel: 0,
    travelSpeed: 0,
    scrollProgress: 0,
    shocks: Array.from({ length: SHOCK_POOL }, () => ({
      origin: new THREE.Vector3(),
      age: -1,
      life: 1,
      speed: 1,
      strength: 0,
      kind: 'impact' as ShockKind,
    })),
    shockCursor: 0,
    reducedMotion: false,
  };
}

/** Fire a shockwave, reusing the oldest slot when the pool is saturated. */
export function emitShock(
  state: SpaceState,
  origin: THREE.Vector3,
  kind: ShockKind,
  strength: number,
) {
  // Prefer a free slot; otherwise overwrite round-robin so a burst of events
  // cannot starve the pool and freeze one wave on screen.
  let slot = state.shocks.findIndex((s) => s.age < 0);
  if (slot === -1) {
    slot = state.shockCursor;
    state.shockCursor = (state.shockCursor + 1) % state.shocks.length;
  }

  const shock = state.shocks[slot];
  shock.origin.copy(origin);
  shock.age = 0;
  shock.kind = kind;
  shock.strength = THREE.MathUtils.clamp(strength, 0, 1);
  shock.life = kind === 'impact' ? 1.15 : 1.6;
  shock.speed = kind === 'impact' ? 26 : 15;
}

/* ------------------------------------------------------------------ *
 *  DOM -> scene bridge                                                *
 * ------------------------------------------------------------------ */

/**
 * Screen-space resonance requests, published by DOM hover handlers and drained
 * by the pointer rig (which is the only place that can project screen space
 * into the scene, since it owns the camera).
 */
export interface ResonanceRequest {
  /** Viewport pixels. */
  x: number;
  y: number;
  strength: number;
}

const pending: ResonanceRequest[] = [];

/** Called from DOM event handlers — cheap, allocation-free in the common case. */
export function requestResonance(x: number, y: number, strength = 0.6) {
  // A hover storm (a grid of cards under a moving cursor) must not queue
  // hundreds of pulses before the next frame drains them.
  if (pending.length > 6) return;
  pending.push({ x, y, strength });
}

export function drainResonance(): ResonanceRequest[] {
  if (pending.length === 0) return pending;
  return pending.splice(0, pending.length);
}
