'use client';

import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  AchievementsFooter — CTA section for the achievements page         */
/* ------------------------------------------------------------------ */

export default function AchievementsFooter() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  /* Scroll-triggered entrance */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate w-full overflow-hidden bg-gradient-to-b from-mars-900 via-mars-800/60 to-mars-900"
    >
      {/* ---- Decorative elements ---- */}

      {/* Top accent border */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mars-300/25 to-transparent"
      />

      {/* Large ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full opacity-15 blur-[140px]"
        style={{ background: 'radial-gradient(circle, #ff8a4d 0%, transparent 70%)' }}
      />

      {/* Floating ring decoration — left */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-48 w-48 rounded-full border border-mars-300/10 opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-24 h-32 w-32 rounded-full border border-mars-400/[0.07]"
      />

      {/* Floating ring decoration — right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-12 h-40 w-40 rounded-full border border-mars-300/10 opacity-40"
      />

      {/* Tiny floating particles */}
      <Particles />

      {/* ---- Content ---- */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center md:py-32 lg:py-40">
        {/* Badge */}
        <span
          className={`mb-6 inline-flex items-center gap-2 rounded-full border border-mars-300/20 bg-mars-700/30 px-4 py-1.5 text-[11px] font-medium uppercase tracking-widest text-mars-200 backdrop-blur transition-all duration-700 ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-mars-300 shadow-[0_0_6px_rgba(255,138,77,0.6)]" />
          Open to New Members
        </span>

        {/* Heading */}
        <h2
          className={`font-display text-4xl font-bold tracking-tight text-mars-50 transition-all duration-700 delay-100 md:text-5xl lg:text-6xl ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          Join Our{' '}
          <span className="bg-gradient-to-r from-mars-300 via-mars-400 to-mars-200 bg-clip-text text-transparent">
            Mission
          </span>
        </h2>

        {/* Subtitle */}
        <p
          className={`mx-auto mt-5 max-w-xl text-base leading-relaxed text-mars-100/70 transition-all duration-700 delay-200 md:text-lg ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          Be part of the team that&apos;s building the future of Mars exploration.
          Whether you&apos;re an engineer, scientist, or storyteller — there&apos;s a
          seat for you on this mission.
        </p>

        {/* CTA buttons */}
        <div
          className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-5 transition-all duration-700 delay-300 ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          {/* Primary — Join UMRT */}
          <a
            href="/join"
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-mars-300 to-mars-400 px-8 py-3.5 text-sm font-semibold tracking-wide text-mars-900 shadow-[0_4px_24px_rgba(255,138,77,0.35)] transition-all duration-300 hover:shadow-[0_6px_36px_rgba(255,138,77,0.55)] hover:scale-[1.04]"
          >
            {/* Shine sweep on hover */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />

            <RocketIcon />
            <span className="relative">Join UMRT</span>
          </a>

          {/* Secondary — Back to Home */}
          <a
            href="/"
            className="inline-flex items-center gap-2.5 rounded-full border border-mars-300/30 bg-mars-800/40 px-8 py-3.5 text-sm font-medium tracking-wide text-mars-100 backdrop-blur transition-all duration-300 hover:border-mars-300/60 hover:bg-mars-700/50 hover:text-mars-50 hover:scale-[1.03]"
          >
            <ArrowLeftIcon />
            <span>Back to Home</span>
          </a>
        </div>

        {/* Subtle divider */}
        <div className="mt-16 h-px w-32 bg-gradient-to-r from-transparent via-mars-300/20 to-transparent" />

        {/* Attribution */}
        <p className="mt-6 text-xs text-mars-100/30">
          UIU Mars Rover Team &middot; Pioneering the Martian frontier
        </p>
      </div>

      {/* Bottom accent border */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-mars-300/15 to-transparent"
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Decorative floating particles                                      */
/* ------------------------------------------------------------------ */

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    interface Particle {
      x: number;
      y: number;
      r: number;
      speed: number;
      opacity: number;
      drift: number;
    }

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const particles: Particle[] = Array.from({ length: 24 }, () => ({
      x: Math.random() * w(),
      y: Math.random() * h(),
      r: 1 + Math.random() * 1.5,
      speed: 0.15 + Math.random() * 0.3,
      opacity: 0.15 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.3,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w(), h());
      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -10) {
          p.y = h() + 10;
          p.x = Math.random() * w();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 138, 77, ${p.opacity})`;
        ctx.fill();
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Inline icons                                                       */
/* ------------------------------------------------------------------ */

function RocketIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
