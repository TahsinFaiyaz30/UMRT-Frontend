'use client';

import { useEffect, useRef } from 'react';
import { CrewTeaser } from './CrewTeaser';
import { OutreachLog } from './OutreachLog';
import { PartnerMarks } from './PartnerMarks';
import { SurfaceRecord } from './SurfaceRecord';
import { TransmissionFilm } from './TransmissionFilm';
import styles from './HomeSections.module.css';

/**
 * Everything that comes after the scroll-driven rover mission.
 *
 * Two things make this safe to append to a page whose canvas is
 * `position: fixed`:
 *
 *   1. The `data-mission-end` sentinel at the top. MarsExperience measures the
 *      mission's scroll range up to that marker, so adding sections here does
 *      not stretch the rover timeline across them.
 *   2. An opaque background and a stacking context above the canvas, plus an
 *      IntersectionObserver that reports when the appendix covers the viewport
 *      completely — the caller uses that to stop rendering the rover.
 */
export function MissionAppendix({
  onVisibilityChange,
}: {
  onVisibilityChange?: (covering: boolean) => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onVisibilityChange) return undefined;

    /*
     * Suspending the rover canvas is only safe once it is genuinely invisible.
     * The canvas has no preserved drawing buffer, so a suspended canvas can
     * present black the moment the compositor needs it again — if any part of
     * it were still on screen, that would read as the page flashing black.
     *
     * The sentinel is a zero-height marker at the very top of the appendix, so
     * "scrolled above the viewport" means the opaque appendix now covers every
     * pixel. `boundingClientRect.top` distinguishes leaving via the top from
     * leaving via the bottom.
     */
    const observer = new IntersectionObserver(
      ([entry]) => onVisibilityChange(
        !entry.isIntersecting && entry.boundingClientRect.top <= 0,
      ),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      onVisibilityChange(false);
    };
  }, [onVisibilityChange]);

  return (
    <>
      <div data-mission-end aria-hidden="true" className={styles.missionEnd} />
      <div ref={sentinelRef} aria-hidden="true" className={styles.missionEnd} />
      <div className={styles.appendix}>
        <SurfaceRecord />
        <TransmissionFilm />
        <OutreachLog />
        <CrewTeaser />
        <PartnerMarks />
      </div>
    </>
  );
}
