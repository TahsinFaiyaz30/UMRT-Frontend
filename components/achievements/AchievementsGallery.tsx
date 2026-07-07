'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/* ------------------------------------------------------------------ */
/*  Achievement data                                                   */
/* ------------------------------------------------------------------ */

interface Achievement {
  year: string;
  title: string;
  category:
    | 'Competition'
    | 'Innovation'
    | 'Award'
    | 'Foundation'
    | 'Outreach'
    | 'Engineering'
    | 'Community';
  description: string;
  image: string | null;
}

const achievements: Achievement[] = [
  {
    year: '2025',
    title: 'URC Top 5 Finish',
    category: 'Competition',
    description:
      'Achieved a top 5 placement at URC 2025 at the Mars Desert Research Station',
    image: null,
  },
  {
    year: '2024',
    title: 'Technical Innovation Award',
    category: 'Innovation',
    description:
      'Won the autonomous navigation category for real-time SLAM and obstacle avoidance',
    image: null,
  },
  {
    year: '2024',
    title: 'URC Top 10 Finish',
    category: 'Competition',
    description:
      'Top 10 at Mars Desert Research Station, our best result to date',
    image: null,
  },
  {
    year: '2023',
    title: 'European Rover Challenge',
    category: 'Competition',
    description:
      "Top 15 finish at ERC in Poland against the world's best university teams",
    image: null,
  },
  {
    year: '2022',
    title: 'Best Rookie Team Award',
    category: 'Award',
    description:
      'Most promising newcomer at URC 2022 among 100+ international teams',
    image: null,
  },
  {
    year: '2022',
    title: 'URC Qualification',
    category: 'Foundation',
    description:
      'First-ever qualification for the University Rover Challenge',
    image: null,
  },
  {
    year: '2021',
    title: 'First Rover Prototype',
    category: 'Engineering',
    description:
      'Built and tested our first 6-wheel rocker-bogie suspension rover',
    image: null,
  },
  {
    year: '2020',
    title: 'Team Founded',
    category: 'Foundation',
    description:
      'UMRT was established uniting students from engineering, science, and design',
    image: null,
  },
];

/* ------------------------------------------------------------------ */
/*  Category colour map                                                */
/* ------------------------------------------------------------------ */

const categoryColor: Record<Achievement['category'], string> = {
  Competition: 'bg-mars-400/80 text-mars-50',
  Innovation: 'bg-amber-500/80 text-mars-900',
  Award: 'bg-yellow-400/80 text-mars-900',
  Foundation: 'bg-mars-300/80 text-mars-900',
  Outreach: 'bg-sky-500/80 text-white',
  Engineering: 'bg-emerald-500/80 text-mars-900',
  Community: 'bg-rose-500/80 text-white',
};

/* ------------------------------------------------------------------ */
/*  Gallery component                                                  */
/* ------------------------------------------------------------------ */

export default function AchievementsGallery() {
  return (
    <section className="relative w-full overflow-hidden bg-mars-900 px-6 py-24 md:px-12 lg:py-32">
      {/* Decorative ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full opacity-20 blur-[160px]"
        style={{
          background:
            'radial-gradient(circle, #ff8a4d 0%, transparent 70%)',
        }}
      />

      {/* Section heading */}
      <div className="relative mx-auto max-w-7xl text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.45em] text-mars-200/70">
          Moments &amp; Memories
        </p>
        <h2 className="font-display text-4xl font-bold tracking-tight text-mars-50 md:text-5xl lg:text-6xl">
          Photo Gallery
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mars-100/70 md:text-lg">
          From international rover challenges to community impact — explore
          the moments that define our journey.
        </p>
      </div>

      {/* Card grid — 1 col → 2 cols sm → 3 cols md → 4 cols lg */}
      <div className="relative mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-8">
        {achievements.map((item, i) => (
          <AchievementCard key={item.title} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera / image placeholder icon (inline SVG)                       */
/* ------------------------------------------------------------------ */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.4}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574v9.176a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual card                                                    */
/* ------------------------------------------------------------------ */

function AchievementCard({
  item,
  index,
}: {
  item: Achievement;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  /* Scroll-triggered staggered entrance */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="group relative"
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div
        className={`
          relative flex flex-col overflow-hidden rounded-2xl
          border border-white/[0.06] bg-white/[0.04] backdrop-blur-md
          transition-all duration-500 ease-out
          ${visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}
          hover:scale-[1.03] hover:border-mars-300/40
        `}
        style={{
          boxShadow: visible ? '0 0 0 0 transparent' : undefined,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            '0 8px 40px rgba(255,138,77,0.25), 0 0 80px rgba(255,138,77,0.15)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            '0 0 0 0 transparent';
        }}
      >
        {/* ---- Image area ---- */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {item.image ? (
            /* Replace src with your image path, e.g. /images/achievements/urc-2025.jpg */
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            /* Placeholder — replace with an Image once photos are available */
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-mars-300/30 bg-mars-800/40">
              {/* Pulsing glow ring behind icon */}
              <div className="relative flex items-center justify-center">
                <span className="absolute h-14 w-14 animate-pulse rounded-full bg-mars-300/10 blur-md" />
                <CameraIcon className="relative h-8 w-8 text-mars-300/60" />
              </div>
              <span className="text-xs font-medium tracking-wide text-mars-300/50">
                Add Photo
              </span>
            </div>
          )}

          {/* Year badge */}
          <div className="absolute right-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 font-display text-[11px] font-bold tracking-wider text-mars-100 backdrop-blur-sm">
              {item.year}
            </span>
          </div>
        </div>

        {/* ---- Content area ---- */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          {/* Category badge */}
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryColor[item.category]}`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70 shadow-[0_0_4px_currentColor]" />
            {item.category}
          </span>

          {/* Title */}
          <h3 className="font-display text-sm font-semibold leading-snug tracking-tight text-mars-50 md:text-base">
            {item.title}
          </h3>

          {/* Description */}
          <p className="text-xs leading-relaxed text-mars-100/60">
            {item.description}
          </p>
        </div>

        {/* Bottom accent line on hover */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-mars-300/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Noise texture overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }}
        />
      </div>
    </div>
  );
}
