'use client';

import { useEffect, useRef, useState } from 'react';
import { dprFor, type Quality } from '@/lib/performance';

const DPR_EPSILON = 0.01;
const QUALITY_UPGRADE_SETTLE_MS = 180;

/**
 * Keep the renderer inside its pixel budget after window, orientation, zoom,
 * or monitor-DPR changes. Reductions apply on the next frame so a growing
 * viewport cannot briefly retain an oversized backing buffer. Increases wait
 * until resizing settles to avoid reallocating every render target repeatedly
 * while a window is being dragged smaller.
 */
export function useResponsiveDpr(quality: Quality) {
  const [dpr, setDpr] = useState(() => dprFor(quality));
  const currentDprRef = useRef(dpr);

  useEffect(() => {
    let measurementFrame = 0;
    let upgradeTimer = 0;
    let resolutionQuery: MediaQueryList | null = null;

    const commit = (nextDpr: number) => {
      if (Math.abs(nextDpr - currentDprRef.current) < DPR_EPSILON) return;
      currentDprRef.current = nextDpr;
      setDpr(nextDpr);
    };

    const measure = () => {
      measurementFrame = 0;
      const nextDpr = dprFor(quality);
      if (nextDpr < currentDprRef.current + DPR_EPSILON) {
        window.clearTimeout(upgradeTimer);
        upgradeTimer = 0;
        commit(nextDpr);
        return;
      }

      window.clearTimeout(upgradeTimer);
      upgradeTimer = window.setTimeout(() => {
        upgradeTimer = 0;
        commit(dprFor(quality));
      }, QUALITY_UPGRADE_SETTLE_MS);
    };

    const scheduleMeasurement = () => {
      if (!measurementFrame) measurementFrame = window.requestAnimationFrame(measure);
    };

    const observeCurrentResolution = () => {
      resolutionQuery?.removeEventListener?.('change', handleResolutionChange);
      resolutionQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`) ?? null;
      resolutionQuery?.addEventListener?.('change', handleResolutionChange);
    };

    function handleResolutionChange() {
      observeCurrentResolution();
      scheduleMeasurement();
    }

    window.addEventListener('resize', scheduleMeasurement, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleMeasurement, { passive: true });
    observeCurrentResolution();
    scheduleMeasurement();

    return () => {
      window.cancelAnimationFrame(measurementFrame);
      window.clearTimeout(upgradeTimer);
      window.removeEventListener('resize', scheduleMeasurement);
      window.visualViewport?.removeEventListener('resize', scheduleMeasurement);
      resolutionQuery?.removeEventListener?.('change', handleResolutionChange);
    };
  }, [quality]);

  return dpr;
}
