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
  if (quality === 'low') return 1;
  if (quality === 'medium') return Math.min(window.devicePixelRatio || 1, 1.5);
  // A physical pixel cap avoids turning a 1080p retina canvas into a 4K
  // multisampled framebuffer. This tier is chosen once at startup and never
  // silently downgrades the scene after the user begins exploring it.
  return Math.min(window.devicePixelRatio || 1, 1.65);
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
