'use client';

/**
 * CelestialVoyage — Distance-Based Sector Architecture.
 *
 * Celestial bodies are placed EXTREMELY far apart in 3D space (2400+ unit gaps).
 * Only the active sector ± 1 neighbor are mounted (conditional rendering).
 * Bodies naturally emerge from vast distance as the camera approaches — no opacity
 * crossfading, no popping, no crowded clutter.
 *
 * 7 celestial encounters scattered across ~15,600 units of deep space:
 *   Earth → Mars → Asteroid Field → Jupiter → Black Hole → Saturn → Neptune
 */

import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { flightState } from './spaceFlightState';
import { RealisticEarth } from './RealisticEarth';
import { RealisticMars } from './RealisticMars';
import { RealisticSpaceProbe } from './RealisticSpaceProbe';
import { RogueMeteoroids } from './RogueMeteoroids';
import { RealisticJupiter } from './RealisticJupiter';
import { GargantuaBlackHole } from './GargantuaBlackHole';
import { RealisticSaturn } from './RealisticSaturn';
import { RealisticNeptune } from './RealisticNeptune';

const SUN_POSITION: [number, number, number] = [400, 200, 300];

/**
 * 7 sectors, each containing one celestial body.
 * The first 85% of the spline is the outbound journey through all sectors.
 * The last 15% is the return arc (camera far above everything, no bodies mounted).
 */
const SECTOR_COUNT = 7;

const SECTOR_NAMES = [
  'SECTOR 01 // EARTH & LUNA',
  'SECTOR 02 // MARS & PHOBOS',
  'SECTOR 03 // ASTEROID BELT & DEEP PROBE',
  'SECTOR 04 // JUPITER & GALILEAN MOONS',
  'SECTOR 05 // GARGANTUA SUPERMASSIVE BLACK HOLE',
  'SECTOR 06 // SATURN RING SYSTEM',
  'SECTOR 07 // NEPTUNE ICE GIANT',
];

export function CelestialVoyage() {
  const [activeSector, setActiveSector] = useState(0);

  useFrame(() => {
    const u = flightState.progress;

    // Map u to sector index.
    // u in [0, 0.85) → sectors 0-6 (outbound journey through celestial bodies)
    // u in [0.85, 1.0) → sector -1 (return arc, nothing mounted)
    let sector: number;
    if (u > 0.85) {
      sector = -1;
    } else {
      sector = Math.min(
        SECTOR_COUNT - 1,
        Math.floor((u / 0.85) * SECTOR_COUNT),
      );
    }

    if (sector !== activeSector) {
      setActiveSector(sector);
      if (sector >= 0 && sector < SECTOR_NAMES.length) {
        flightState.activeSectorName = SECTOR_NAMES[sector];
      } else {
        flightState.activeSectorName = 'DEEP COSMIC VOID // RETURN ARC';
      }
    }
  });

  /**
   * Mount body at index `i` if it's within ±1 of the active sector.
   * Since bodies are 2400+ units apart, two mounted neighbors are never
   * simultaneously visible — the far one is a sub-pixel dot at most.
   */
  const mounted = (i: number): boolean => {
    if (activeSector < 0) return false;
    return Math.abs(activeSector - i) <= 1;
  };

  return (
    <group name="celestial-voyage">
      {/* Solar key light — primary illumination for all bodies */}
      <directionalLight position={SUN_POSITION} intensity={3.5} color="#fff6ee" />
      {/* Ambient fill — very subtle, prevents pure-black shadow regions */}
      <ambientLight intensity={0.18} color="#1a2030" />
      {/* Hemisphere light — sky-blue from above, warm earth-tone from below.
          Simulates indirect starlight and reflected cosmic glow on shadow faces. */}
      <hemisphereLight args={['#1a2844', '#0d0a06', 0.35]} />

      {/* Sector 0: Earth & Luna — upper-right quadrant */}
      {mounted(0) && (
        <RealisticEarth
          position={[120, 50, -1200]}
          radius={14}
          sunPosition={SUN_POSITION}
        />
      )}

      {/* Sector 1: Mars & Phobos — lower-left quadrant */}
      {mounted(1) && (
        <RealisticMars
          position={[-150, -30, -3600]}
          radius={10}
          sunPosition={SUN_POSITION}
        />
      )}

      {/* Sector 2: Rogue Asteroid Belt & Deep Space Probe — upper center */}
      {mounted(2) && (
        <>
          <RogueMeteoroids />
          <RealisticSpaceProbe
            position={[60, 90, -6100]}
            scale={1.8}
            rotationSpeed={0.03}
          />
        </>
      )}

      {/* Sector 3: Jupiter & Galilean Moons — lower-left, massive */}
      {mounted(3) && (
        <RealisticJupiter
          position={[-120, -60, -8400]}
          radius={24}
          sunPosition={SUN_POSITION}
        />
      )}

      {/* Sector 4: Gargantua Supermassive Black Hole — center-right */}
      {mounted(4) && (
        <GargantuaBlackHole
          position={[80, 20, -10800]}
          radius={18}
        />
      )}

      {/* Sector 5: Saturn & Ring System — upper-left */}
      {mounted(5) && (
        <RealisticSaturn
          position={[-100, 70, -13200]}
          radius={18}
          sunPosition={SUN_POSITION}
        />
      )}

      {/* Sector 6: Neptune Ice Giant — lower-right */}
      {mounted(6) && (
        <RealisticNeptune
          position={[140, -50, -15600]}
          radius={16}
          sunPosition={SUN_POSITION}
        />
      )}
    </group>
  );
}
