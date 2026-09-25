import { ENCOUNTER_OFFSET, SECTOR_LENGTH } from './spaceTypes';

// Scroll distance controls pacing; the empty corridors are longer in the fixed
// 3D world. Positions never animate to disguise a pending texture or shader.
export const INTERSTELLAR_GAP = 36_000;
const NEAR_DISTANCE = 750;

export function encounterWorldDistance(index: number): number {
  return index * SECTOR_LENGTH + ENCOUNTER_OFFSET + Math.max(0, index - 1) * INTERSTELLAR_GAP;
}

/** Smooth camera acceleration through empty space, unit speed near bodies.
 * Sun and Mercury share the unexpanded opening. There is no time/age input. */
export function travelWorldDistance(distance: number): number {
  if (distance <= SECTOR_LENGTH + ENCOUNTER_OFFSET + NEAR_DISTANCE) return distance;
  const previous = Math.max(1, Math.floor((distance - ENCOUNTER_OFFSET) / SECTOR_LENGTH));
  const center = previous * SECTOR_LENGTH + ENCOUNTER_OFFSET;
  const t = Math.max(0, Math.min(1, (distance - center - NEAR_DISTANCE) / (SECTOR_LENGTH - 2 * NEAR_DISTANCE)));
  const ease = t * t * (3 - 2 * t);
  return distance + (previous - 1 + ease) * INTERSTELLAR_GAP;
}

export function encounterPrefetch(index: number, localDistance: number): boolean {
  return index === 0 || localDistance >= 750;
}

export function openingPairReady(resident: { has: (index: number) => boolean }): boolean {
  return resident.has(0) && resident.has(1);
}
