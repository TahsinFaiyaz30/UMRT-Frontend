/** Offline preparation of the observed Pluto / Charon mosaics; see SOURCES.md.
 * Source cache is outside .next, which Next.js may clear during a build.
 * No procedural geography is generated. Unobserved southern terrain is a
 * neutral material; separate masks record the observation coverage.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const cache = path.resolve(process.argv[2] ?? 'output/playwright/solar-source-cache');
const output = path.resolve('public/textures/solar');
await fs.mkdir(cache, { recursive: true });
async function source(name, url, expectedBytes = 0) {
  const file = path.join(cache, name);
  const size = (await fs.stat(file).catch(() => null))?.size ?? 0;
  if (size && (!expectedBytes || size === expectedBytes)) return file;
  await new Promise((resolve, reject) => {
    const args = ['--fail', '--location', '--silent', '--show-error', '--max-time', '300'];
    if (size) args.push('--continue-at', '-');
    args.push('--output', file, url);
    const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', args, { windowsHide: true });
    child.stderr.on('data', value => process.stderr.write(value));
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Download failed: ${name}`)));
  });
  if (expectedBytes && (await fs.stat(file)).size !== expectedBytes) throw new Error(`Incomplete ${name}`);
  return file;
}
const plutoFile = await source('pluto-color-nasa-2017.jpg', 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/l/pluto_color_mapmosaic.jpg?crop=faces%2Cfocalpoint&fit=clip&h=2963&w=5926');
const charonFile = await source('charon-usgs-2017.tif', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif', 80613890);
const colorFile = await source('charon-noaa-color.jpg', 'https://sos.noaa.gov/ftp_mirror/astronomy/charon/4096.jpg');
const smooth = (value) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };

async function writeMap(id, rgb, width, height, neutral) {
  const boundary = new Int32Array(width);
  // Only the continuous no-data area connected to the south edge is replaced;
  // genuine dark terrain and the dark north polar cap remain observations.
  for (let x = 0; x < width; x++) {
    let streak = 0;
    for (let y = height - 1; y >= 0; y--) {
      const i = (y * width + x) * 3;
      streak = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]) > 8 ? streak + 1 : 0;
      if (streak === 4) { boundary[x] = y + 3; break; }
    }
    if (boundary[x] < height * .5) throw new Error(`${id}: unexpected north-only coverage at ${x}`);
  }
  const rgba = Buffer.alloc(width * height * 4);
  // A 5.4-degree shoulder avoids depicting the atlas boundary as a cliff or
  // a black material. The missing side stays uniform, with no invented detail.
  const shoulder = height * .03;
  let observed = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x, input = pixel * 3, out = pixel * 4;
    const coverage = smooth((boundary[x] - y) / shoulder);
    for (let channel = 0; channel < 3; channel++) rgba[out + channel] = Math.round(neutral[channel] + (rgb[input + channel] - neutral[channel]) * coverage);
    rgba[out + 3] = Math.round(coverage * 255);
    observed += coverage > .999 ? 1 : 0;
  }
  const file = path.join(output, `${id}.webp`);
  await sharp(rgba, { raw: { width, height, channels: 4 } }).removeAlpha().webp({ quality: 97, effort: 6 }).toFile(file);
  // Keep no-data color opaque: browser bitmap decoding can otherwise discard
  // RGB beneath transparent alpha, recreating a black southern cap.
  await sharp(rgba, { raw: { width, height, channels: 4 } }).extractChannel(3).resize(1024, 512).webp({ lossless: true }).toFile(path.join(output, `${id}-coverage.webp`));
  await sharp(file).resize(1480).png().toFile(path.join(cache, `${id}-corrected-preview.png`));
  const decoded = await sharp(file).raw().toBuffer();
  if (decoded.length !== width * height * 3) throw new Error(`${id}: unexpected decode size`);
  for (let x = 0; x < width; x++) {
    const i = ((height - 1) * width + x) * 3;
    if (decoded[i] < 100) throw new Error(`${id}: invalid no-data material`);
  }
  console.log(JSON.stringify({ id, width, height, observedFraction: observed / (width * height), bytes: (await fs.stat(file)).size }));
}

const pluto = await sharp(plutoFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
await writeMap('pluto', pluto.data, pluto.info.width, pluto.info.height, [158, 148, 138]);

const width = 6144, height = 3072;
const gray = await sharp(charonFile).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().greyscale().raw().toBuffer();
// Color ratios only: the observed 2017 LORRI/MVIC product supplies every
// luminance detail. Smoothing chroma prevents old map edges from ghosting.
const color = await sharp(colorFile).resize(width, height, { fit: 'fill' }).blur(18).removeAlpha().raw().toBuffer();
const charon = Buffer.alloc(width * height * 3);
for (let i = 0; i < gray.length; i++) {
  const j = i * 3;
  if (gray[i] <= 2) continue;
  const luminance = .2126 * color[j] + .7152 * color[j + 1] + .0722 * color[j + 2];
  for (let c = 0; c < 3; c++) {
    const tint = luminance > 12 ? color[j + c] / luminance : 1;
    charon[j + c] = Math.min(255, Math.round(gray[i] * tint));
  }
}
await writeMap('charon', charon, width, height, [157, 155, 151]);
