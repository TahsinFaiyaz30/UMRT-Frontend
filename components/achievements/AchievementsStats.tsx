'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Stat data ────────────────────────────────────────────────────── */
interface StatItem {
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
}

const stats: StatItem[] = [
  {
    label: 'Competitions',
    value: 15,
    suffix: '+',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Awards Won',
    value: 8,
    suffix: '',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M8 21H16M12 17V21M6.5 4H17.5L19 8C19 11.87 15.87 15 12 15C8.13 15 5 11.87 5 8L6.5 4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 8H2L3 4H6.5M19 8H22L21 4H17.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Team Members',
    value: 50,
    suffix: '+',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M17 21V19C17 16.79 15.21 15 13 15H5C2.79 15 1 16.79 1 19V21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="9"
          cy="7"
          r="4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M23 21V19C22.99 17.18 21.73 15.63 20 15.13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 3.13C17.74 3.63 19 5.18 19 7C19 8.82 17.74 10.37 16 10.87"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Years Active',
    value: 5,
    suffix: '',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 6V12L16 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

/* ─── Animated counter hook ────────────────────────────────────────── */
function useAnimatedCounter(target: number, isVisible: boolean, duration = 1800) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let start = 0;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      setCount(current);

      if (progress < 1) {
        start = requestAnimationFrame(step);
      }
    }

    start = requestAnimationFrame(step);
    return () => cancelAnimationFrame(start);
  }, [isVisible, target, duration]);

  return count;
}

/* ─── Single stat card ─────────────────────────────────────────────── */
function StatCard({
  stat,
  isVisible,
  index,
}: {
  stat: StatItem;
  isVisible: boolean;
  index: number;
}) {
  const count = useAnimatedCounter(stat.value, isVisible);

  return (
    <div
      className="group relative rounded-2xl border border-mars-200/10 bg-black/20 p-6 backdrop-blur-xl transition-all duration-500 hover:border-mars-300/25 hover:bg-black/30 sm:p-8"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.7s ease ${index * 0.15}s, transform 0.7s ease ${index * 0.15}s`,
      }}
    >
      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          boxShadow:
            '0 0 40px rgba(255,138,77,0.12), inset 0 0 40px rgba(255,138,77,0.04)',
        }}
      />

      {/* Top shimmer line */}
      <div className="absolute inset-x-4 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-mars-300/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Icon */}
      <div className="mb-4 inline-flex rounded-xl border border-mars-200/10 bg-mars-800/40 p-3 text-mars-300 transition-colors duration-300 group-hover:border-mars-300/20 group-hover:text-mars-200">
        {stat.icon}
      </div>

      {/* Number */}
      <div className="font-display text-4xl tracking-tight text-mars-50 sm:text-5xl">
        {count}
        <span className="text-mars-300">{stat.suffix}</span>
      </div>

      {/* Label */}
      <p className="mt-2 font-body text-sm tracking-wide text-mars-100/60 sm:text-base">
        {stat.label}
      </p>

      {/* Decorative corner */}
      <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-mars-300/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */
export default function AchievementsStats() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsVisible(true);
      }
    },
    [],
  );

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.2,
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [handleIntersection]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-mars-900 py-24 sm:py-32"
    >
      {/* Subtle top gradient overlap */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-mars-900 to-transparent" />

      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,138,77,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Section header */}
      <div className="relative mx-auto max-w-6xl px-6">
        <div
          className="mb-16 text-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <p className="mb-3 text-xs uppercase tracking-[0.4em] text-mars-300/80">
            By the Numbers
          </p>
          <h2 className="font-display text-3xl text-mars-50 sm:text-4xl md:text-5xl">
            Impact &amp; Growth
          </h2>
          <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-mars-300/50 to-transparent" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} isVisible={isVisible} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
