'use client';

import { useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords, type MediaAsset } from '@/lib/content';
import styles from './HomeSections.module.css';

const KIND_LABEL: Record<string, string> = {
  competition: 'Competition',
  exhibition: 'Exhibition',
  summit: 'Summit',
  campus: 'Campus',
  festival: 'Festival',
};

function formatDate(iso: string) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).toUpperCase();
}

/**
 * Where the rover has actually been. Reads the `events` resource whole — it
 * is a handful of records — and lets the reader open one at a time so only
 * the selected event's gallery is in the DOM.
 */
export function OutreachLog() {
  const { records } = useContentRecords('events');
  const [openId, setOpenId] = useState<string | null>(null);

  if (records.length === 0) return null;

  return (
    <section
      id="outreach-log"
      className={`${styles.section} ${styles.outreach}`}
      aria-labelledby="outreach-log-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>
              <span aria-hidden="true">10</span>
              Deployment log / where it has been
            </p>
            <h2 id="outreach-log-title" className={styles.heading}>
              A ROVER IS ONLY<br /><span>REAL IN PUBLIC.</span>
            </h2>
          </div>
          <p className={styles.lede}>
            Competition fields, exhibition halls, school courtyards. Each entry
            is a weekend the platform left the lab and had to survive
            strangers, questions, and its own reliability budget.
          </p>
        </header>

        <ol className={styles.eventList}>
          {records.map((event) => {
            const media = event.media.filter(
              (item): item is MediaAsset => typeof item === 'object' && item !== null,
            );
            const lead = media[0];
            const open = openId === event.id;

            return (
              <li key={event.id} className={styles.event} data-open={open ? 'true' : undefined}>
                <button
                  type="button"
                  className={styles.eventHead}
                  aria-expanded={open}
                  aria-controls={`event-panel-${event.id}`}
                  onClick={() => setOpenId(open ? null : event.id)}
                >
                  <span className={styles.eventDate}>{formatDate(event.date)}</span>
                  <span className={styles.eventName}>{event.name}</span>
                  <span className={styles.eventKind}>{KIND_LABEL[event.kind] ?? event.kind}</span>
                  <span className={styles.eventCount}>
                    {String(media.length).padStart(2, '0')} FRAMES
                  </span>
                  <i aria-hidden="true" />
                </button>

                <div
                  id={`event-panel-${event.id}`}
                  className={styles.eventPanel}
                  hidden={!open}
                >
                  <div className={styles.eventBody}>
                    {lead ? (
                      <MediaImage
                        asset={lead}
                        ratio={3 / 2}
                        className={styles.eventLead}
                        sizes="(max-width: 900px) 92vw, 44vw"
                      />
                    ) : null}
                    <div className={styles.eventCopy}>
                      <p className={styles.eventVenue}>{event.venue}</p>
                      <p>{event.summary}</p>
                      {event.stats?.length ? (
                        <dl className={styles.eventStats}>
                          {event.stats.map((stat) => (
                            <div key={stat.label}>
                              <dt>{stat.label}</dt>
                              <dd>{stat.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  </div>

                  {media.length > 1 ? (
                    <div className={styles.eventThumbs}>
                      {media.slice(1).map((asset) => (
                        <MediaImage
                          key={asset.id}
                          asset={asset}
                          ratio={3 / 2}
                          sizes="(max-width: 700px) 44vw, 18vw"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
