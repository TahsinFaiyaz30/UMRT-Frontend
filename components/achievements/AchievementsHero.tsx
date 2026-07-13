'use client';

import { useEffect, useRef, useState } from 'react';

/* ─── CSS Keyframes (injected once) ─────────────────────────────────── */
const keyframes = `
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.8); }
  50%      { opacity: 1;   transform: scale(1.2); }
}
@keyframes drift {
  0%   { transform: translateY(0) translateX(0); }
  50%  { transform: translateY(-30px) translateX(12px); }
  100% { transform: translateY(0) translateX(0); }
}
@keyframes scrollBounce {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%      { transform: translateY(8px); opacity: 1; }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(255,138,77,0.15), inset 0 0 20px rgba(255,138,77,0.05); }
  50%      { box-shadow: 0 0 40px rgba(255,138,77,0.3),  inset 0 0 30px rgba(255,138,77,0.1); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

/* ─── Particle field (CSS-only stars) ──────────────────────────────── */
const PARTICLE_COUNT = 60;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 2.5 + 1,
    delay: `${(Math.random() * 6).toFixed(2)}s`,
    duration: `${(Math.random() * 4 + 3).toFixed(2)}s`,
    driftDuration: `${(Math.random() * 12 + 8).toFixed(2)}s`,
    opacity: Math.random() * 0.5 + 0.2,
  }));
}

/* ─── Component ────────────────────────────────────────────────────── */
export default function AchievementsHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(true);
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // Generate particles only on the client to avoid Next.js hydration mismatch
    setParticles(generateParticles());
    
    // Trigger entrance animations after first paint
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: '100px 0px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mars-900">
      {/* Injected keyframes */}
      <style>{keyframes}</style>

      {/* ── Background gradient layers ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Radial warm glow from top-centre */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 15%, rgba(255,138,77,0.12) 0%, transparent 70%)',
          }}
        />
        {/* Bottom-left accent */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 15% 85%, rgba(233,101,42,0.08) 0%, transparent 50%)',
          }}
        />
        {/* Top-right accent */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 85% 20%, rgba(184,67,27,0.06) 0%, transparent 40%)',
          }}
        />
      </div>

      {/* ── Star / particle field ──────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {mounted && particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-mars-100"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animation: `twinkle ${p.duration} ${p.delay} ease-in-out infinite, drift ${p.driftDuration} ${p.delay} ease-in-out infinite`,
              animationPlayState: active ? 'running' : 'paused',
            }}
          />
        ))}
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center">
        {/* Overline */}
        <p
          className="mb-6 text-xs uppercase tracking-[0.5em] text-mars-200/80"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
            transitionDelay: '0.1s',
          }}
        >
          UMRT // Milestones
        </p>

        {/* Headline */}
        <h1
          className="font-display text-[12vw] leading-[0.95] tracking-tight text-mars-50 drop-shadow-[0_4px_32px_rgba(255,138,77,0.25)] md:text-[8vw] lg:text-[6vw]"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity 1s ease, transform 1s ease',
            transitionDelay: '0.25s',
          }}
        >
          Our Achievements
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto mt-6 max-w-2xl font-body text-base leading-relaxed text-mars-100/80 md:text-lg"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 1s ease, transform 1s ease',
            transitionDelay: '0.45s',
          }}
        >
          From the first prototype to the international stage — explore the
          milestones that define UMRT&apos;s relentless pursuit of Mars-ready
          engineering excellence.
        </p>

        {/* ── Glassmorphism highlight card ─────────────────────────── */}
        <div
          className="mx-auto mt-14 max-w-lg"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.96)',
            transition: 'opacity 1.1s ease, transform 1.1s ease',
            transitionDelay: '0.65s',
          }}
        >
          <div
            className="relative rounded-2xl border border-mars-200/10 bg-black/20 p-8 backdrop-blur-xl"
            style={{
              animation: 'glowPulse 4s ease-in-out infinite',
              animationPlayState: active ? 'running' : 'paused',
            }}
          >
            {/* Shimmer bar */}
            <div
              className="absolute inset-x-0 top-0 h-[1px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,178,124,0.5) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 4s linear infinite',
                animationPlayState: active ? 'running' : 'paused',
              }}
            />

            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-mars-300/90">
              Featured Highlight
            </p>
            <h2 className="font-display text-2xl text-mars-50 md:text-3xl">
              Top 10 at URC 2025
            </h2>
            <p className="mt-3 font-body text-sm leading-relaxed text-mars-100/70 md:text-base">
              Competing against 100+ international teams, UMRT secured a top-10
              finish at the University Rover Challenge — the world&apos;s
              premier Mars rover competition.
            </p>

            {/* Decorative corner accents */}
            <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-mars-300/30" />
            <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-mars-300/30" />
          </div>
        </div>
      </div>

      {/* ── Scroll-down indicator ──────────────────────────────────── */}
      <div
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        style={{
          opacity: mounted ? 1 : 0,
          transition: 'opacity 1.2s ease',
          transitionDelay: '1s',
        }}
      >
        <div
          className="flex flex-col items-center gap-2"
          style={{
            animation: 'scrollBounce 2s ease-in-out infinite',
            animationPlayState: active ? 'running' : 'paused',
          }}
        >
          <span className="text-xs uppercase tracking-widest text-mars-100/60">
            Scroll
          </span>
          <svg
            width="20"
            height="28"
            viewBox="0 0 20 28"
            fill="none"
            className="text-mars-200/50"
          >
            <rect
              x="1"
              y="1"
              width="18"
              height="26"
              rx="9"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="10" cy="9" r="2" fill="currentColor">
              <animate
                attributeName="cy"
                values="9;17;9"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0.4;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      </div>

      {/* ── Bottom gradient fade ───────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-mars-900 to-transparent" />
    </section>
  );
}
