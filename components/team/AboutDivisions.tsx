'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useContentRecords } from '@/lib/content';
import { reveal } from './reveal';

/**
 * Abstract marks for the graphical pane, keyed off a division's `iconHint`.
 *
 * All of them are stroke-only line art on `currentColor`, so each block tints
 * itself from the division's own accent. Unknown hints fall through to a
 * neutral orbital mark rather than rendering nothing.
 */
const AbstractGraphic = ({ type }: { type?: string }) => {
  switch (type) {
    case 'gear':
      // Manipulator arm: shoulder, elbow and gripper over a base plate.
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 82h24" />
          <path d="M34 82V64" />
          <path d="m34 64 22-18" />
          <path d="m56 46 18 12" />
          <circle cx="34" cy="64" r="5" />
          <circle cx="56" cy="46" r="5" />
          <path d="m74 58 6-4M74 58l6 5" />
          <path d="M18 86h32" strokeOpacity="0.45" />
          <circle cx="50" cy="50" r="40" strokeOpacity="0.16" strokeDasharray="4 7" />
        </svg>
      );
    case 'zap':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 50h20l10-30 10 60 10-30h10" />
          <rect x="12" y="12" width="76" height="76" rx="16" strokeDasharray="8 8" strokeOpacity="0.35" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 40 22 50l10 10M68 40l10 10-10 10M45 72l10-44" />
          <rect x="12" y="12" width="76" height="76" rx="16" strokeOpacity="0.3" />
        </svg>
      );
    case 'flask':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 18v22L26 76a6 6 0 0 0 5 9h38a6 6 0 0 0 5-9L58 40V18" />
          <path d="M38 18h24" />
          <circle cx="50" cy="66" r="4" strokeOpacity="0.55" />
          <circle cx="40" cy="74" r="2.5" strokeOpacity="0.4" />
          <circle cx="60" cy="75" r="3" strokeOpacity="0.4" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="16" y="34" width="68" height="48" rx="12" />
          <path d="M38 34v-8a8 8 0 0 1 8-8h8a8 8 0 0 1 8 8v8" />
          <path d="M16 54h68" strokeOpacity="0.45" />
          <path d="M44 54v8h12v-8" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="30" width="56" height="42" rx="12" />
          <circle cx="42" cy="51" r="12" />
          <circle cx="42" cy="51" r="4" strokeOpacity="0.5" />
          <path d="m70 42 16-9v36l-16-9z" />
        </svg>
      );
    case 'signal':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 84V58" />
          <circle cx="50" cy="50" r="7" />
          <path d="M33 34a24 24 0 0 1 34 0" />
          <path d="M21 22a41 41 0 0 1 58 0" strokeOpacity="0.5" />
          <path d="M38 84h24" strokeOpacity="0.45" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="16" />
          <ellipse cx="50" cy="50" rx="38" ry="16" strokeOpacity="0.45" transform="rotate(-24 50 50)" />
          <circle cx="82" cy="36" r="3.5" />
        </svg>
      );
  }
};

export const AboutDivisions = () => {
  const { records: divisions } = useContentRecords('divisions');
  const reduce = useReducedMotion();

  return (
    <section className="team-about" aria-labelledby="team-architecture-heading">
      <div className="team-section-header">
        <motion.div
          className="team-section-line"
          aria-hidden="true"
          {...(reduce
            ? {}
            : {
                initial: { scaleX: 0 },
                whileInView: { scaleX: 1 },
                viewport: { once: true },
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              })}
        />
        <motion.p className="team-section-eyebrow" {...reveal(reduce, { y: 10, delay: 0.15 })}>
          SYS_ARCH // DIVISIONS
        </motion.p>
        <motion.h1
          id="team-architecture-heading"
          className="team-section-title"
          {...reveal(reduce, { y: 20, delay: 0.22 })}
        >
          System Architecture
        </motion.h1>
        <motion.p className="team-section-subtitle" {...reveal(reduce, { y: 14, delay: 0.3 })}>
          An inside look at the specialized engineering divisions that build, test, and operate the rover.
        </motion.p>
      </div>

      <div className="team-about-list">
        {/* Accents come from the site palette (`--signal`/`--solar`), not from
            `division.color` — those stock hues are off-brand here. */}
        {divisions.map((division, idx) => (
          <div key={division.id} className="team-division-block">
            {/* Graphic pane */}
            <motion.div
              className="team-division-graphic"
              {...reveal(reduce, { x: idx % 2 === 0 ? 48 : -48, scale: 0.94, duration: 0.85 })}
            >
              <AbstractGraphic type={division.iconHint} />
            </motion.div>

            {/* Content pane */}
            <motion.div
              className="team-division-content"
              {...reveal(reduce, { x: idx % 2 === 0 ? -48 : 48, duration: 0.85, delay: 0.08 })}
            >
              <div className="team-division-head">
                <span className="team-division-code">{division.sysCode}</span>
                <h2 className="team-division-name">{division.name}</h2>
              </div>
              <p className="team-division-desc">{division.description}</p>

              <ul className="team-division-highlights">
                {division.highlights.map((item) => (
                  <li key={item}>
                    <div className="team-division-bullet" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {division.specs && division.specs.length > 0 && (
                <div className="team-division-specs">
                  {division.specs.map((spec) => (
                    <div key={spec.label} className="team-spec-pill">
                      <code>{spec.label}</code>
                      <strong>{spec.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};
