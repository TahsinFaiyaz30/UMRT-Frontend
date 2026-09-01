/**
 * Turns the uncommitted RESOURCES/ camera originals into a shippable,
 * responsive media library.
 *
 *   node scripts/build-media-library.mjs [--force] [--images] [--videos]
 *
 * Outputs
 *   public/media/<collection>/<id>-<width>.webp   responsive stills
 *   public/media/film/<id>-<height>p.mp4          web renditions
 *   public/media/film/<id>-poster-<width>.webp    poster frames
 *   data/media-manifest.json                      the index the app reads
 *
 * The manifest is the only thing application code ever sees. It carries
 * intrinsic dimensions (so every <img> reserves its box and the page never
 * shifts) and a ~20px inline blur placeholder per asset (so a card is never
 * an empty hole while its photo streams in).
 *
 * Re-runs are incremental: an output newer than its source is left alone.
 * Pass --force to re-encode everything.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import sharp from 'sharp';

import { collections, crewSlug, profiles, roster, videoProfile, videos } from './media-sources.mjs';

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const sourceRoot = path.join(root, 'RESOURCES');
const mediaRoot = path.join(root, 'public', 'media');
const manifestPath = path.join(root, 'data', 'media-manifest.json');
const crewPath = path.join(root, 'data', 'content', 'crew.json');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const onlyImages = args.has('--images');
const onlyVideos = args.has('--videos');
const doImages = !onlyVideos;
const doVideos = !onlyImages;

const BLUR_WIDTH = 20;

let encoded = 0;
let reused = 0;

function log(...parts) {
  process.stdout.write(`${parts.join(' ')}\n`);
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** True when `output` exists and is at least as new as `source`. */
async function isFresh(output, source) {
  if (force) return false;
  try {
    const [outputStat, sourceStat] = await Promise.all([stat(output), stat(source)]);
    return outputStat.mtimeMs >= sourceStat.mtimeMs && outputStat.size > 0;
  } catch {
    return false;
  }
}

/**
 * `sharp` ignores EXIF orientation unless asked. Several phone originals in
 * RESOURCES/ are stored rotated; without this they render upside down.
 */
function openSource(file) {
  return sharp(file, { limitInputPixels: 512 * 1024 * 1024 }).rotate();
}

/**
 * Curation order. Assets are emitted in the order they are declared in
 * `media-sources.mjs`, so editing that file re-orders every gallery — the
 * strongest frame first, without a sort key in every consumer.
 */
let nextOrder = 0;

async function buildImage(item, profile, collectionId) {
  const source = path.join(sourceRoot, item.file);
  if (!(await exists(source))) {
    log(`  ! missing source, skipped: ${item.file}`);
    return null;
  }

  const outputDir = path.join(mediaRoot, collectionId);
  await mkdir(outputDir, { recursive: true });

  const metadata = await openSource(source).metadata();
  // `.rotate()` has not run when metadata() reads the header, so swap the
  // reported dimensions ourselves for the quarter-turn orientations.
  const turned = metadata.orientation !== undefined && metadata.orientation >= 5;
  const naturalWidth = turned ? metadata.height : metadata.width;
  const naturalHeight = turned ? metadata.width : metadata.height;

  const widths = profile.widths.filter((width) => width <= naturalWidth);
  if (widths.length === 0) widths.push(naturalWidth);

  const variants = [];
  for (const width of widths) {
    const relative = `media/${collectionId}/${item.id}-${width}.webp`;
    const output = path.join(root, 'public', relative);
    const height = Math.round((naturalHeight / naturalWidth) * width);

    if (await isFresh(output, source)) {
      reused += 1;
    } else {
      await openSource(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: profile.quality, effort: 5, alphaQuality: profile.alpha ? 100 : 80 })
        .toFile(output);
      encoded += 1;
    }

    const { size } = await stat(output);
    variants.push({ width, height, url: `/${relative}`, bytes: size });
  }

  const blurBuffer = await openSource(source)
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: 32, effort: 4, alphaQuality: 60 })
    .toBuffer();

  const largest = variants[variants.length - 1];

  return {
    id: item.id,
    collection: collectionId,
    kind: 'image',
    order: nextOrder++,
    width: naturalWidth,
    height: naturalHeight,
    aspectRatio: Number((naturalWidth / naturalHeight).toFixed(5)),
    alt: item.alt,
    caption: item.caption,
    tags: item.tags,
    hasAlpha: Boolean(metadata.hasAlpha),
    blurDataUrl: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    src: largest.url,
    srcSet: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', '),
    variants,
  };
}

/* ------------------------------------------------------------------ *
 *  Video                                                              *
 * ------------------------------------------------------------------ */

async function resolveFfmpeg() {
  try {
    const module = await import('ffmpeg-static');
    const binary = module.default ?? module;
    if (typeof binary === 'string' && (await exists(binary))) return binary;
  } catch {
    /* fall through to a PATH lookup */
  }
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return 'ffmpeg';
  } catch {
    return null;
  }
}

async function probeDuration(ffmpeg, source) {
  // ffprobe is not shipped by ffmpeg-static, so read the duration out of
  // ffmpeg's own stderr banner instead of adding a second dependency.
  try {
    await execFileAsync(ffmpeg, ['-i', source], { maxBuffer: 1024 * 1024 * 8 });
    return null;
  } catch (error) {
    const match = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(String(error.stderr ?? ''));
    if (!match) return null;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
}

async function buildVideo(video, ffmpeg) {
  const source = path.join(sourceRoot, video.file);
  if (!(await exists(source))) {
    log(`  ! missing source, skipped: ${video.file}`);
    return null;
  }

  const outputDir = path.join(mediaRoot, 'film');
  await mkdir(outputDir, { recursive: true });

  const duration = await probeDuration(ffmpeg, source);
  const requestedPosterAt = video.posterAtSeconds ?? videoProfile.posterAtSeconds;
  // Never seek past the end: a failed seek yields a black or empty frame.
  const posterAt = duration
    ? Math.min(requestedPosterAt, Math.max(0, duration - 0.5))
    : requestedPosterAt;

  const sources = [];
  for (const rendition of videoProfile.renditions) {
    const relative = `media/film/${video.id}-${rendition.height}p.mp4`;
    const output = path.join(root, 'public', relative);

    if (await isFresh(output, source)) {
      reused += 1;
    } else {
      log(`  … encoding ${video.id} @ ${rendition.height}p (this takes a while)`);
      await execFileAsync(ffmpeg, [
        '-y',
        '-i', source,
        '-vf', `scale=-2:${rendition.height}`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', String(rendition.crf),
        '-profile:v', 'high',
        '-pix_fmt', 'yuv420p',
        // Interleave a moov atom at the front so the browser can start
        // playing before the whole file has arrived.
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', `${rendition.audioKbps}k`,
        '-ac', '2',
        output,
      ], { maxBuffer: 1024 * 1024 * 32 });
      encoded += 1;
    }

    const { size } = await stat(output);
    sources.push({
      height: rendition.height,
      url: `/${relative}`,
      type: 'video/mp4',
      bytes: size,
    });
  }

  // Poster: one full-resolution still, then the usual responsive ladder.
  const rawPoster = path.join(outputDir, `${video.id}-poster-source.png`);
  if (!(await isFresh(rawPoster, source))) {
    await execFileAsync(ffmpeg, [
      '-y',
      '-ss', posterAt.toFixed(2),
      '-i', source,
      '-frames:v', '1',
      rawPoster,
    ], { maxBuffer: 1024 * 1024 * 32 });
  }

  const posterMeta = await sharp(rawPoster).metadata();
  const posterVariants = [];
  for (const width of videoProfile.posterWidths.filter((w) => w <= posterMeta.width)) {
    const relative = `media/film/${video.id}-poster-${width}.webp`;
    const output = path.join(root, 'public', relative);
    if (!(await isFresh(output, rawPoster))) {
      await sharp(rawPoster)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: videoProfile.posterQuality, effort: 5 })
        .toFile(output);
      encoded += 1;
    }
    const { size } = await stat(output);
    posterVariants.push({
      width,
      height: Math.round((posterMeta.height / posterMeta.width) * width),
      url: `/${relative}`,
      bytes: size,
    });
  }

  const blurBuffer = await sharp(rawPoster)
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: 32, effort: 4 })
    .toBuffer();

  // The intermediate PNG is a build artefact, not something to ship.
  await rm(rawPoster, { force: true });

  const largestPoster = posterVariants[posterVariants.length - 1];

  return {
    id: video.id,
    collection: 'film',
    kind: 'video',
    order: nextOrder++,
    width: posterMeta.width,
    height: posterMeta.height,
    aspectRatio: Number((posterMeta.width / posterMeta.height).toFixed(5)),
    alt: video.alt,
    title: video.title,
    caption: video.caption,
    tags: video.tags,
    durationSeconds: duration ? Number(duration.toFixed(2)) : null,
    blurDataUrl: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    src: largestPoster.url,
    srcSet: posterVariants.map((variant) => `${variant.url} ${variant.width}w`).join(', '),
    variants: posterVariants,
    sources,
  };
}

/* ------------------------------------------------------------------ *
 *  Entry                                                              *
 * ------------------------------------------------------------------ */

/** Rank drives roster ordering everywhere: mentor, lead, sub-lead, member. */
function rankFor(role) {
  const normalized = role.toLowerCase();
  if (normalized.includes('mentor')) return 0;
  if (normalized.includes('co-team') || normalized.includes('team lead')) return 1;
  if (normalized.includes('senior')) return 2;
  if (normalized.includes('sub-team')) return 3;
  return 4;
}

/**
 * The roster lives next to its portrait paths in `media-sources.mjs`, so the
 * crew resource is emitted from here rather than hand-authored. Everything
 * else under `data/content/` is written by hand.
 */
async function writeCrewDataset() {
  const records = roster.map((person) => {
    const slug = crewSlug(person.name);
    return {
      id: slug,
      name: person.name,
      role: person.role,
      unit: person.unit,
      rank: rankFor(person.role),
      portrait: `crew-${slug}`,
      card: `crew-card-${slug}`,
    };
  });

  const payload = {
    schemaVersion: 1,
    revision: createHash('sha1').update(JSON.stringify(records)).digest('hex').slice(0, 12),
    resource: 'crew',
    generated: 'scripts/build-media-library.mjs — edit `roster` in scripts/media-sources.mjs',
    records,
  };

  await mkdir(path.dirname(crewPath), { recursive: true });
  await writeFile(crewPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  log(`crew    → ${path.relative(root, crewPath)} (${records.length} people)`);
}

async function readExistingManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Delete derivatives whose source item no longer exists in the source map. */
async function pruneOrphans(keptByCollection) {
  if (!(await exists(mediaRoot))) return;
  for (const [collectionId, keptFiles] of keptByCollection) {
    const dir = path.join(mediaRoot, collectionId);
    if (!(await exists(dir))) continue;
    for (const entry of await readdir(dir)) {
      if (keptFiles.has(entry)) continue;
      await rm(path.join(dir, entry), { force: true });
      log(`  - pruned ${collectionId}/${entry}`);
    }
  }
}

async function main() {
  if (!(await exists(sourceRoot))) {
    const existing = await readExistingManifest();
    if (existing) {
      log('RESOURCES/ not present — keeping the committed media manifest as-is.');
      return;
    }
    log('RESOURCES/ not present and no manifest committed. Nothing to build.');
    return;
  }

  await mkdir(mediaRoot, { recursive: true });
  const assets = [];
  const keptByCollection = new Map();

  if (doImages) {
    for (const collection of collections) {
      const profile = profiles[collection.profile];
      log(`> ${collection.id} (${collection.items.length} items, ${collection.profile})`);
      const kept = new Set();
      for (const item of collection.items) {
        const asset = await buildImage(item, profile, collection.id);
        if (!asset) continue;
        assets.push(asset);
        for (const variant of asset.variants) kept.add(path.basename(variant.url));
      }
      keptByCollection.set(collection.id, kept);
    }
  }

  if (doVideos) {
    const ffmpeg = await resolveFfmpeg();
    if (!ffmpeg) {
      log('> film: no ffmpeg available — skipping video renditions.');
    } else {
      log(`> film (${videos.length} items) via ${ffmpeg === 'ffmpeg' ? 'system ffmpeg' : 'ffmpeg-static'}`);
      const kept = new Set();
      for (const video of videos) {
        const asset = await buildVideo(video, ffmpeg);
        if (!asset) continue;
        assets.push(asset);
        for (const variant of asset.variants) kept.add(path.basename(variant.url));
        for (const item of asset.sources) kept.add(path.basename(item.url));
      }
      keptByCollection.set('film', kept);
    }
  }

  // A partial run (--images / --videos) must not drop the other half of the
  // manifest, and must not prune the collections it did not rebuild.
  if (onlyImages || onlyVideos) {
    const existing = await readExistingManifest();
    const rebuilt = new Set(assets.map((asset) => asset.id));
    for (const asset of existing?.assets ?? []) {
      if (!rebuilt.has(asset.id)) assets.push(asset);
    }
  }

  await pruneOrphans(keptByCollection);

  // Curation order first; `order` is absent only on records carried over from
  // a previous partial build, which sort to the end by id.
  assets.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));
  const totalBytes = assets.reduce(
    (total, asset) => total
      + asset.variants.reduce((sum, variant) => sum + variant.bytes, 0)
      + (asset.sources ?? []).reduce((sum, source) => sum + source.bytes, 0),
    0,
  );

  const manifest = {
    schemaVersion: 1,
    // Content hash rather than a timestamp: rebuilding unchanged sources
    // must not produce a diff.
    revision: createHash('sha1')
      .update(JSON.stringify(assets.map((asset) => [asset.id, asset.srcSet])))
      .digest('hex')
      .slice(0, 12),
    counts: {
      assets: assets.length,
      roster: roster.length,
      bytes: totalBytes,
    },
    assets,
  };

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeCrewDataset();

  log('');
  log(`${assets.length} assets · ${encoded} encoded · ${reused} reused · ${(totalBytes / 1024 / 1024).toFixed(1)} MB shipped`);
  log(`manifest → ${path.relative(root, manifestPath)}`);
}

main().catch((error) => {
  process.exitCode = 1;
  process.stderr.write(`${error?.stack ?? error}\n`);
});
