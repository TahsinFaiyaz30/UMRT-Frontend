'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { useContentRecords, type MediaAsset } from '@/lib/content';
import styles from './HomeSections.module.css';

export function PartnerMarks() {
  const { records } = useContentRecords('partners');
  if (records.length === 0) return null;

  return (
    <section className={`${styles.section} ${styles.partners}`} aria-label="Institutional backing">
      <div className={styles.inner}>
        <p className={styles.partnersKicker}>Backed by</p>
        <ul className={styles.partnerRow}>
          {records.map((partner) => {
            const mark = typeof partner.mark === 'object' ? partner.mark as MediaAsset : null;
            const body = (
              <>
                {mark ? (
                  <MediaImage
                    asset={mark}
                    ratio={1}
                    className={styles.partnerMark}
                    sizes="120px"
                    alt={`${partner.name} emblem`}
                  />
                ) : null}
                <span>
                  <strong>{partner.shortName}</strong>
                  <em>{partner.role}</em>
                </span>
              </>
            );

            return (
              <li key={partner.id}>
                {partner.href ? (
                  <a href={partner.href} target="_blank" rel="noreferrer">{body}</a>
                ) : (
                  <div>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
