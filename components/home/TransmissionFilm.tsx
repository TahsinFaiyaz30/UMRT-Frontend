'use client';

import { useCallback, useRef, useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords } from '@/lib/content';
import { PanelHead, SectionHeader, SignalBars, SpecList, fillTokens, useSection } from './SectionShell';
import styles from './HomeSections.module.css';

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * The promotional film.
 *
 * Nothing of the video is fetched until the reader asks for it: the poster is
 * a still from the media library, and the <video> element is only mounted on
 * play. At ~22 MB for the 1080p rendition that distinction is the difference
 * between a fast home page and a slow one.
 */
export function TransmissionFilm() {
  const { records } = useContentRecords('media', { params: { tag: 'promo' } });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const section = useSection('transmission-film');

  const film = records.find((asset) => asset.kind === 'video');

  const start = useCallback(() => {
    setPlaying(true);
    // The element does not exist until this render commits.
    requestAnimationFrame(() => videoRef.current?.play().catch(() => undefined));
  }, []);

  if (!film || !film.sources?.length || !section) return null;

  const duration = formatDuration(film.durationSeconds);
  // Largest rendition first: the browser takes the first source it can play,
  // so quality leads on capable links.
  const sources = [...film.sources].sort((a, b) => b.height - a.height);
  const totalMb = sources.reduce((sum, source) => sum + source.bytes, 0) / 1024 / 1024;
  const tokens = {
    filmTitle: film.title ?? 'Mission film',
    runtime: duration ?? '—',
    renditions: sources.map((source) => `${source.height}p`).join(' / '),
    payload: `${totalMb.toFixed(0)} MB`,
    maxHeight: String(sources[0].height),
  };

  return (
    <section
      id="transmission-film"
      className={styles.section}
      aria-labelledby="transmission-film-title"
    >
      <div className={styles.inner}>
        <SectionHeader
          section={section}
          titleId="transmission-film-title"
          tokens={tokens}
        />

        <div className={`${styles.filmStage} ${styles.panel}`} data-playing={playing ? 'true' : undefined}>
          <PanelHead code="FILM / 01" status={playing ? 'PLAYING' : 'STANDBY'} />

          {playing ? (
            <video
              ref={videoRef}
              className={styles.filmVideo}
              controls
              playsInline
              preload="auto"
              poster={film.src}
              aria-label={film.alt}
            >
              {sources.map((source) => (
                <source key={source.url} src={source.url} type={source.type} />
              ))}
            </video>
          ) : (
            <div className={styles.filmPoster}>
              <MediaImage asset={film} ratio={16 / 9} sizes="(max-width: 900px) 92vw, 74vw" />
              <button type="button" className={styles.filmPlay} onClick={start}>
                <i aria-hidden="true" />
                <span>PLAY TRANSMISSION</span>
                {duration ? <b aria-hidden="true">{duration}</b> : null}
              </button>
            </div>
          )}

          <div className={styles.filmFoot}>
            <SpecList
              specs={(section.footSpecs ?? []).map((spec) => ({
                label: spec.label,
                value: fillTokens(spec.value, tokens),
              }))}
            />
            <SignalBars count={22} seed={2} />
          </div>
        </div>
      </div>
    </section>
  );
}
