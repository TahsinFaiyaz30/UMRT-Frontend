export type CosmicPlanetConfig = {
  radius: number;
  orbit: number;
  speed: number;
  inclination: number;
  phase: number;
  colorA: string;
  colorB: string;
  atmosphere: string;
  seed: number;
  rings?: boolean;
  moon?: boolean;
};

export type CosmicSystemConfig = {
  name: string;
  position: readonly [number, number, number];
  starColor: string;
  starCore: string;
  starSize: number;
  starIntensity: number;
  planets: readonly CosmicPlanetConfig[];
  debris: number;
  binary?: boolean;
  pulsar?: boolean;
};

/**
 * The systems form a deep, asymmetric corridor. The camera advances more than
 * 150 world units from the first milestone to the final one; it never loops
 * around a single backdrop.
 */
export const COSMIC_SYSTEMS: readonly CosmicSystemConfig[] = [
  {
    name: 'The Ember Origin',
    position: [0, 0, 0],
    starColor: '#ff5a1f',
    starCore: '#fff0c4',
    starSize: 0.82,
    starIntensity: 17,
    debris: 66,
    planets: [
      { radius: 0.47, orbit: 2.25, speed: 0.28, inclination: 0.22, phase: 0.2, colorA: '#2a0803', colorB: '#c8491c', atmosphere: '#ff6b2b', seed: 1.7, moon: true },
      { radius: 0.71, orbit: 3.55, speed: -0.13, inclination: -0.34, phase: 2.1, colorA: '#180b08', colorB: '#85472d', atmosphere: '#ffb36a', seed: 4.1, rings: true },
    ],
  },
  {
    name: 'Copper Dawn',
    position: [7.2, 2.6, -21],
    starColor: '#ff9a52',
    starCore: '#fff8df',
    starSize: 0.72,
    starIntensity: 14,
    debris: 96,
    planets: [
      { radius: 0.38, orbit: 1.8, speed: 0.38, inclination: -0.48, phase: 1.4, colorA: '#341109', colorB: '#ee7f3c', atmosphere: '#ff9a52', seed: 9.2 },
      { radius: 0.82, orbit: 3.2, speed: 0.15, inclination: 0.25, phase: 3.2, colorA: '#120d0a', colorB: '#9a5e38', atmosphere: '#ffcf98', seed: 13.8, moon: true },
      { radius: 0.31, orbit: 4.45, speed: -0.22, inclination: 0.6, phase: 5.1, colorA: '#180402', colorB: '#72210c', atmosphere: '#ff5a1f', seed: 21.4 },
    ],
  },
  {
    name: 'Verdant Relay',
    position: [-6.8, -2.1, -43],
    starColor: '#d8ff4f',
    starCore: '#f8ffe0',
    starSize: 0.66,
    starIntensity: 13,
    debris: 48,
    planets: [
      { radius: 0.93, orbit: 2.75, speed: 0.11, inclination: 0.18, phase: 0.8, colorA: '#07130b', colorB: '#59722a', atmosphere: '#d8ff4f', seed: 17.3, rings: true, moon: true },
      { radius: 0.42, orbit: 4.25, speed: -0.19, inclination: -0.52, phase: 4.3, colorA: '#07120f', colorB: '#2c7460', atmosphere: '#86ffd4', seed: 28.2 },
    ],
  },
  {
    name: 'Binary Revelation',
    position: [8.6, -0.8, -65],
    starColor: '#ff6533',
    starCore: '#fff4d0',
    starSize: 0.64,
    starIntensity: 15,
    debris: 78,
    binary: true,
    planets: [
      { radius: 0.57, orbit: 2.8, speed: 0.21, inclination: 0.65, phase: 0.5, colorA: '#22080b', colorB: '#a73555', atmosphere: '#ff7696', seed: 31.7 },
      { radius: 0.78, orbit: 4.2, speed: -0.1, inclination: -0.18, phase: 2.8, colorA: '#15131b', colorB: '#766b91', atmosphere: '#c8b6ff', seed: 37.6, rings: true },
    ],
  },
  {
    name: 'Azure Crossing',
    position: [-4.5, 4.1, -88],
    starColor: '#63a9ff',
    starCore: '#f4fbff',
    starSize: 0.78,
    starIntensity: 18,
    debris: 52,
    planets: [
      { radius: 0.52, orbit: 2.0, speed: 0.31, inclination: 0.36, phase: 2.2, colorA: '#03101d', colorB: '#1e73ad', atmosphere: '#61c7ff', seed: 42.1, moon: true },
      { radius: 1.05, orbit: 3.75, speed: 0.08, inclination: -0.22, phase: 4.9, colorA: '#0b0d21', colorB: '#4557b6', atmosphere: '#8298ff', seed: 48.8, rings: true },
    ],
  },
  {
    name: 'Red Frontier',
    position: [6.3, -4.2, -111],
    starColor: '#ff3216',
    starCore: '#ffd19c',
    starSize: 0.91,
    starIntensity: 21,
    debris: 118,
    planets: [
      { radius: 0.44, orbit: 1.95, speed: 0.34, inclination: -0.16, phase: 1.1, colorA: '#230300', colorB: '#d84319', atmosphere: '#ff4a1c', seed: 53.2 },
      { radius: 0.88, orbit: 3.2, speed: -0.12, inclination: 0.43, phase: 3.6, colorA: '#1e0803', colorB: '#8b2d13', atmosphere: '#ff7b3f', seed: 59.5, moon: true },
      { radius: 0.36, orbit: 4.6, speed: 0.17, inclination: -0.7, phase: 5.4, colorA: '#100908', colorB: '#69463f', atmosphere: '#d2a099', seed: 62.7 },
    ],
  },
  {
    name: 'Autonomy Pulsar',
    position: [-7.5, 1.2, -134],
    starColor: '#d8ff4f',
    starCore: '#ffffff',
    starSize: 0.54,
    starIntensity: 20,
    debris: 42,
    pulsar: true,
    planets: [
      { radius: 0.64, orbit: 2.7, speed: 0.2, inclination: 0.78, phase: 1.9, colorA: '#08100b', colorB: '#627d25', atmosphere: '#d8ff4f', seed: 71.3 },
      { radius: 0.29, orbit: 4.0, speed: -0.32, inclination: -0.45, phase: 4.2, colorA: '#121212', colorB: '#686868', atmosphere: '#f2efe8', seed: 73.9 },
    ],
  },
  {
    name: 'Apex System',
    position: [0, 0, -158],
    starColor: '#fff0c2',
    starCore: '#ffffff',
    starSize: 1.08,
    starIntensity: 24,
    debris: 138,
    binary: true,
    planets: [
      { radius: 0.48, orbit: 2.2, speed: 0.29, inclination: 0.25, phase: 0.4, colorA: '#241008', colorB: '#f06b25', atmosphere: '#ff9f58', seed: 81.1 },
      { radius: 1.12, orbit: 4.0, speed: 0.075, inclination: -0.3, phase: 2.7, colorA: '#12110d', colorB: '#b4a86e', atmosphere: '#fff4b0', seed: 88.4, rings: true, moon: true },
      { radius: 0.35, orbit: 5.35, speed: -0.16, inclination: 0.62, phase: 5.2, colorA: '#0c0f12', colorB: '#627785', atmosphere: '#b7ddff', seed: 94.7 },
    ],
  },
] as const;
