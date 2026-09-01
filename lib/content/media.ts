import manifest from '@/data/media-manifest.json';
import type { MediaAsset, MediaRef } from './types';

/**
 * The generated media library.
 *
 * Records across every dataset refer to media by ID. This module is the only
 * place that turns an ID into something renderable, so a backend can send
 * bare IDs (cheap) or fully-resolved assets (self-contained) and the UI does
 * not care which.
 */

const assets = manifest.assets as unknown as MediaAsset[];

const byId = new Map<string, MediaAsset>(assets.map((asset) => [asset.id, asset]));

export const mediaRevision: string = manifest.revision;

export function getMediaAsset(id: string): MediaAsset | null {
  return byId.get(id) ?? null;
}

export function listMediaAssets(): readonly MediaAsset[] {
  return assets;
}

/** Accepts an ID or an already-resolved asset; returns null for unknown IDs. */
export function resolveMediaRef(ref: MediaRef | null | undefined): MediaAsset | null {
  if (!ref) return null;
  if (typeof ref !== 'string') return ref;
  return getMediaAsset(ref);
}

export function resolveMediaRefs(refs: readonly MediaRef[] | null | undefined): MediaAsset[] {
  if (!refs) return [];
  return refs
    .map(resolveMediaRef)
    .filter((asset): asset is MediaAsset => asset !== null);
}

/**
 * Picks the smallest variant at least `targetWidth` wide, falling back to the
 * largest available. Used where a single `src` is needed instead of a srcSet
 * (WebGL textures, CSS backgrounds, video posters).
 */
export function pickVariant(asset: MediaAsset, targetWidth: number): string {
  const sorted = [...asset.variants].sort((a, b) => a.width - b.width);
  const match = sorted.find((variant) => variant.width >= targetWidth);
  return (match ?? sorted[sorted.length - 1])?.url ?? asset.src;
}

/** Every asset carrying all of `tags`. */
export function filterMediaByTags(tags: readonly string[]): MediaAsset[] {
  if (tags.length === 0) return [...assets];
  return assets.filter((asset) => tags.every((tag) => asset.tags.includes(tag)));
}
