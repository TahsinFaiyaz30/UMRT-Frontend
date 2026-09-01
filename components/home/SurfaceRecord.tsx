'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords } from '@/lib/content';
import styles from './HomeSections.module.css';

/**
 * A horizontal filmstrip of field photography, read from the media resource
 * by tag rather than from a hard-coded list — the same query a live backend
 * will answer.
 */
export function SurfaceRecord() {
  const { records } = useContentRecords('media', { params: { tag: 'rover' } });
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollByFrames = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const frame = rail.querySelector<HTMLElement>('[data-frame]');
    const step = frame ? frame.offsetWidth + 18 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || records.length === 0) return undefined;

    let frame = 0;
    const read = () => {
      frame = 0;
      const first = rail.querySelector<HTMLElement>('[data-frame]');
      const step = first ? first.offsetWidth + 18 : 1;
      setIndex(Math.min(records.length - 1, Math.round(rail.scrollLeft / Math.max(1, step))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    rail.addEventListener('scroll', onScroll, { passive: true });
    read();
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener('scroll', onScroll);
    };
  }, [records.length]);

  if (records.length === 0) return null;

  return (
    <section
      id="surface-record"
      className={`${styles.section} ${styles.record}`}
      aria-labelledby="surface-record-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>
              <span aria-hidden="true">08</span>
              Surface record / field photography
            </p>
            <h2 id="surface-record-title" className={styles.heading}>
              THE MACHINE,<br /><span>ON REAL GROUND.</span>
            </h2>
          </div>
          <p className={styles.lede}>
            Every frame here is the actual rover — in the workshop at four in
            the morning, on excavated terrain outside Dhaka, and on competition
            soil twelve thousand kilometres from where it was built.
          </p>
        </header>

        <div className={styles.railShell}>
          <div ref={railRef} className={styles.rail} tabIndex={0} aria-label="Field photography, scroll horizontally">
            {records.map((asset, frameIndex) => (
              <figure key={asset.id} data-frame className={styles.frame}>
                <MediaImage
                  asset={asset}
                  ratio={4 / 3}
                  sizes="(max-width: 700px) 82vw, (max-width: 1100px) 46vw, 32vw"
                />
                <figcaption>
                  <span>{String(frameIndex + 1).padStart(2, '0')}</span>
                  <p>{asset.caption ?? asset.alt}</p>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className={styles.railControls}>
            <button
              type="button"
              onClick={() => scrollByFrames(-1)}
              aria-label="Previous frame"
            >
              ←
            </button>
            <span aria-live="polite">
              {String(index + 1).padStart(2, '0')} / {String(records.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => scrollByFrames(1)}
              aria-label="Next frame"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
