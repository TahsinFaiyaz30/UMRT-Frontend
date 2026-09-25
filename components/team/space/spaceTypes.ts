/** Scene units are cinematic, not astronomical distances. */
export const SECTOR_LENGTH = 2600;
export const ENCOUNTER_OFFSET = 1550;
export const SCROLL_WORLD_SCALE = 0.72;

export type EncounterKind =
  | 'terrestrial'
  | 'airless'
  | 'gas-giant'
  | 'ice-giant'
  | 'asteroid'
  | 'comet'
  | 'star'
  | 'black-hole';

export interface SpaceEncounter {
  index: number;
  seed: number;
  kind: EncounterKind;
  /** A real Solar System body, or a scientific class beyond the opening tour. */
  name: string;
  /** Only set for measured Solar System bodies in the introductory sequence. */
  solarBodyId?: string;
  /** Major companions shown in this encounter; not a census of all moons. */
  moons?: readonly string[];
  /** Direction toward the Sun in the encounter's world coordinates. */
  sunDirection?: [number, number, number];
  /** Conservative moon-system extent, measured in the parent body's radii. */
  systemRadius?: number;
  radius: number;
  /** Absolute coordinates; rendering rebases the z axis near the viewer. */
  position: [number, number, number];
  palette: [string, string, string];
  atmosphere: string | null;
  rings: boolean;
  axialTilt: number;
  rotationSpeed: number;
}
