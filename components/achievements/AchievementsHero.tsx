'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AchievementsIntro.module.css';

export default function AchievementsHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      setEntered(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) setEntered(true);
      },
      { rootMargin: '0px', threshold: 0.04 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.hero}
      data-active={active}
      data-entered={entered}
      aria-labelledby="achievements-title"
    >
      <div className={styles.cosmicGrid} aria-hidden="true" />
      <div className={styles.starfield} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.orbitalDiagram} aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
      </div>

      <aside className={`${styles.edgeTelemetry} ${styles.edgeTelemetryLeft}`} aria-hidden="true">
        <span>UMRT / ARCHIVE NODE</span>
        <span>23.8103 N</span>
      </aside>
      <aside className={`${styles.edgeTelemetry} ${styles.edgeTelemetryRight}`} aria-hidden="true">
        <span>RECORD / LIVE</span>
        <span>90.4125 E</span>
      </aside>

      <div className={styles.heroInner}>
        <p className={styles.kicker}>
          <span className={styles.signalDot} aria-hidden="true" />
          UIU Mars Rover Team / Achievement Archive
        </p>

        <h1
          id="achievements-title"
          className={styles.title}
          aria-label="Our achievements: progress leaves a signal"
        >
          <span>PROGRESS</span>
          <span className={styles.titleOutline}>LEAVES</span>
          <span className={styles.titleSignal}>A SIGNAL.</span>
        </h1>

        <div className={styles.heroFooter}>
          <p>
            Every qualification, field test, breakthrough, and award leaves a
            trace. This is UMRT&apos;s living record of engineering under
            pressure—and the distance still ahead.
          </p>
          <a href="#achievement-evidence" className={styles.scrollCue}>
            <span>RETRIEVE THE ARCHIVE</span>
            <i aria-hidden="true" />
          </a>
        </div>

        <aside className={styles.archivePanel} aria-label="Achievement archive status">
          <div className={styles.archivePanelTop}>
            <span>ARCHIVE / A-01</span>
            <strong><i aria-hidden="true" /> CURRENT</strong>
          </div>
          <p className={styles.archiveCode}>UMRT // EVIDENCE LOG</p>
          <dl className={styles.archiveDetails}>
            <div>
              <dt>MISSION WINDOW</dt>
              <dd>2020—NOW</dd>
            </div>
            <div>
              <dt>RECORD CLASS</dt>
              <dd>ENGINEERING / FIELD</dd>
            </div>
            <div>
              <dt>TRANSMISSION</dt>
              <dd>CHRONOLOGICAL</dd>
            </div>
          </dl>
          <div className={styles.archiveSignal} aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
          </div>
        </aside>
      </div>
    </section>
  );
}
