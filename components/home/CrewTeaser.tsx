'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords, type MediaAsset } from '@/lib/content';
import styles from './HomeSections.module.css';

/** Mentor, leads and sub-team leads. The full roster belongs on its own page. */
const LEADERSHIP_RANK = 3;

export function CrewTeaser() {
  const { records, total } = useContentRecords('crew');

  const leadership = records
    .filter((person) => person.rank <= LEADERSHIP_RANK)
    .sort((a, b) => a.rank - b.rank);

  if (leadership.length === 0) return null;

  return (
    <section
      id="crew-teaser"
      className={`${styles.section} ${styles.crew}`}
      aria-labelledby="crew-teaser-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>
              <span aria-hidden="true">11</span>
              Crew / command structure
            </p>
            <h2 id="crew-teaser-title" className={styles.heading}>
              PEOPLE BUILD<br /><span>MACHINES.</span>
            </h2>
          </div>
          <p className={styles.lede}>
            {total ?? records.length} students across mechanical, electrical,
            autonomous, aerial, science, media and logistics. These are the
            people the rest of the roster reports into.
          </p>
        </header>

        <ul className={styles.crewGrid}>
          {leadership.map((person) => {
            const portrait = typeof person.portrait === 'object' ? person.portrait as MediaAsset : null;
            return (
              <li key={person.id} className={styles.crewCard}>
                {portrait ? (
                  <MediaImage
                    asset={portrait}
                    ratio={3 / 4}
                    className={styles.crewPortrait}
                    sizes="(max-width: 700px) 44vw, (max-width: 1100px) 28vw, 16vw"
                    alt={`${person.name}, ${person.role}`}
                  />
                ) : null}
                <div className={styles.crewMeta}>
                  <strong>{person.name}</strong>
                  <span>{person.role}</span>
                  {person.unit ? <em>{person.unit}</em> : null}
                </div>
              </li>
            );
          })}
        </ul>

        <p className={styles.crewFoot}>
          <span aria-hidden="true">/</span>
          The full {total ?? records.length}-person roster is being prepared for
          its own page.
        </p>
      </div>
    </section>
  );
}
