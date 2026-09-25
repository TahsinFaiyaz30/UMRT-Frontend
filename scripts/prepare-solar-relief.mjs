/**
 * Prepare the committed measured Moon/Mars relief and Hubble Jupiter assets.
 * Run: node scripts/prepare-solar-relief.mjs [cache-directory]
 * Sources, coordinate conventions, coverage and limitations: solar/SOURCES.md.
 * This is an offline preparation step, never part of page load or a build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const cache = path.resolve(process.argv[2] ?? '.next/solar-relief-source');
const output = path.resolve('public/textures/solar');
const sourceWidth = 5760, sourceHeight = 2880;
const sourceBytes = sourceWidth * sourceHeight * 2;
const products = [
  {
    id: 'moon', littleEndian: true, meterScale: 0.5, radiusMeters: 1737400,
    heightOffset: -10000, heightScale: 0.5,
    url: 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img',
  },
  {
    id: 'mars', littleEndian: false, meterScale: 1, radiusMeters: 3396000,
    heightOffset: -12000, heightScale: 1,
    url: 'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img',
  },
];

function curl(url, file, range) {
  return new Promise((resolve, reject) => {
    const args = ['--fail', '--location', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '40'];
    if (range) args.push('--range', range);
    args.push('--output', file, url);
    const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', args, { windowsHide: true });
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Download failed (${code}): ${url}`)));
  });
}

async function downloadGrid(product) {
  const file = path.join(cache, `${product.id}-height.img`);
  if ((await fs.stat(file).catch(() => null))?.size === sourceBytes) return fs.readFile(file);
  // Some institutional archives stall on long responses. Bounded, validated
  // ranges provide reproducible downloads without leaving a partial final file.
  const chunkSize = 1024 * 1024, count = Math.ceil(sourceBytes / chunkSize);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < count) {
      const index = next++, start = index * chunkSize, end = Math.min(sourceBytes, start + chunkSize) - 1;
      const part = `${file}.${index}`;
      if ((await fs.stat(part).catch(() => null))?.size === end - start + 1) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await curl(product.url, part, `${start}-${end}`);
          if ((await fs.stat(part)).size !== end - start + 1) throw new Error('Incomplete archive range');
          break;
        } catch (error) { if (attempt === 2) throw error; }
      }
    }
  }));
  const data = Buffer.concat(await Promise.all(Array.from({ length: count }, (_, index) => fs.readFile(`${file}.${index}`))));
  if (data.length !== sourceBytes) throw new Error(`Incomplete ${product.id} grid`);
  await fs.writeFile(file, data);
  return data;
}

/** Pixel-area resampling preserves the mean measured height and avoids
 * inventing high-frequency craters when reducing the actual survey grid. */
function areaResize(source, width, height) {
  const result = new Float32Array(width * height);
  const sx = sourceWidth / width, sy = sourceHeight / height;
  for (let y = 0; y < height; y++) {
    const top = y * sy, bottom = (y + 1) * sy;
    for (let x = 0; x < width; x++) {
      const left = x * sx, right = (x + 1) * sx;
      let sum = 0;
      for (let yy = Math.floor(top); yy < Math.ceil(bottom); yy++) {
        const wy = Math.min(bottom, yy + 1) - Math.max(top, yy);
        for (let xx = Math.floor(left); xx < Math.ceil(right); xx++) {
          const wx = Math.min(right, xx + 1) - Math.max(left, xx);
          sum += source[yy * sourceWidth + xx] * wx * wy;
        }
      }
      result[y * width + x] = sum / (sx * sy);
    }
  }
  return result;
}

async function prepareRelief(product) {
  const bytes = await downloadGrid(product);
  const heights = new Float32Array(sourceWidth * sourceHeight);
  let minMeters = Infinity, maxMeters = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    const value = (product.littleEndian ? bytes.readInt16LE(i * 2) : bytes.readInt16BE(i * 2)) * product.meterScale;
    heights[i] = value;
    minMeters = Math.min(minMeters, value); maxMeters = Math.max(maxMeters, value);
  }
  if (minMeters < -10000 || maxMeters > 22000 || minMeters > -1000 || maxMeters < 5000) {
    throw new Error(`${product.id}: unexpected measured elevation range ${minMeters} to ${maxMeters}`);
  }
  const width = 4096, height = 2048, reduced = areaResize(heights, width, height);
  const normals = Buffer.alloc(width * height * 3);
  const angularStep = 2 * Math.PI / width;
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * (0.5 - (y + 0.5) / height);
    const eastDistance = 2 * product.radiusMeters * Math.cos(latitude) * angularStep;
    const north = Math.max(0, y - 1), south = Math.min(height - 1, y + 1);
    const northDistance = (south - north) * product.radiusMeters * angularStep;
    for (let x = 0; x < width; x++) {
      const west = (x + width - 1) % width, east = (x + 1) % width;
      const nx = -(reduced[y * width + east] - reduced[y * width + west]) / eastDistance;
      const ny = -(reduced[north * width + x] - reduced[south * width + x]) / northDistance;
      const length = Math.hypot(nx, ny, 1), offset = (y * width + x) * 3;
      normals[offset] = Math.round((nx / length * 0.5 + 0.5) * 255);
      normals[offset + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      normals[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
    }
  }
  await sharp(normals, { raw: { width, height, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(path.join(output, `${product.id}-normal.webp`));
  const packedWidth = 1024, packedHeight = 512;
  const packedHeights = areaResize(heights, packedWidth, packedHeight);
  const packed = Buffer.alloc(packedWidth * packedHeight * 3);
  for (let i = 0; i < packedHeights.length; i++) {
    const dn = Math.round((packedHeights[i] - product.heightOffset) / product.heightScale);
    if (dn < 0 || dn > 65535) throw new Error('Elevation does not fit documented encoding');
    packed[i * 3] = dn >> 8; packed[i * 3 + 1] = dn & 255;
  }
  await sharp(packed, { raw: { width: packedWidth, height: packedHeight, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(path.join(output, `${product.id}-height.webp`));
  // Verify that the encoded data is preserved, including both height bytes.
  for (const [suffix, expected] of [['normal', normals], ['height', packed]]) {
    const decoded = await sharp(path.join(output, `${product.id}-${suffix}.webp`)).raw().toBuffer();
    if (!decoded.equals(expected)) throw new Error(`${product.id}-${suffix}: non-lossless data encoding`);
  }
  console.log(JSON.stringify({ id: product.id, minMeters, maxMeters, sourceSha256: createHash('sha256').update(bytes).digest('hex'), sourceWidth, sourceHeight, width, height }));
}

async function prepareJupiter() {
  const hubbleFile = path.join(cache, 'jupiter-hubble.jpg');
  if (!(await fs.stat(hubbleFile).catch(() => null))) {
    await curl('https://cdn.esahubble.org/archives/images/large/heic1914b.jpg', hubbleFile);
  }
  const noaaFile = path.join(cache, 'jupiter-noaa.jpg');
  if (!(await fs.stat(noaaFile).catch(() => null))) {
    await curl('https://sos.noaa.gov/ftp_mirror/astronomy/jupiter/still/4096.jpg', noaaFile);
  }
  const { data: source, info } = await sharp(hubbleFile).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 7200 || info.height !== 3196 || info.channels !== 3) throw new Error('Unexpected Hubble map dimensions');
  const width = 7200, height = 3600, margin = (height - info.height) / 2, blendRows = 40;
  const noaa = await sharp(noaaFile).resize(width, height).toColourspace('srgb').removeAlpha().raw().toBuffer();
  const result = Buffer.from(noaa);
  for (let y = 0; y < info.height; y++) {
    const ramp = Math.min(1, y / blendRows, (info.height - 1 - y) / blendRows);
    const weight = ramp * ramp * (3 - 2 * ramp);
    for (let x = 0; x < width; x++) for (let channel = 0; channel < 3; channel++) {
      const target = ((y + margin) * width + x) * 3 + channel;
      result[target] = Math.round(noaa[target] * (1 - weight) + source[(y * width + x) * 3 + channel] * weight);
    }
  }
  await sharp(result, { raw: { width, height, channels: 3 } }).webp({ quality: 97, effort: 6 }).toFile(path.join(output, 'jupiter.webp'));
  console.log('Jupiter: native 7200px Hubble2019 cloud detail, documented NOAA polar coverage, 2 degree transition.');
}

await fs.mkdir(cache, { recursive: true });
await fs.mkdir(output, { recursive: true });
for (const product of products) await prepareRelief(product);
await prepareJupiter();
