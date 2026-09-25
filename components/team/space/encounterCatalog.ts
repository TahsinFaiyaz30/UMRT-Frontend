import { ENCOUNTER_OFFSET, SECTOR_LENGTH, type EncounterKind, type SpaceEncounter } from './spaceTypes';
import { createSolarEncounter } from './solarSystemCatalog';

/**
 * Procedural scientific classes, not a claimed map of measured celestial bodies.
 * Composition/color families follow NASA; distances and sizes are cinematic.
 * https://science.nasa.gov/solar-system/solar-system-facts/
 * https://science.nasa.gov/solar-system/10-things-whats-that-space-rock/
 * https://science.nasa.gov/universe/stars/types/
 * https://science.nasa.gov/universe/black-holes/anatomy/
 */
const CLASSES: readonly { kind: EncounterKind; weight: number }[] = [
  { kind: 'terrestrial', weight: 22 },
  { kind: 'airless', weight: 16 },
  { kind: 'gas-giant', weight: 18 },
  { kind: 'ice-giant', weight: 12 },
  { kind: 'asteroid', weight: 12 },
  { kind: 'comet', weight: 7 },
  { kind: 'star', weight: 8 },
  { kind: 'black-hole', weight: 5 },
];

/** Generating one sector never generates its predecessors. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function sectorSeed(index: number): number {
  // Hash all decimal digits rather than truncating the sector index to 32 bits.
  let hash = 2166136261;
  const key = `umrt-voyage-1:${index}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

export function createEncounter(rawIndex: number): SpaceEncounter {
  const index = Number.isFinite(rawIndex) ? Math.max(0, Math.floor(rawIndex)) : 0;
  const seed = sectorSeed(index);
  const solarEncounter = createSolarEncounter(index, seed);
  if (solarEncounter) return solarEncounter;
  const random = seededRandom(seed);
  let selection = random() * 100;
  let kind: EncounterKind = 'terrestrial';
  for (const candidate of CLASSES) {
    selection -= candidate.weight;
    if (selection < 0) {
      kind = candidate.kind;
      break;
    }
  }

  let name: string;
  let palette: SpaceEncounter['palette'];
  let atmosphere: string | null = null;
  let rings = false;
  let radius = 78 + random() * 42;
  switch (kind) {
    case 'terrestrial': {
      const oxidized = random() < 0.62;
      name = oxidized ? 'Iron-rich terrestrial world' : 'Basaltic terrestrial world';
      palette = oxidized ? ['#492a21', '#a75c39', '#dba57c'] : ['#302e2c', '#777064', '#c0b19b'];
      atmosphere = oxidized ? '#b48165' : '#b5ac93';
      break;
    }
    case 'airless': {
      const icy = random() < 0.35;
      name = icy ? 'Cratered icy body' : 'Cratered rocky body';
      palette = icy ? ['#606e76', '#a9b6bf', '#dce4e4'] : ['#38352f', '#77716a', '#b9b0a0'];
      radius = 68 + random() * 36;
      break;
    }
    case 'gas-giant':
      rings = random() < 0.55;
      name = rings ? 'Ringed gas giant' : 'Banded gas giant';
      palette = random() < 0.5 ? ['#665044', '#ba9873', '#e7d5b5'] : ['#776b50', '#c2ac79', '#eadcc0'];
      atmosphere = '#ddc6a6';
      radius = 105 + random() * 30;
      break;
    case 'ice-giant':
      rings = random() < 0.35;
      name = rings ? 'Ringed ice giant' : 'Methane-rich ice giant';
      palette = random() < 0.5 ? ['#174778', '#3b7eac', '#8bc2d5'] : ['#3d737d', '#7caaae', '#b5d4cf'];
      atmosphere = '#79b7d6';
      radius = 95 + random() * 30;
      break;
    case 'asteroid': {
      const carbonaceous = random() < 0.62;
      name = carbonaceous ? 'Carbon-rich asteroid debris' : 'Rock and metal asteroid debris';
      palette = carbonaceous ? ['#1f1d1a', '#50473c', '#8f7f67'] : ['#3b3631', '#81796b', '#b6ab94'];
      radius = 65 + random() * 20;
      break;
    }
    case 'comet':
      name = 'Active icy comet';
      palette = ['#262b2c', '#69706c', '#a7b2ae'];
      radius = 65 + random() * 14;
      break;
    case 'star': {
      const cool = random() < 0.6;
      name = cool ? 'K-type main-sequence star' : 'G-type main-sequence star';
      palette = cool ? ['#dc4821', '#ffae56', '#fff0d4'] : ['#e18435', '#ffd482', '#fff9e8'];
      radius = 108 + random() * 27;
      break;
    }
    case 'black-hole':
      name = 'Accreting stellar-mass black hole';
      palette = ['#25190f', '#e4893d', '#ffebc6'];
      radius = 68 + random() * 22;
      break;
  }

  return {
    index,
    seed,
    kind,
    name,
    radius,
    position: [
      (random() < 0.5 ? -1 : 1) * (155 + random() * 70),
      (random() - 0.5) * 160,
      -(index * SECTOR_LENGTH + ENCOUNTER_OFFSET),
    ],
    palette,
    atmosphere,
    rings,
    axialTilt: (random() - 0.5) * 0.95,
    rotationSpeed: (0.008 + random() * 0.02) * (random() < 0.12 ? -1 : 1),
  };
}

/** Keeps wide rings and the accretion disk in frame as well as clearing geometry. */
export function encounterClearance(encounter: SpaceEncounter): number {
  if (encounter.solarBodyId && !encounter.systemRadius) return encounter.radius * 3.2 + 90;
  if (encounter.systemRadius) return encounter.radius * (encounter.systemRadius + 0.8) + 100;
  if (encounter.kind === 'black-hole') return encounter.radius * 9 + 140;
  if (encounter.rings) return encounter.radius * 5.7 + 90;
  const scale = encounter.kind === 'star' ? 1.7
    : encounter.kind === 'comet' ? 1.4 : 1.3;
  return encounter.radius * scale + 70;
}
