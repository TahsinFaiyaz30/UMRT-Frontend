/** Offline preparation of real MESSENGER Mercury surface maps.
 * Run: node scripts/prepare-mercury-relief.mjs [cache-directory]
 * No runtime downloads of the source archive and no invented terrain.
 * Provenance, projection and radiometric limitations: solar/SOURCES.md.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Keep this separate from Next's build directory: starting a dev/build process
// can clear .next while a long, resumable archive download is still running.
const cache = path.resolve(process.argv[2] ?? 'output/playwright/solar-source-cache');
const output = path.resolve('public/textures/solar');
const archiveName = 'mercury-dem-complete.tif';
const archiveUrl = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif';
const tileBase = 'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0/default/default028mm/4';
const sourceWidth = 23040, sourceHeight = 11520, headerBytes = 92981;
const archiveBytes = headerBytes + sourceWidth * sourceHeight * 2;
const width = 4096, height = 2048, radiusMeters = 2439400;

async function size(file) { return (await fs.stat(file).catch(() => null))?.size ?? 0; }
function download(url, file, range) {
  return new Promise((resolve, reject) => {
    const args = ['--fail', '--location', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '120'];
    if (range) args.push('--range', range);
    args.push('--output', file, url);
    const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', args, { windowsHide: true });
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', reject);
    child.on('close', (code) => code ? reject(new Error(`Download failed (${code}): ${url}`)) : resolve());
  });
}

async function prepareArchive() {
  const file = path.join(cache, archiveName);
  if (await size(file) === archiveBytes) return file;
  const chunk = 1024 * 1024, count = Math.ceil(archiveBytes / chunk);
  let next = 0;
  // Bounded ranges avoid archive endpoints stalling on very large responses.
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (next < count) {
      const index = next++, start = index * chunk, end = Math.min(archiveBytes, start + chunk) - 1;
      const part = `${file}.${index}`;
      if (await size(part) === end - start + 1) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await download(archiveUrl, part, `${start}-${end}`);
          if (await size(part) !== end - start + 1) throw new Error('Incomplete Mercury archive range');
          break;
        } catch (error) { if (attempt === 2) throw error; }
      }
    }
  }));
  const handle = await fs.open(file, 'w');
  try {
    for (let index = 0; index < count; index++) await handle.write(await fs.readFile(`${file}.${index}`));
  } finally { await handle.close(); }
  if (await size(file) !== archiveBytes) throw new Error('Incomplete Mercury archive');
  return file;
}

async function prepareAlbedo() {
  const directory = path.join(cache, 'mercury-tiles');
  await fs.mkdir(directory, { recursive: true });
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < 512) {
      const index = next++, row = Math.floor(index / 32), col = index % 32;
      const file = path.join(directory, `${row}-${col}.jpg`);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (await size(file) < 100) await download(`${tileBase}/${row}/${col}.jpg`, file);
          const metadata = await sharp(file).metadata();
          if (metadata.width !== 256 || metadata.height !== 256) throw new Error('Invalid Mercury tile');
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          await fs.unlink(file).catch(() => {});
        }
      }
    }
  }));
  const tiles = [];
  for (let row = 0; row < 16; row++) for (let col = 0; col < 32; col++) {
    // Trek's -180..180 grid is half-turned to the existing 0..360 surface UVs.
    tiles.push({ input: path.join(directory, `${row}-${col}.jpg`), left: ((col + 16) % 32) * 256, top: row * 256 });
  }
  await sharp({ create: { width: 8192, height: 4096, channels: 3, background: '#000' } })
    .composite(tiles).webp({ quality: 97, effort: 6 }).toFile(path.join(output, 'mercury.webp'));
  console.log('Mercury albedo: real 8192x4096 NASA Trek MDIS BDR mosaic, 0..360 degrees east.');
}

async function prepareRelief(file) {
  const input = await fs.readFile(file);
  if (input.length !== archiveBytes) throw new Error('Unexpected Mercury DEM archive size');
  // Validate the actual TIFF structure before treating it as a raw raster.
  // The source is one uncompressed int16 row per strip. Its embedded GDAL
  // metadata supplies the 0.5 m DN multiplier and zero vertical offset.
  if (input.toString('ascii', 0, 2) !== 'II') throw new Error('Unexpected DEM byte order');
  if (input.readUInt16LE(2) !== 42) throw new Error('Unexpected TIFF format');
  const ifd = input.readUInt32LE(4), tags = new Map();
  for (let i = 0; i < input.readUInt16LE(ifd); i++) {
    const p = ifd + 2 + i * 12;
    tags.set(input.readUInt16LE(p), { type: input.readUInt16LE(p + 2), count: input.readUInt32LE(p + 4), value: input.readUInt32LE(p + 8) });
  }
  for (const [tag, value] of [[256, sourceWidth], [257, sourceHeight], [258, 16], [259, 1], [277, 1], [278, 1], [339, 2]]) {
    if (tags.get(tag)?.count !== 1 || tags.get(tag)?.value !== value) throw new Error(`Unexpected Mercury TIFF tag ${tag}`);
  }
  const offsets = tags.get(273), counts = tags.get(279);
  if (offsets?.type !== 4 || counts?.type !== 4 || offsets.count !== sourceHeight || counts.count !== sourceHeight) throw new Error('Unexpected TIFF strips');
  for (let y = 0; y < sourceHeight; y++) {
    if (input.readUInt32LE(offsets.value + y * 4) !== headerBytes + y * sourceWidth * 2 || input.readUInt32LE(counts.value + y * 4) !== sourceWidth * 2) throw new Error(`Non-contiguous DEM strip ${y}`);
  }
  const metadata = tags.get(42112), nodata = tags.get(42113);
  const metadataText = input.toString('ascii', metadata.value, metadata.value + metadata.count);
  if (!/role="scale">0\.5<\/Item>/.test(metadataText) || !/role="offset">0<\/Item>/.test(metadataText) || input.toString('ascii', nodata.value, nodata.value + nodata.count).replace(/\0/g, '') !== '-32768') throw new Error('Unexpected DEM vertical units');
  const geoKeys = tags.get(34735), geoDoubles = tags.get(34736);
  const keys = new Map();
  for (let i = 0; i < input.readUInt16LE(geoKeys.value + 6); i++) {
    const p = geoKeys.value + 8 + i * 8;
    keys.set(input.readUInt16LE(p), input.readUInt16LE(p + 2) === 34736 ? input.readDoubleLE(geoDoubles.value + input.readUInt16LE(p + 6) * 8) : input.readUInt16LE(p + 6));
  }
  const pixelScale = tags.get(33550), tiepoint = tags.get(33922);
  if (keys.get(2057) !== radiusMeters || keys.get(2058) !== radiusMeters || keys.get(3088) !== 180 || keys.get(3089) !== 0
      || Math.abs(input.readDoubleLE(pixelScale.value) * sourceWidth - 2 * Math.PI * radiusMeters) > 1
      || Math.abs(input.readDoubleLE(tiepoint.value + 24) + Math.PI * radiusMeters) > 1
      || Math.abs(input.readDoubleLE(tiepoint.value + 32) - Math.PI * radiusMeters / 2) > 1) throw new Error('Unexpected DEM longitude/latitude registration');
  const reduced = new Float32Array(width * height), valid = new Uint8Array(width * height);
  const sx = sourceWidth / width, sy = sourceHeight / height;
  let minMeters = Infinity, maxMeters = -Infinity, missingCells = 0;
  for (let y = 0; y < height; y++) {
    const top = y * sy, bottom = (y + 1) * sy;
    for (let x = 0; x < width; x++) {
      const left = x * sx, right = (x + 1) * sx;
      let sum = 0, weight = 0;
      for (let yy = Math.floor(top); yy < Math.ceil(bottom); yy++) {
        const wy = Math.min(bottom, yy + 1) - Math.max(top, yy);
        for (let xx = Math.floor(left); xx < Math.ceil(right); xx++) {
          const dn = input.readInt16LE(headerBytes + (yy * sourceWidth + xx) * 2);
          if (dn === -32768) continue;
          const wx = Math.min(right, xx + 1) - Math.max(left, xx), meters = dn * 0.5;
          sum += meters * wx * wy; weight += wx * wy;
          minMeters = Math.min(minMeters, meters); maxMeters = Math.max(maxMeters, meters);
        }
      }
      const index = y * width + x;
      if (weight) { reduced[index] = sum / weight; valid[index] = 1; } else missingCells++;
    }
  }
  if (minMeters < -10000 || maxMeters > 10000 || minMeters > -1000 || maxMeters < 1000) {
    throw new Error(`Unexpected measured Mercury range ${minMeters} to ${maxMeters}`);
  }
  // The source should have global coverage. Never manufacture relief if its
  // coverage, nodata encoding or binary layout changes in a future revision.
  if (missingCells) throw new Error(`Mercury DEM has ${missingCells} unresolved output cells; review source coverage`);
  const normal = Buffer.alloc(width * height * 3), angularStep = 2 * Math.PI / width;
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * (0.5 - (y + 0.5) / height);
    const eastDistance = 2 * radiusMeters * Math.cos(latitude) * angularStep;
    const north = Math.max(0, y - 1), south = Math.min(height - 1, y + 1);
    const northDistance = (south - north) * radiusMeters * angularStep;
    for (let x = 0; x < width; x++) {
      const nx = -(reduced[y * width + (x + 1) % width] - reduced[y * width + (x + width - 1) % width]) / eastDistance;
      const ny = -(reduced[north * width + x] - reduced[south * width + x]) / northDistance;
      const length = Math.hypot(nx, ny, 1), index = (y * width + x) * 3;
      normal[index] = Math.round((nx / length * 0.5 + 0.5) * 255);
      normal[index + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      normal[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
    }
  }
  const packedWidth = 1024, packedHeight = 512, packed = Buffer.alloc(packedWidth * packedHeight * 3);
  for (let y = 0; y < packedHeight; y++) for (let x = 0; x < packedWidth; x++) {
    let sum = 0;
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) sum += reduced[(y * 4 + yy) * width + x * 4 + xx];
    const dn = Math.round((sum / 16 + 10000) * 2), index = (y * packedWidth + x) * 3;
    if (dn < 0 || dn > 65535) throw new Error('Mercury height exceeds packed encoding');
    packed[index] = dn >> 8; packed[index + 1] = dn & 255;
  }
  for (const [suffix, buffer, w, h] of [['normal', normal, width, height], ['height', packed, packedWidth, packedHeight]]) {
    const target = path.join(output, `mercury-${suffix}.webp`);
    await sharp(buffer, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(target);
    if (!(await sharp(target).raw().toBuffer()).equals(buffer)) throw new Error(`Mercury ${suffix} data encoding changed`);
  }
  console.log(JSON.stringify({ minMeters, maxMeters, missingCells, radiusMeters, sourceSha256: createHash('sha256').update(input).digest('hex') }));
}

await fs.mkdir(cache, { recursive: true });
await fs.mkdir(output, { recursive: true });
const file = await prepareArchive();
await prepareRelief(file);
await prepareAlbedo();
