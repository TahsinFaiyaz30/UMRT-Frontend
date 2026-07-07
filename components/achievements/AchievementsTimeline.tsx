'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Category = 'Foundation' | 'Competition' | 'Innovation' | 'Award' | 'Outreach';

interface Achievement {
  year: string;
  title: string;
  description: string;
  category: Category;
}

const achievements: Achievement[] = [
  {
    year: '2020',
    title: 'Team Founded',
    description:
      'UMRT was established with a vision to design and build Mars rover prototypes, uniting students from engineering, science, and design disciplines.',
    category: 'Foundation',
  },
  {
    year: '2021',
    title: 'First Rover Prototype',
    description:
      'Successfully built and tested our first functional rover prototype, featuring a custom six-wheel rocker-bogie suspension system.',
    category: 'Innovation',
  },
  {
    year: '2022',
    title: 'URC Qualification',
    description:
      'Qualified for the University Rover Challenge for the first time, a testament to two years of relentless engineering effort.',
    category: 'Competition',
  },
  {
    year: '2022',
    title: 'Best Rookie Team Award',
    description:
      'Recognized as the most promising newcomer at URC 2022, standing out among 100+ international teams for our innovative design approach.',
    category: 'Award',
  },
  {
    year: '2023',
    title: 'International Competition',
    description:
      'Competed in the European Rover Challenge in Poland, placing in the top 15 against the world\'s best university rover teams.',
    category: 'Competition',
  },
  {
    year: '2024',
    title: 'Technical Innovation Award',
    description:
      'Won the technical innovation category for our autonomous navigation system, featuring real-time SLAM and obstacle avoidance.',
    category: 'Innovation',
  },
  {
    year: '2024',
    title: 'URC Top 10 Finish',
    description:
      'Achieved a top 10 placement at URC 2024 in the Mars Desert Research Station, our best result to date.',
    category: 'Competition',
  },
  {
    year: '2025',
    title: 'Community Outreach Award',
    description:
      'Recognized for STEM education initiatives reaching 1,000+ students through workshops, demos, and mentorship programmes.',
    category: 'Outreach',
  },
];

/* ------------------------------------------------------------------ */
/*  Category styling                                                   */
/* ------------------------------------------------------------------ */

const categoryStyles: Record<Category, { bg: string; text: string; glow: string }> = {
  Foundation: {
    bg: 'bg-mars-300/15',
    text: 'text-mars-300',
    glow: 'shadow-[0_0_8px_rgba(255,138,77,0.25)]',
  },
  Competition: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    glow: 'shadow-[0_0_8px_rgba(56,189,248,0.25)]',
  },
  Innovation: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.25)]',
  },
  Award: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_8px_rgba(251,191,36,0.25)]',
  },
  Outreach: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    glow: 'shadow-[0_0_8px_rgba(167,139,250,0.25)]',
  },
};

/* ------------------------------------------------------------------ */
/*  TimelineEntry                                                      */
/* ------------------------------------------------------------------ */

function TimelineEntry({
  achievement,
  index,
  isVisible,
}: {
  achievement: Achievement;
  index: number;
  isVisible: boolean;
}) {
  const isLeft = index % 2 === 0;
  const cat = categoryStyles[achievement.category];

  return (
    <div
      className={`
        group relative flex w-full items-center
        md:justify-${isLeft ? 'start' : 'end'}
      `}
    >
      {/* ---- Connecting arm (desktop only) ---- */}
      <div
        className={`
          pointer-events-none absolute top-1/2 hidden h-px w-[calc(50%-2rem)] md:block
          ${isLeft ? 'left-[50%] ml-4' : 'right-[50%] mr-4'}
        `}
      >
        <div
          className={`
            h-full origin-${isLeft ? 'left' : 'right'} bg-gradient-to-${isLeft ? 'r' : 'l'}
            from-mars-300/50 to-transparent
            transition-transform duration-700 ease-out
            ${isVisible ? 'scale-x-100' : 'scale-x-0'}
          `}
        />
      </div>

      {/* ---- Card ---- */}
      <div
        className={`
          relative z-10 w-full
          md:w-[calc(50%-3rem)]
          ${isLeft ? 'md:mr-auto' : 'md:ml-auto'}
          transition-all duration-700 ease-out
          ${
            isVisible
              ? 'translate-x-0 translate-y-0 opacity-100'
              : isLeft
                ? '-translate-x-12 translate-y-4 opacity-0'
                : 'translate-x-12 translate-y-4 opacity-0'
          }
        `}
      >
        {/* Year badge */}
        <div
          className={`
            mb-3 inline-flex items-center gap-2 rounded-full
            border border-mars-300/30 bg-mars-300/10 px-4 py-1.5
            shadow-[0_0_16px_rgba(255,138,77,0.2)]
            transition-shadow duration-500
            group-hover:shadow-[0_0_24px_rgba(255,138,77,0.35)]
          `}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mars-300" />
          <span className="font-display text-sm font-bold tracking-widest text-mars-300">
            {achievement.year}
          </span>
        </div>

        {/* Glass card */}
        <div
          className={`
            rounded-2xl border border-white/[0.06]
            bg-gradient-to-br from-white/[0.06] to-white/[0.02]
            p-6 backdrop-blur-xl
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_8px_40px_-12px_rgba(0,0,0,0.5)]
            transition-all duration-500
            hover:border-mars-300/20 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_48px_-8px_rgba(255,138,77,0.12)]
            md:p-8
          `}
        >
          {/* Category tag */}
          <span
            className={`
              inline-block rounded-full px-3 py-1 text-[11px] font-semibold
              uppercase tracking-wider ${cat.bg} ${cat.text} ${cat.glow}
              mb-4
            `}
          >
            {achievement.category}
          </span>

          <h3 className="font-display text-xl font-bold leading-tight text-mars-50 md:text-2xl">
            {achievement.title}
          </h3>

          <p className="mt-3 font-body text-sm leading-relaxed text-mars-100/70 md:text-base">
            {achievement.description}
          </p>

          {/* Decorative bottom gradient line */}
          <div className="mt-6 h-px w-full overflow-hidden rounded-full bg-mars-700/40">
            <div
              className={`
                h-full bg-gradient-to-r from-transparent via-mars-300/40 to-transparent
                transition-all duration-1000
                ${isVisible ? 'w-full' : 'w-0'}
              `}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AchievementsTimeline() {
  const [visibleEntries, setVisibleEntries] = useState<Set<number>>(new Set());
  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setEntryRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      entryRefs.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    entryRefs.current.forEach((el, index) => {
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleEntries((prev) => {
              const next = new Set(prev);
              next.add(index);
              return next;
            });
            observer.unobserve(el);
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section className="relative overflow-hidden bg-mars-900 px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      {/* ---- Background glow ---- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-mars-300/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-mars-400/[0.03] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        {/* ---- Section Header ---- */}
        <div className="mb-20 text-center md:mb-28">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.4em] text-mars-300/80">
            Our Journey
          </p>
          <h2 className="font-display text-4xl font-bold leading-tight text-mars-50 drop-shadow-[0_2px_12px_rgba(255,138,77,0.15)] md:text-6xl lg:text-7xl">
            Achievements
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-body text-base text-mars-100/60 md:text-lg">
            From our founding to the global stage — every milestone on our mission to Mars.
          </p>
        </div>

        {/* ---- Timeline ---- */}
        <div className="relative">
          {/* Central spine (desktop) */}
          <div className="absolute left-4 top-0 hidden h-full w-px md:left-1/2 md:block md:-translate-x-px">
            <div className="h-full w-full bg-gradient-to-b from-transparent via-mars-300/25 to-transparent" />
          </div>

          {/* Mobile spine */}
          <div className="absolute left-4 top-0 block h-full w-px md:hidden">
            <div className="h-full w-full bg-gradient-to-b from-transparent via-mars-300/25 to-transparent" />
          </div>

          <div className="flex flex-col gap-12 md:gap-20">
            {achievements.map((achievement, index) => {
              const isVisible = visibleEntries.has(index);

              return (
                <div
                  key={`${achievement.year}-${achievement.title}`}
                  ref={setEntryRef(index)}
                  className="relative pl-12 md:pl-0"
                >
                  {/* ---- Timeline dot ---- */}
                  {/* Mobile dot */}
                  <div className="absolute left-4 top-6 z-20 -translate-x-1/2 md:hidden">
                    <div
                      className={`
                        relative h-4 w-4 rounded-full border-2 border-mars-300
                        bg-mars-900 transition-all duration-700
                        ${isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
                      `}
                    >
                      <div className="absolute inset-0 animate-ping rounded-full bg-mars-300/40" />
                      <div className="absolute inset-[3px] rounded-full bg-mars-300" />
                    </div>
                  </div>

                  {/* Desktop dot */}
                  <div className="absolute left-1/2 top-8 z-20 hidden -translate-x-1/2 md:block">
                    <div
                      className={`
                        relative h-5 w-5 rounded-full border-2 border-mars-300
                        bg-mars-900 transition-all duration-700
                        ${isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
                      `}
                    >
                      <div className="absolute inset-0 animate-ping rounded-full bg-mars-300/30" />
                      <div className="absolute inset-[4px] rounded-full bg-mars-300 shadow-[0_0_12px_rgba(255,138,77,0.6)]" />
                    </div>
                  </div>

                  <TimelineEntry
                    achievement={achievement}
                    index={index}
                    isVisible={isVisible}
                  />
                </div>
              );
            })}
          </div>

          {/* ---- Terminal dot ---- */}
          <div className="mx-auto mt-16 flex flex-col items-center gap-3 md:mt-24">
            <div className="relative h-3 w-3">
              <div className="absolute inset-0 animate-ping rounded-full bg-mars-300/30" />
              <div className="h-full w-full rounded-full bg-mars-300 shadow-[0_0_16px_rgba(255,138,77,0.5)]" />
            </div>
            <span className="font-display text-xs uppercase tracking-[0.5em] text-mars-300/60">
              More to come
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
