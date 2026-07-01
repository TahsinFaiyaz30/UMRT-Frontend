'use client';

import { forwardRef, useMemo } from 'react';
import type { Quality } from '@/lib/performance';
import { fogDensityFor, particleCountFor } from '@/lib/performance';
import { ModelRig, ModelRigHandle } from './ModelRig';
import {
  MarsGround,
  MarsRocks,
  MarsDust,
  MarsSky,
  MarsHorizonHaze,
  MarsLighting,
  type RockData,
} from './MarsTerrain';

// All rocks defined as data — rendered in a single instanced draw call
const ROCKS: RockData[] = [
  // Foreground pebbles
  { position: [-1.5, 0.02, -2], scale: 0.12, seed: 50, colorIndex: 0 },
  { position: [2, 0.02, -1.5], scale: 0.08, seed: 51, colorIndex: 1 },
  { position: [-0.8, 0.02, 1], scale: 0.1, seed: 52, colorIndex: 2 },
  { position: [1.2, 0.02, 2], scale: 0.15, seed: 53, colorIndex: 0 },
  { position: [-2.5, 0.02, -1], scale: 0.18, seed: 54, colorIndex: 1 },
  { position: [3, 0.02, 0.5], scale: 0.09, seed: 55, colorIndex: 2 },
  { position: [0.5, 0.02, 3], scale: 0.07, seed: 56, colorIndex: 0 },
  { position: [-1, 0.02, -3.5], scale: 0.13, seed: 57, colorIndex: 1 },
  // Near-field
  { position: [-4, 0.1, -5], scale: 0.7, seed: 1, colorIndex: 0 },
  { position: [5, 0.1, -6], scale: 0.9, seed: 2, colorIndex: 1 },
  { position: [-6, 0.08, -3], scale: 0.45, seed: 3, colorIndex: 0 },
  { position: [7, 0.08, -2], scale: 0.55, seed: 4, colorIndex: 2 },
  { position: [-3.5, 0.06, 4], scale: 0.35, seed: 58, colorIndex: 1 },
  { position: [4.5, 0.06, 5], scale: 0.4, seed: 59, colorIndex: 0 },
  // Mid-field clusters
  { position: [-11, 0.3, -8], scale: 2.5, seed: 5, colorIndex: 0 },
  { position: [-9.5, 0.2, -7], scale: 1.4, seed: 6, colorIndex: 1 },
  { position: [-10.5, 0.15, -9.5], scale: 1.0, seed: 7, colorIndex: 2 },
  { position: [10, 0.25, -10], scale: 2.0, seed: 8, colorIndex: 0 },
  { position: [12, 0.15, -11], scale: 1.2, seed: 9, colorIndex: 1 },
  { position: [9, 0.1, -12], scale: 0.7, seed: 10, colorIndex: 2 },
  // Background mountains
  { position: [-18, 0.5, -15], scale: 4.5, seed: 11, colorIndex: 0 },
  { position: [-20, 0.4, -14], scale: 3.0, seed: 12, colorIndex: 1 },
  { position: [16, 0.5, -18], scale: 3.8, seed: 13, colorIndex: 0 },
  { position: [20, 0.3, -16], scale: 2.2, seed: 14, colorIndex: 2 },
  { position: [0, 0.6, -22], scale: 4.0, seed: 15, colorIndex: 1 },
  { position: [-5, 0.4, -24], scale: 2.5, seed: 64, colorIndex: 0 },
  { position: [7, 0.5, -25], scale: 3.2, seed: 65, colorIndex: 2 },
  // Scattered
  { position: [-8, 0.08, 2], scale: 0.5, seed: 22, colorIndex: 0 },
  { position: [9, 0.07, 5], scale: 0.4, seed: 23, colorIndex: 1 },
  { position: [-14, 0.15, 6], scale: 1.0, seed: 66, colorIndex: 2 },
  { position: [13, 0.12, 8], scale: 0.8, seed: 67, colorIndex: 0 },
  // Far horizon
  { position: [-25, 0.6, 0], scale: 3.5, seed: 24, colorIndex: 0 },
  { position: [28, 0.5, -5], scale: 2.8, seed: 25, colorIndex: 1 },
  { position: [-22, 0.4, 8], scale: 2.2, seed: 26, colorIndex: 2 },
  { position: [24, 0.35, 10], scale: 2.0, seed: 27, colorIndex: 0 },
  { position: [-30, 0.8, -10], scale: 5.0, seed: 70, colorIndex: 0 },
  { position: [32, 0.7, -8], scale: 4.2, seed: 71, colorIndex: 1 },
  { position: [0, 0.9, -35], scale: 6.0, seed: 74, colorIndex: 1 },
  { position: [-15, 0.6, -30], scale: 4.0, seed: 75, colorIndex: 2 },
  { position: [18, 0.5, -32], scale: 3.5, seed: 76, colorIndex: 0 },
];

/**
 * Full Mars scene — optimized:
 *   - 1 instanced draw call for all rocks
 *   - 1 Points draw call for all dust
 *   - 2 texture maps (color + normal) at 256px
 *   - ~8 total draw calls
 */
export const HeroScene = forwardRef<ModelRigHandle, { quality: Quality }>(function HeroScene(
  { quality },
  ref,
) {
  const dustCount = particleCountFor(quality);
  const fogDensity = fogDensityFor(quality);

  return (
    <>
      <color attach="background" args={['#4A2818']} />
      <fogExp2 attach="fog" args={['#B08050', fogDensity * 0.35]} />

      <MarsLighting quality={quality} />
      <MarsSky />
      <MarsHorizonHaze />

      <MarsGround
        size={200}
        heightScale={0.6}
        quality={quality}
      />

      {/* All rocks in 1 draw call */}
      <MarsRocks rocks={ROCKS} />

      {/* All dust in 1 draw call */}
      <MarsDust count={Math.min(dustCount, 150)} spread={35} height={6} />

      <ModelRig ref={ref} running />
    </>
  );
});
