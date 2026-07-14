import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputDirectory = resolve(root, 'public', 'terrain');
const TERRAIN_SIZE = 112;
const SEGMENTS = {
  low: 400,
  medium: 560,
  high: 704,
};
// Keep these functions byte-for-byte equivalent in arithmetic order to the
// terrain helpers in HeroScene.tsx. PlaneGeometry stores its X/Y coordinates
// as float32 values before CinematicGround reads them, so generation mirrors
// that rounding below as well.
const SURFACE_BUMPS = [
  [-10, -6, 2.7, 0.78],
  [12, -9, 3.2, 0.96],
  [8, 8, 2.3, 0.62],
  [-15, 13, 4.1, 1.38],
  [17, 18, 4.6, 1.72],
  [-6, 21, 3.3, 1.24],
  [3.5, 15, 1.8, 0.46],
];

const hash2 = (x, y) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

function lerp(a, b, t) {
  return (1 - t) * a + t * b;
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function terrainFbm(x, y, octaves = 4) {
  let total = 0;
  let amplitude = 0.54;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, y * frequency) * amplitude;
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return total / normalizer;
}

function smoothstep(value, minimum, maximum) {
  const normalized = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
  return normalized * normalized * (3 - 2 * normalized);
}

function terrainHeight(x, y) {
  const distance = Math.sqrt(x * x + y * y);
  const centerMask = smoothstep(distance, 5.2, 9.5);
  const warpX = (terrainFbm(x * 0.045 + 11.2, y * 0.045 - 7.4, 3) - 0.5) * 5.4;
  const warpY = (terrainFbm(x * 0.045 - 19.1, y * 0.045 + 4.8, 3) - 0.5) * 5.4;
  const localRelief = lerp(0.22, 1, smoothstep(distance, 9, 22));
  const broad = (terrainFbm((x + warpX) * 0.09, (y + warpY) * 0.09, 5) - 0.5) * 0.96 * localRelief;
  const brokenRidges = Math.abs(terrainFbm((x - warpY) * 0.19 + 2.7, (y + warpX) * 0.19 - 8.3, 4) - 0.5) * 0.32 * localRelief;
  const gravel = (terrainFbm(x * 0.73 + warpX, y * 0.73 + warpY, 3) - 0.5) * 0.13;
  const craterA = -0.52 * Math.exp(-(((x + 10) ** 2 + (y + 5) ** 2) / 11));
  const craterB = -0.34 * Math.exp(-(((x - 13) ** 2 + (y - 7) ** 2) / 18));
  const angle = Math.atan2(y, x);
  const nearRidgeCenter = 27
    + Math.sin(angle * 3) * 2.7
    + Math.sin(angle * 7 + 0.8) * 1.25;
  const farRidgeCenter = 38
    + Math.sin(angle * 2 + 1.2) * 2.8
    + Math.sin(angle * 5 - 0.5) * 1.1;
  const nearRidgeBand = Math.exp(-((distance - nearRidgeCenter) ** 2) / 22);
  const nearRidgeProfile = Math.max(0, 1.65
    + Math.sin(angle * 5 + 1.3) * 1.05
    + Math.sin(angle * 11 - 0.4) * 0.58);
  const farRidgeBand = Math.exp(-((distance - farRidgeCenter) ** 2) / 18);
  const farRidgeProfile = Math.max(0, 1.05
    + Math.sin(angle * 4 - 0.7) * 0.66
    + Math.sin(angle * 9 + 0.2) * 0.34);
  const rim = Math.max(0, distance - 20) * 0.018;
  const ridges = nearRidgeBand * nearRidgeProfile + farRidgeBand * farRidgeProfile;
  const bumps = SURFACE_BUMPS.reduce((height, [bumpX, bumpY, radius, amplitude]) => {
    const dx = x - bumpX;
    const dy = y - bumpY;
    return height + Math.exp(-(dx * dx + dy * dy) / (radius * radius)) * amplitude;
  }, 0);
  return (broad + brokenRidges + gravel + craterA + craterB + rim + ridges + bumps) * centerMask - 0.12;
}

mkdirSync(outputDirectory, { recursive: true });

for (const [quality, segments] of Object.entries(SEGMENTS)) {
  const stride = segments + 1;
  const heights = new Float32Array(stride * stride);
  const segmentSize = TERRAIN_SIZE / segments;
  const halfSize = TERRAIN_SIZE / 2;
  let index = 0;
  for (let row = 0; row <= segments; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      // PlaneGeometry copies these values into a Float32BufferAttribute before
      // CinematicGround calls getX/getY.
      const x = Math.fround(column * segmentSize - halfSize);
      const y = Math.fround(halfSize - row * segmentSize);
      heights[index] = terrainHeight(x, y);
      index += 1;
    }
  }

  // Raw float32 is intentional: the high tier saves only about 12% with gzip,
  // while decompression adds another cold-start allocation and CPU burst.
  const bytes = Buffer.from(heights.buffer);
  const destination = resolve(outputDirectory, `mars-heights-${quality}.f32`);
  writeFileSync(destination, bytes);
  console.log(`${quality}: ${heights.length} samples, ${(bytes.byteLength / 1048576).toFixed(2)} MB`);
}
