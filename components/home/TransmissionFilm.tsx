'use client';

import { useCallback, useRef, useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords } from '@/lib/content';
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

  const film = records.find((asset) => asset.kind === 'video');

  const start = useCallback(() => {
    setPlaying(true);
    // The element does not exist until this render commits.
    requestAnimationFrame(() => videoRef.current?.play().catch(() => undefined));
  }, []);

  if (!film || !film.sources?.length) return null;

  const duration = formatDuration(film.durationSeconds);
  // Smallest rendition first: the browser picks the first source it can play,
  // so the ladder is ordered largest-first to prefer quality on capable links.
  const sources = [...film.sources].sort((a, b) => b.height - a.height);

  return (
    <section
      id="transmission-film"
      className={`${styles.section} ${styles.film}`}
      aria-labelledby="transmission-film-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>
              <span aria-hidden="true">09</span>
              Transmission / motion record
            </p>
            <h2 id="transmission-film-title" className={styles.heading}>
              WATCH IT<br /><span>MOVE.</span>
            </h2>
          </div>
          <p className={styles.lede}>
            {film.title}. Cut from workshop footage, night tests, and the field
            season — the shortest honest answer to what a student rover
            programme actually looks like.
          </p>
        </header>

        <div className={styles.filmStage} data-playing={playing ? 'true' : undefined}>
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
            <>
              <MediaImage asset={film} ratio={16 / 9} sizes="(max-width: 900px) 92vw, 74vw" />
              <button type="button" className={styles.filmPlay} onClick={start}>
                <i aria-hidden="true" />
                <span>PLAY TRANSMISSION</span>
                {duration ? <b aria-hidden="true">{duration}</b> : null}
              </button>
              <div className={styles.filmMeta} aria-hidden="true">
                <span>UMRT / FILM 01</span>
                <span>{sources[0].height}P · MP4</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
