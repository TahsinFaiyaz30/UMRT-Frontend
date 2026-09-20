'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords, type MediaAsset } from '@/lib/content';
import { PanelHead, SectionHeader, fillTokens, useSection } from './SectionShell';
import styles from './HomeSections.module.css';

/** Mentor, leads and sub-team leads. The full roster belongs on its own page. */
const LEADERSHIP_RANK = 3;

export function CrewTeaser() {
  const { records, total } = useContentRecords('crew');
  const section = useSection('crew-teaser');

  const leadership = records
    .filter((person) => person.rank <= LEADERSHIP_RANK)
    .sort((a, b) => a.rank - b.rank);

  if (leadership.length === 0 || !section) return null;

  const headcount = total ?? records.length;
  const units = new Set(records.map((person) => person.unit).filter(Boolean));
  const tokens = {
    headcount: String(headcount),
    units: String(units.size),
    leads: String(leadership.length),
  };

  return (
    <section
      id="crew-teaser"
      className={styles.section}
      aria-labelledby="crew-teaser-title"
    >
      <div className={styles.inner}>
        <SectionHeader
          section={section}
          titleId="crew-teaser-title"
          tokens={tokens}
        />

        <ul className={styles.crewGrid}>
          {leadership.map((person, personIndex) => {
            const portrait = typeof person.portrait === 'object'
              ? person.portrait as MediaAsset
              : null;
            return (
              <li key={person.id} className={`${styles.crewCard} ${styles.panel}`}>
                <PanelHead
                  code={`CREW / ${String(personIndex + 1).padStart(2, '0')}`}
                  status="ACTIVE"
                />
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
                  <span className={styles.crewRole}>{person.role}</span>
                  {person.unit ? <em className={styles.crewUnit}>{person.unit}</em> : null}
                </div>
              </li>
            );
          })}
        </ul>

        <p className={styles.crewFoot}>
          <span aria-hidden="true">{'//'}</span>
          {fillTokens(section.footnote ?? '', tokens)}
        </p>
      </div>
    </section>
  );
}
