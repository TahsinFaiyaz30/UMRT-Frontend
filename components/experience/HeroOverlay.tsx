'use client';

import type { CSSProperties } from 'react';
import { phaseAt, phases } from '@/lib/scrollTimeline';

export type SectionId =
  | 'hero_intro'
  | 'zoom_in'
  | 'full_model_reveal'
  | 'part_focus_1'
  | 'part_focus_2_left'
  | 'part_focus_3_right'
  | 'final_recenter'
  | 'free_explore_unlock';

type Chapter = {
  id: SectionId;
  index: string;
  eyebrow: string;
  title: string[];
  body: string;
  stat: string;
  statLabel: string;
  align: 'left' | 'right';
};

export const sectionMeta: Chapter[] = [
  {
    id: 'hero_intro',
    index: '00',
    eyebrow: 'UIU Mars Rover Team / Dhaka',
    title: ['BUILT FOR', 'WORLDS', 'WITHOUT ROADS'],
    body: 'A student-built exploration system engineered to see, reach, and survive where human footsteps cannot.',
    stat: '23.8103° N',
    statLabel: 'EARTH ORIGIN',
    align: 'left',
  },
  {
    id: 'zoom_in',
    index: '01',
    eyebrow: 'Object acquired / UMRT Rover',
    title: ['NOT A VEHICLE.', 'A FIELD', 'LABORATORY.'],
    body: 'Every surface is deliberate. Every gram negotiates between mobility, science, power, and a planet that forgives nothing.',
    stat: '01',
    statLabel: 'INTEGRATED SYSTEM',
    align: 'left',
  },
  {
    id: 'full_model_reveal',
    index: '02',
    eyebrow: 'Complete platform / visual lock',
    title: ['ONE MACHINE.', 'SIX DISCIPLINES.'],
    body: 'Mechanical, electrical, autonomy, communication, science, and software converge into a single surface-ready architecture.',
    stat: '360°',
    statLabel: 'SYSTEM VIEW',
    align: 'right',
  },
  {
    id: 'part_focus_1',
    index: '03',
    eyebrow: 'Perception stack / mast',
    title: ['SEE BEFORE', 'YOU MOVE.'],
    body: 'Stereo vision and terrain intelligence turn raw distance into a traversable world — one decision at a time.',
    stat: '2×',
    statLabel: 'STEREO VISION',
    align: 'left',
  },
  {
    id: 'part_focus_2_left',
    index: '04',
    eyebrow: 'Manipulator / science payload',
    title: ['TOUCH THE', 'UNKNOWN.'],
    body: 'The science arm transforms remote terrain into physical evidence: reach, inspect, collect, return data.',
    stat: '6 DOF',
    statLabel: 'MANIPULATION',
    align: 'right',
  },
  {
    id: 'part_focus_3_right',
    index: '05',
    eyebrow: 'Rocker-bogie / mobility',
    title: ['MOVE WHERE', 'MAPS END.'],
    body: 'Independent articulation keeps the chassis composed while every wheel negotiates a different version of the ground.',
    stat: '6×6',
    statLabel: 'ALL-TERRAIN DRIVE',
    align: 'left',
  },
  {
    id: 'final_recenter',
    index: '06',
    eyebrow: 'Semantic teardown / live',
    title: ['NOW, OPEN', 'THE MACHINE.'],
    body: 'Scroll through the architecture. The rover separates by subsystem, exposes its internal science stack, then returns home.',
    stat: '14+',
    statLabel: 'SEPARATE SYSTEMS',
    align: 'right',
  },
  {
    id: 'free_explore_unlock',
    index: '07',
    eyebrow: 'Manual control / unlocked',
    title: ['THE ROVER', 'IS YOURS.'],
    body: 'Drag to orbit. Pinch or scroll to zoom. Trigger the teardown again and inspect the machine from any angle.',
    stat: 'LIVE',
    statLabel: 'INTERACTIVE MODEL',
    align: 'left',
  },
];

const chapterSections = sectionMeta.slice(1, -1);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function chapterStyle(id: SectionId, progress: number): CSSProperties {
  const phase = phases.find((item) => item.name === id) ?? phases[0];
  const local = clamp((progress - phase.start) / Math.max(0.001, phase.end - phase.start));
  const envelope = Math.sin(local * Math.PI);
  const visibility = clamp(envelope * 1.75);
  return {
    '--chapter-progress': local.toFixed(4),
    '--chapter-visibility': visibility.toFixed(4),
    '--chapter-depth': (local - 0.5).toFixed(4),
    '--chapter-zoom': (0.72 + visibility * 0.28).toFixed(4),
  } as CSSProperties;
}

export function HeroOverlay({ progress }: { loading?: boolean; progress: number }) {
  const phase = phaseAt(progress);
  const phaseIndex = Math.max(0, phases.findIndex((item) => item.name === phase.name));
  const heroFade = clamp(1 - progress / 0.145);
  const heroExit = clamp(progress / 0.145);
  const heroScale = 1 + heroExit * 0.34;
  const heroStyle = {
    '--hero-fade': heroFade.toFixed(4),
    '--hero-scale': heroScale.toFixed(4),
    '--hero-exit': heroExit.toFixed(4),
  } as CSSProperties;

  return (
    <div className="mission-overlay" style={{ '--mission-progress': progress } as CSSProperties}>
      <div className="mission-atmosphere" aria-hidden="true">
        <div className="mission-grain" />
        <div className="mission-vignette" />
        <div className="mission-crosshair mission-crosshair-a" />
        <div className="mission-crosshair mission-crosshair-b" />
      </div>

      <aside className="mission-telemetry mission-telemetry-left" aria-hidden="true">
        <span>UMRT / SURFACE UNIT</span>
        <span>SYS 07.10</span>
      </aside>
      <aside className="mission-telemetry mission-telemetry-right" aria-hidden="true">
        <span>23.8103 N</span>
        <span>90.4125 E</span>
      </aside>

      <section id="hero_intro" data-phase="hero_intro" className="mission-hero" style={heroStyle}>
        <div className="mission-hero-inner">
          <p className="mission-kicker">
            <span className="signal-dot" />
            {sectionMeta[0].eyebrow}
          </p>
          <h1 className="mission-title" aria-label="Built for worlds without roads">
            <span className="mission-title-line">BUILT FOR</span>
            <span className="mission-title-line mission-title-outline">WORLDS</span>
            <span className="mission-title-line mission-title-indent">WITHOUT ROADS</span>
          </h1>
          <div className="mission-hero-footer">
            <p>{sectionMeta[0].body}</p>
            <a href="#zoom_in" className="mission-scroll-cue">
              <span>ENTER THE MISSION</span>
              <i aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="mission-orbit-label" aria-hidden="true">
          <span>OBJECT / ROVER 01</span>
          <span>TRACKING LOCKED</span>
        </div>
      </section>

      {chapterSections.map((chapter) => (
        <section
          key={chapter.id}
          id={chapter.id}
          data-phase={chapter.id}
          className={`mission-chapter mission-chapter-${chapter.align} mission-chapter-${chapter.id}`}
          style={chapterStyle(chapter.id, progress)}
        >
          <div className="mission-chapter-sticky">
            <div className="mission-chapter-echo" aria-hidden="true">
              {chapter.title.join(' ')}
            </div>
            <article className="mission-chapter-copy">
              <div className="mission-chapter-index">/{chapter.index}</div>
              <p className="mission-chapter-eyebrow">{chapter.eyebrow}</p>
              <h2>
                {chapter.title.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h2>
              <p className="mission-chapter-body">{chapter.body}</p>
              <div className="mission-stat">
                <strong>{chapter.stat}</strong>
                <span>{chapter.statLabel}</span>
              </div>
            </article>
            <div className="mission-measure" aria-hidden="true">
              <span />
              <small>{chapter.index} / 07</small>
              <span />
            </div>
          </div>
        </section>
      ))}

      <section
        id="free_explore_unlock"
        data-phase="free_explore_unlock"
        className="mission-chapter mission-chapter-free"
        style={chapterStyle('free_explore_unlock', progress)}
      >
        <div className="mission-chapter-sticky">
          <article className="mission-free-copy">
            <p className="mission-chapter-eyebrow">{sectionMeta[7].eyebrow}</p>
            <h2>
              <span>THE ROVER</span>
              <span>IS YOURS.</span>
            </h2>
            <p>{sectionMeta[7].body}</p>
            <div className="mission-control-legend" aria-label="3D model controls">
              <span><b>01</b> LEFT DRAG / ORBIT</span>
              <span><b>02</b> RIGHT DRAG / PAN</span>
              <span><b>03</b> WHEEL / ZOOM</span>
              <span><b>04</b> SLIDER / EXPLODE</span>
            </div>
            <a className="mission-exit-lab" href="#mission-footer">EXIT LAB / CONTACT ↓</a>
          </article>
        </div>
      </section>

      <div className="mission-progress" aria-label={`Mission progress ${Math.round(progress * 100)} percent`}>
        <div className="mission-progress-meta">
          <span>{String(phaseIndex + 1).padStart(2, '0')}</span>
          <span>{phase.label}</span>
          <span>{Math.round(progress * 100).toString().padStart(2, '0')}%</span>
        </div>
        <div className="mission-progress-track"><i /></div>
      </div>
    </div>
  );
}
