/**
 * Helpers for device-capability detection and reduced-motion support.
 * Safe to call only on the client.
 */

export type Quality = 'high' | 'medium' | 'low';

export function getReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function detectQuality(): Quality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'medium';

  const ua = navigator.userAgent || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const lowMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;

  if (typeof lowMem === 'number' && lowMem <= 2) return 'low';
  if (cores <= 2) return 'low';
  if (isMobile || (typeof lowMem === 'number' && lowMem <= 4)) return 'medium';
  return 'high';
}

export function dprFor(quality: Quality): number {
  const physicalDpr = Math.max(1, window.devicePixelRatio || 1);
  const qualityCap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 1.65;
  const pixelBudget = quality === 'low' ? 2_000_000 : quality === 'medium' ? 3_000_000 : 4_000_000;
  const viewportPixels = Math.max(1, window.innerWidth * window.innerHeight);

  // A DPR-only cap is insufficient on large and ultrawide displays: a 4K
  // canvas at DPR 1.65 allocates more than 22 million pixels for every color,
  // depth, shadow, and post-processing target. Bound the backing-buffer area
  // as well. Normal 1080p layouts remain pixel-identical (DPR 1), while very
  // large displays retain a high-resolution image without exhausting GPU RAM.
  const areaCap = Math.sqrt(pixelBudget / viewportPixels);
  const minimumUsefulDpr = quality === 'low' ? 0.6 : 0.75;
  const boundedDpr = Math.min(physicalDpr, qualityCap, Math.max(minimumUsefulDpr, areaCap));

  if (quality === 'low') return boundedDpr;
  // Browser zoom below 100% reports a devicePixelRatio below 1. Passing that
  // value through makes the WebGL backing buffer smaller than its CSS canvas,
  // softening the rover, terrain, clouds, and every other scene edge together.
  // Supersample that special case at 1x while retaining the existing caps for
  // high-DPI displays.
  if (quality === 'medium') return boundedDpr;
  // A physical pixel cap avoids turning a 1080p retina canvas into a 4K
  // multisampled framebuffer. This tier is chosen once at startup and never
  // silently downgrades the scene after the user begins exploring it.
  return boundedDpr;
}

export function particleCountFor(quality: Quality): number {
  if (quality === 'low') return 140;
  if (quality === 'medium') return 380;
  return 680;
}

export function fogDensityFor(quality: Quality): number {
  if (quality === 'low') return 0.045;
  if (quality === 'medium') return 0.028;
  return 0.018;
}
