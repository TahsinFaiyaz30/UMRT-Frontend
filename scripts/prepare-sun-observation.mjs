/** Offline, observed AIA 304 solar atlas. See public/textures/solar/SOURCES.md.
 * Three northern-view dates sample different rotation phases. A March image
 * supplies observed south-polar coverage only, feathered below 55 S. This is a
 * historical composite, not a simultaneous observation or a calibrated map.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const cache = path.resolve('output/playwright/solar-source-cache');
const output = path.resolve('public/textures/solar');
await fs.mkdir(cache, { recursive: true });
const captures = [
  ['2026/08/31', '20260831_000906_4096_0304.jpg', -9, 7.2, false],
  ['2026/09/09', '20260909_000906_4096_0304.jpg', 0, 7.2, false],
  ['2026/09/18', '20260918_000930_4096_0304.jpg', 9, 7.2, false],
  ['2026/03/07', '20260307_010942_4096_0304.jpg', -186, -7.2, true],
];
const images = [];
const PI = Math.PI, W = 8192, H = 4096;
const linear = Float64Array.from({ length: 256 }, (_, n) => n / 255 <= .04045 ? n / 255 / 12.92 : ((n / 255 + .055) / 1.055) ** 2.4);
const display = Uint8Array.from({ length: 65536 }, (_, n) => Math.round(255 * (n / 65535 <= .0031308 ? n / 65535 * 12.92 : 1.055 * (n / 65535) ** (1 / 2.4) - .055)));
const get = (data, x, y, channel) => data[(Math.max(0, Math.min(4095, y)) * 4096 + Math.max(0, Math.min(4095, x))) * 3 + channel];
const smooth = (lo, hi, value) => { const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

for (const [directory, filename, days, b0Degrees, polarOnly] of captures) {
  const url = `https://sdo.gsfc.nasa.gov/assets/img/browse/${directory}/${filename}`;
  const file = path.join(cache, filename);
  if ((await fs.stat(file).catch(() => null))?.size < 1_000_000 || !await fs.stat(file).catch(() => null)) {
    await new Promise((resolve, reject) => {
      const child = spawn('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--max-time', '120', url, '--output', file], { windowsHide: true });
      child.on('error', reject); child.on('close', code => code ? reject(new Error(`Download ${filename}: ${code}`)) : resolve());
    });
  }
  const bytes = await fs.readFile(file);
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 4096 || info.height !== 4096 || info.channels !== 3) throw new Error('Unexpected SDO image dimensions');
  // Median radial gradient rejects isolated off-limb prominences and selects
  // the observed disk boundary. The north-up browse images are centred at 2048.
  let radius = 1600, strongest = -Infinity;
  for (let r = 1540; r <= 1640; r++) {
    const gradients = [];
    for (let i = 0; i < 120; i++) {
      const angle = i * 2 * PI / 120, c = Math.cos(angle), s = Math.sin(angle);
      const inside = get(data, Math.round(2048 + c * (r - 5)), Math.round(2048 + s * (r - 5)), 0);
      const outside = get(data, Math.round(2048 + c * (r + 5)), Math.round(2048 + s * (r + 5)), 0);
      gradients.push(inside - outside);
    }
    gradients.sort((a, b) => a - b);
    if (gradients[60] > strongest) { strongest = gradients[60]; radius = r; }
  }
  // Nominal synodic Carrington rotation and near-equinox B0. These are display
  // registration approximations; no calibrated WCS/ephemeris claim is made.
  images.push({ data, radius, longitude: days * 2 * PI / 27.2753, b0: b0Degrees * PI / 180, polarOnly, url,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(filename, 'disk radius', radius);
}

const trig = images.map(image => ({
  x: Float64Array.from({ length: W }, (_, col) => Math.sin(2 * PI * (col + .5) / W - PI / 2 - image.longitude)),
  z: Float64Array.from({ length: W }, (_, col) => Math.cos(2 * PI * (col + .5) / W - PI / 2 - image.longitude)),
}));
const rgb = Buffer.alloc(W * H * 3);
const rowColours = new Float64Array(W * 3), rowCoverage = new Float64Array(W);
let missing = 0, missingArea = 0, totalArea = 0, feathered = 0;
for (let row = 0; row < H; row++) {
  const latitude = PI * (.5 - (row + .5) / H), sinLat = Math.sin(latitude), cosLat = Math.cos(latitude);
  const polarWeight = smooth(55, 75, -latitude * 180 / PI);
  let meanRed = 0, meanGreen = 0, meanBlue = 0, meanWeight = 0;
  for (let col = 0; col < W; col++) {
    let red = 0, green = 0, blue = 0, sum = 0, bestFacing = 0;
    for (let view = 0; view < images.length; view++) {
      const image = images[view], x = trig[view].x[col] * cosLat, z = trig[view].z[col] * cosLat;
      if (image.polarOnly && polarWeight === 0) continue;
      const facing = z * Math.cos(image.b0) + sinLat * Math.sin(image.b0);
      if (facing <= .035) continue;
      bestFacing = Math.max(bestFacing, facing * (image.polarOnly ? polarWeight : 1));
      const y = sinLat * Math.cos(image.b0) - z * Math.sin(image.b0);
      const sx = 2048 + image.radius * x, sy = 2048 - image.radius * y;
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const weight = (facing - .035) ** 8 * (image.polarOnly ? polarWeight : 1);
      const a = (iy * 4096 + ix) * 3, b = a + 3, c = a + 4096 * 3, d = c + 3;
      const w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
      const data = image.data;
      red += weight * (linear[data[a]] * w0 + linear[data[b]] * w1 + linear[data[c]] * w2 + linear[data[d]] * w3);
      green += weight * (linear[data[a + 1]] * w0 + linear[data[b + 1]] * w1 + linear[data[c + 1]] * w2 + linear[data[d + 1]] * w3);
      blue += weight * (linear[data[a + 2]] * w0 + linear[data[b + 2]] * w1 + linear[data[c + 2]] * w2 + linear[data[d + 2]] * w3);
      sum += weight;
    }
    const p = col * 3;
    totalArea += cosLat;
    if (sum > 1e-28) {
      rowColours[p] = red / sum;
      rowColours[p + 1] = green / sum;
      rowColours[p + 2] = blue / sum;
      const confidence = smooth(.035, .12, bestFacing);
      rowCoverage[col] = confidence;
      meanRed += rowColours[p] * confidence;
      meanGreen += rowColours[p + 1] * confidence;
      meanBlue += rowColours[p + 2] * confidence;
      meanWeight += confidence;
      if (confidence < .999) feathered++;
    } else {
      rowColours[p] = rowColours[p + 1] = rowColours[p + 2] = 0;
      rowCoverage[col] = 0;
      missing++; missingArea += cosLat; feathered++;
    }
  }
  if (meanWeight === 0) throw new Error(`No observed colour available for latitude ${latitude * 180 / PI}`);
  // One southern image cannot see every longitude in the transition band.
  // Unknown/edge-on patches tend smoothly to this row's observed mean colour.
  // This deliberately supplies no invented texture in unobserved areas.
  meanRed /= meanWeight; meanGreen /= meanWeight; meanBlue /= meanWeight;
  for (let col = 0; col < W; col++) {
    const source = col * 3, p = (row * W + col) * 3, weight = rowCoverage[col];
    rgb[p] = display[Math.min(65535, Math.round((meanRed * (1 - weight) + rowColours[source] * weight) * 65535))];
    rgb[p + 1] = display[Math.min(65535, Math.round((meanGreen * (1 - weight) + rowColours[source + 1] * weight) * 65535))];
    rgb[p + 2] = display[Math.min(65535, Math.round((meanBlue * (1 - weight) + rowColours[source + 2] * weight) * 65535))];
  }
}
await fs.mkdir(output, { recursive: true });
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 97, effort: 6 }).toFile(path.join(output, 'sun-aia304.webp'));
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(2048).png().toFile(path.join(cache, 'sun-atlas-review.png'));

// Inspector targets are measured bright patches in the central observation,
// not the unrelated procedural sunspot coordinates of the old renderer.
const primary = images[1], candidates = [], selected = [];
for (let y = 800; y < 3296; y += 24) for (let x = 800; x < 3296; x += 24) {
  const px = (x - 2048) / primary.radius, py = (2048 - y) / primary.radius;
  if (px * px + py * py > .65) continue;
  let score = 0;
  for (let j = -12; j <= 12; j += 4) for (let i = -12; i <= 12; i += 4) score += get(primary.data, x + i, y + j, 1);
  candidates.push({ x, y, px, py, score });
}
candidates.sort((a, b) => b.score - a.score);
for (const candidate of candidates) {
  if (selected.every(v => Math.hypot(v.x - candidate.x, v.y - candidate.y) > 280)) selected.push(candidate);
  if (selected.length === 8) break;
}
const directions = selected.map(({ px, py }) => {
  const z = Math.sqrt(1 - px * px - py * py);
  return [px, py * Math.cos(primary.b0) + z * Math.sin(primary.b0), z * Math.cos(primary.b0) - py * Math.sin(primary.b0)].map(v => +v.toFixed(7));
});
await fs.writeFile('components/team/space/solarObservation.ts', `/** Generated by prepare-sun-observation.mjs; observed bright-region directions. */\nexport const SOLAR_OBSERVATION_REGIONS: readonly (readonly [number, number, number])[] = ${JSON.stringify(directions)};\n`);
await fs.writeFile(path.join(output, 'sun-observation.json'), JSON.stringify({ type: 'historical AIA 304 false-colour composite', dimensions: [W, H], missingFraction: missing / (W * H), missingSurfaceFraction: missingArea / totalArea, featheredFraction: feathered / (W * H), polarBlend: 'March observation contributes only south of 55 degrees, reaching full weight at 75 degrees. Residual unseen/edge-on patches fade to latitude-wise observed mean colour without invented texture.', observations: images.map(({ data, ...image }) => image), focusDirections: directions }, null, 2) + '\n');
console.log('Wrote observed solar atlas', W, H, 'unobserved atlas fraction', missing / (W * H), 'unobserved surface fraction', missingArea / totalArea, 'feathered fraction', feathered / (W * H));
