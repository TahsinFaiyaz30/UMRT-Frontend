'use client';

import { useState } from 'react';
import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords, type MediaAsset } from '@/lib/content';
import { PanelHead, SectionHeader, SpecList, useSection } from './SectionShell';
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
  const section = useSection('outreach-log');

  if (records.length === 0 || !section) return null;

  const frames = records.reduce((total, event) => total + event.media.length, 0);

  return (
    <section
      id="outreach-log"
      className={styles.section}
      aria-labelledby="outreach-log-title"
    >
      <div className={styles.inner}>
        <SectionHeader
          section={section}
          titleId="outreach-log-title"
          tokens={{
            count: String(records.length).padStart(2, '0'),
            frames: String(frames),
          }}
        />

        <ol className={styles.eventList}>
          {records.map((event, eventIndex) => {
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
                  <span className={styles.eventIndex}>
                    /{String(eventIndex + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.eventDate}>{formatDate(event.date)}</span>
                  <span className={styles.eventName}>{event.name}</span>
                  <span className={styles.eventKind}>
                    <i aria-hidden="true" />
                    {KIND_LABEL[event.kind] ?? event.kind}
                  </span>
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
                      <div className={styles.panel}>
                        <PanelHead
                          code={`LEAD / ${String(eventIndex + 1).padStart(2, '0')}`}
                          status="VERIFIED"
                        />
                        <MediaImage
                          asset={lead}
                          ratio={3 / 2}
                          sizes="(max-width: 900px) 92vw, 44vw"
                        />
                      </div>
                    ) : null}
                    <div className={styles.eventCopy}>
                      <p className={styles.eventVenue}>{event.venue}</p>
                      <p>{event.summary}</p>
                      <SpecList
                        specs={[
                          ...(event.stats ?? []),
                          { label: 'Date', value: formatDate(event.date) },
                          { label: 'Frames', value: String(media.length).padStart(2, '0') },
                        ]}
                      />
                    </div>
                  </div>

                  {media.length > 1 ? (
                    <div className={styles.eventThumbs}>
                      {media.slice(1).map((asset) => (
                        <div key={asset.id} className={styles.eventThumb}>
                          <MediaImage
                            asset={asset}
                            ratio={3 / 2}
                            sizes="(max-width: 700px) 44vw, 18vw"
                          />
                        </div>
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
