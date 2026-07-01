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

  if (isMobile) return 'low';
  if (typeof lowMem === 'number' && lowMem <= 4) return 'low';
  if (cores <= 2) return 'low';
  return 'medium';
}

export function dprFor(quality: Quality): number {
  if (quality === 'low') return 1;
  if (quality === 'medium') return Math.min(window.devicePixelRatio || 1, 1.5);
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function particleCountFor(quality: Quality): number {
  if (quality === 'low') return 60;
  if (quality === 'medium') return 180;
  return 320;
}

export function fogDensityFor(quality: Quality): number {
  if (quality === 'low') return 0.045;
  if (quality === 'medium') return 0.028;
  return 0.018;
}
