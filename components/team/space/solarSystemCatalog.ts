import { getSolarSystemBody, TWO_PI } from './orbitalMotion';
import { ENCOUNTER_OFFSET, SECTOR_LENGTH, type SpaceEncounter } from './spaceTypes';

/**
 * A guided outward journey, not simultaneous positions or a scale model.
 * Planet order: https://science.nasa.gov/solar-system/planets/
 * Periods/radii: https://ssd.jpl.nasa.gov/planets/phys_par.html
 * Orbit distances and apparent sizes are compressed independently so surface
 * detail and companions remain visible. Mercury and Venus have no moons.
 */
export const SOLAR_TOUR_IDS = [
  'sun', 'mercury', 'venus', 'earth', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
] as const;

/** A single shared clock preserves relative rotation and orbital periods. */
export const SOLAR_SIMULATION_SECONDS_PER_SECOND = 3_600;

interface SolarAppearance {
  kind: SpaceEncounter['kind'];
  radius: number;
  palette: SpaceEncounter['palette'];
  atmosphere: string | null;
  moons: readonly string[];
  systemRadius?: number;
  rings?: boolean;
}

const APPEARANCES: Record<typeof SOLAR_TOUR_IDS[number], SolarAppearance> = {
  sun: {
    kind: 'star', radius: 135, palette: ['#dc893f', '#fff0c6', '#fffaf1'],
    atmosphere: null, moons: [],
  },
  mercury: {
    kind: 'airless', radius: 90, palette: ['#494641', '#8b857b', '#bdb5a6'],
    atmosphere: null, moons: [],
  },
  venus: {
    kind: 'terrestrial', radius: 112, palette: ['#a89b78', '#d7c9a4', '#eee7cc'],
    atmosphere: '#e8dcc2', moons: [],
  },
  earth: {
    kind: 'terrestrial', radius: 115, palette: ['#102b44', '#365e58', '#d7e7ec'],
    atmosphere: '#76b2e2', moons: ['moon'], systemRadius: 4.8,
  },
  mars: {
    kind: 'terrestrial', radius: 100, palette: ['#503b2e', '#ad7550', '#d0a484'],
    atmosphere: '#bda18a', moons: ['phobos', 'deimos'], systemRadius: 3.5,
  },
  jupiter: {
    kind: 'gas-giant', radius: 135, palette: ['#756051', '#c6ad8e', '#e5d9c1'],
    atmosphere: '#e3d5bd', moons: ['io', 'europa', 'ganymede', 'callisto'], systemRadius: 6.3,
  },
  saturn: {
    kind: 'gas-giant', radius: 128, palette: ['#9c8864', '#d5c49b', '#eadfc6'],
    atmosphere: '#e5d6b9', moons: ['rhea', 'titan', 'iapetus'], systemRadius: 6.5, rings: true,
  },
  uranus: {
    kind: 'ice-giant', radius: 116, palette: ['#699aa1', '#9abfc3', '#c4dad9'],
    atmosphere: '#b0d6d9', moons: ['titania', 'oberon'], systemRadius: 4.8, rings: true,
  },
  neptune: {
    kind: 'ice-giant', radius: 114, palette: ['#477e9a', '#79a6b9', '#aec9d0'],
    atmosphere: '#a3c9d9', moons: ['triton'], systemRadius: 3.95, rings: true,
  },
  pluto: {
    kind: 'airless', radius: 90, palette: ['#5d4540', '#b5977b', '#ddd5c4'],
    atmosphere: '#87aaca', moons: ['charon'], systemRadius: 3.6,
  },
};

export function createSolarEncounter(index: number, seed: number): SpaceEncounter | null {
  const id = SOLAR_TOUR_IDS[index];
  if (!id) return null;
  const definition = getSolarSystemBody(id)!;
  const appearance = APPEARANCES[id];
  // The encounter is an inspection view of one system, with a shared sunlight
  // direction. It does not put all eight planetary orbits into this corridor.
  const sunlightLength = Math.hypot(-0.62, 0.72);
  return {
    index, seed, solarBodyId: id, name: definition.name,
    kind: appearance.kind, radius: appearance.radius,
    position: [index === 0 ? 300 : (index % 2 ? -1 : 1) * 205, index === 0 ? 60 : 36, -(index * SECTOR_LENGTH + ENCOUNTER_OFFSET)],
    palette: [...appearance.palette], atmosphere: appearance.atmosphere,
    moons: appearance.moons, systemRadius: appearance.systemRadius,
    rings: appearance.rings ?? false,
    axialTilt: definition.spinAxisTiltDeg * Math.PI / 180,
    rotationSpeed: definition.localRotationSign * TWO_PI
      / (Math.abs(definition.rotationPeriodHours) * 3_600) * SOLAR_SIMULATION_SECONDS_PER_SECOND,
    sunDirection: [(index % 2 ? 0.62 : -0.62) / sunlightLength, 0, 0.72 / sunlightLength],
  };
}
