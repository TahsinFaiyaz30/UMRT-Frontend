'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AchievementsIntro.module.css';

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  code: string;
}

const stats: StatItem[] = [
  { label: 'Competitions', value: 15, suffix: '+', code: 'FIELD / 01' },
  { label: 'Awards Won', value: 8, suffix: '', code: 'MERIT / 02' },
  { label: 'Team Members', value: 50, suffix: '+', code: 'CREW / 03' },
  { label: 'Years Active', value: 5, suffix: '', code: 'TIME / 04' },
];

function usePausableCounter(target: number, active: boolean, duration = 1_500) {
  const [count, setCount] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!active || progressRef.current >= 1) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      progressRef.current = 1;
      setCount(target);
      return undefined;
    }

    let frame = 0;
    const startProgress = progressRef.current;
    const startedAt = performance.now();
    const remainingDuration = Math.max(1, duration * (1 - startProgress));

    const step = (now: number) => {
      const localProgress = Math.min((now - startedAt) / remainingDuration, 1);
      const progress = startProgress + (1 - startProgress) * localProgress;
      const eased = 1 - Math.pow(1 - progress, 3);

      progressRef.current = progress;
      setCount(Math.round(eased * target));

      if (localProgress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, duration, target]);

  return count;
}

function EvidenceCell({ stat, active }: { stat: StatItem; active: boolean }) {
  const count = usePausableCounter(stat.value, active);

  return (
    <article className={styles.statCell} aria-label={`${stat.value}${stat.suffix} ${stat.label}`}>
      <div className={styles.statCellTop} aria-hidden="true">
        <span>{stat.code}</span>
        <i />
      </div>
      <div className={styles.statValue} aria-hidden="true">
        {count}<span>{stat.suffix}</span>
      </div>
      <p className={styles.statLabel} aria-hidden="true">{stat.label}</p>
      <div className={styles.statVerification} aria-hidden="true">
        <span>LOGGED</span>
        <span>VERIFIED RECORD</span>
      </div>
    </article>
  );
}

export default function AchievementsStats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      setRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) setRevealed(true);
      },
      { rootMargin: '0px', threshold: 0.08 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="achievement-evidence"
      className={styles.stats}
      data-active={active}
      data-revealed={revealed}
      aria-labelledby="achievement-evidence-title"
    >
      <div className={styles.statsGlow} aria-hidden="true" />
      <div className={styles.statsInner}>
        <header className={styles.statsHeader}>
          <div>
            <p className={styles.sectionKicker}>
              <span aria-hidden="true">02</span>
              Mission evidence / by the numbers
            </p>
            <h2 id="achievement-evidence-title" className={styles.statsHeading}>
              IMPACT,<br /><span>RECORDED.</span>
            </h2>
          </div>
          <p className={styles.statsDescription}>
            The archive is more than a list of moments. It measures years of
            iteration, collective effort, and systems proven beyond the lab.
          </p>
        </header>

        <div className={styles.evidenceRail}>
          {stats.map((stat) => (
            <EvidenceCell key={stat.label} stat={stat} active={active} />
          ))}
        </div>

        <div className={styles.railFooter} aria-hidden="true">
          <span>UMRT / OPERATIONAL HISTORY</span>
          <span>DATASET / CONTINUOUS</span>
          <span>DHAKA / BANGLADESH</span>
        </div>
      </div>
    </section>
  );
}
