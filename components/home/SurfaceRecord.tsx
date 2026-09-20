'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords } from '@/lib/content';
import { PanelHead, SectionHeader, useSection } from './SectionShell';
import styles from './HomeSections.module.css';

/**
 * A horizontal filmstrip of field photography, read from the media resource
 * by tag rather than from a hard-coded list — the same query a live backend
 * will answer.
 */
export function SurfaceRecord() {
  const { records } = useContentRecords('media', { params: { tag: 'rover' } });
  const section = useSection('surface-record');
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollByFrames = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const frame = rail.querySelector<HTMLElement>('[data-frame]');
    const step = frame ? frame.offsetWidth + 16 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || records.length === 0) return undefined;

    let frame = 0;
    const read = () => {
      frame = 0;
      const first = rail.querySelector<HTMLElement>('[data-frame]');
      const step = first ? first.offsetWidth + 16 : 1;
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

  if (records.length === 0 || !section) return null;

  const progress = records.length > 1 ? (index / (records.length - 1)) * 100 : 100;

  return (
    <section
      id="surface-record"
      className={styles.section}
      aria-labelledby="surface-record-title"
    >
      <div className={styles.inner}>
        <SectionHeader
          section={section}
          titleId="surface-record-title"
          tokens={{ count: String(records.length).padStart(2, '0') }}
        />

        <div className={styles.railShell}>
          <div
            ref={railRef}
            className={styles.rail}
            tabIndex={0}
            aria-label="Field photography, scroll horizontally"
          >
            {records.map((asset, frameIndex) => (
              <figure key={asset.id} data-frame className={`${styles.frame} ${styles.panel}`}>
                <PanelHead
                  code={`FRAME / ${String(frameIndex + 1).padStart(2, '0')}`}
                  status="LOGGED"
                />
                <div className={styles.frameMedia}>
                  <MediaImage
                    asset={asset}
                    ratio={4 / 3}
                    sizes="(max-width: 700px) 82vw, (max-width: 1100px) 46vw, 32vw"
                  />
                </div>
                <figcaption className={styles.frameFoot}>
                  <span>{String(frameIndex + 1).padStart(2, '0')}</span>
                  <p>{asset.caption ?? asset.alt}</p>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className={styles.railControls}>
            <button type="button" onClick={() => scrollByFrames(-1)} aria-label="Previous frame">←</button>
            <button type="button" onClick={() => scrollByFrames(1)} aria-label="Next frame">→</button>
            <div
              className={styles.railTrack}
              style={{ '--rail-progress': `${progress}%` } as React.CSSProperties}
              aria-hidden="true"
            >
              <i />
            </div>
            <span className={styles.railCount} aria-live="polite">
              {String(index + 1).padStart(2, '0')} / {String(records.length).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
