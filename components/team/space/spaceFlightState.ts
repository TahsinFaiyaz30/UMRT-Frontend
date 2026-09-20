'use client';

/**
 * Shared flight state for 60fps coordination between camera rig, HUD, and celestial bodies.
 * High-performance mutable object avoiding React re-renders.
 */

export interface FlightState {
  progress: number;
  targetProgress: number;
  observationMode: boolean;
  autoDrift: boolean;
  activeSectorName: string;
}

export const flightState: FlightState = {
  progress: 0,
  targetProgress: 0,
  observationMode: false,
  autoDrift: true,
  activeSectorName: 'MARS ORBITAL APPROACH',
};
