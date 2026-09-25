'use client';

import { encounterClearance } from './encounterCatalog';
import type { SpaceEncounter } from './spaceTypes';

/** Mutable frame state: camera and scheduler coordinate without React renders. */
export interface FlightState {
  distance: number;
  targetDistance: number;
  origin: number;
  /** Actual camera travel in the fixed 3D world, distinct from scroll pacing. */
  worldDistance: number;
  openingReady: boolean;
  sectorIndex: number;
  observationMode: boolean;
  autoDrift: boolean;
  reducedMotion: boolean;
  generationState: 'preparing' | 'ready';
  /** Furthest safe forward travel while the next detailed encounter is prepared. */
  readyThroughDistance: number;
  activeSectorName: string;
  /** UI requests survive a still-loading lazy scene without event races. */
  requestedSector: number | null;
  viewMagnification: number;
  inspectSunspots: boolean;
  solarView: 'euv' | 'white-light';
}

export const flightState: FlightState = {
  distance: 0,
  targetDistance: 0,
  origin: 0,
  worldDistance: 0,
  openingReady: false,
  sectorIndex: 0,
  observationMode: false,
  autoDrift: true,
  reducedMotion: false,
  generationState: 'preparing',
  readyThroughDistance: 0,
  activeSectorName: 'Interstellar transit',
  requestedSector: null,
  viewMagnification: 1,
  inspectSunspots: false,
  solarView: 'euv',
};

export interface FlightPose {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
}

function smoothstep(min: number, max: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

/** A short, smooth approach gives the opening camera room to frame both the
 * Sun and the actual Mercury farther down the same route. No duplicate body. */
export function cameraTravelDistance(distance: number): number {
  return distance - 450 * smoothstep(0, 1000, distance) * (1 - smoothstep(1800, 2600, distance));
}

/**
 * Analytic, open flight path with a guaranteed clearance envelope. Transitions
 * finish before the midpoint between encounters, so sector changes cannot jump.
 * Reuse `out` in the render loop; this function allocates no frame objects.
 */
export function sampleFlightPose(distance: number, encounter: SpaceEncounter, out: FlightPose, worldRemaining?: number): FlightPose {
  const remaining = -encounter.position[2] - distance;
  const clearance = encounterClearance(encounter);
  const transitionEnd = Math.max(1180, clearance + 140);
  const bypass = 1 - smoothstep(clearance, transitionEnd, Math.abs(remaining));
  const side = Math.sign(encounter.position[0]) || 1;
  const baseX = Math.sin(distance * 0.00043) * 11;
  const baseY = Math.sin(distance * 0.00031) * 7;
  const bypassX = encounter.position[0] - side * (clearance + 20);
  out.x = baseX + (bypassX - baseX) * bypass;
  out.y = baseY + (encounter.position[1] * 0.3 - baseY) * bypass;

  const track = (1 - smoothstep(850, 1250, Math.abs(remaining)))
    * smoothstep(-650, -100, remaining);
  const dx = encounter.position[0] - out.x;
  const dy = encounter.position[1] - out.y;
  out.yaw = Math.atan2(dx, worldRemaining ?? remaining) * track;
  out.pitch = Math.atan2(dy, Math.hypot(dx, worldRemaining ?? remaining)) * track;
  return out;
}

/** Used by both the HUD and flight rig to leave ordinary page controls alone. */
export function isFlightControlTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    'button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"]',
  ));
}
