'use client';

import dynamic from 'next/dynamic';

// Three.js / WebGL must run in the browser; keep the experience client-only.
// We render a tiny DOM-only shell synchronously so the browser can paint
// and mark the page responsive immediately, instead of stalling on a heavy
// chunk that mounts a WebGL context + R3F Canvas.
const MarsExperience = dynamic(
  () => import('@/components/experience/MarsExperience'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-mars-900 text-mars-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-mars-700/60">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-mars-300" />
          </div>
          <p className="text-xs uppercase tracking-[0.4em] text-mars-200/70">Preparing Mission</p>
        </div>
      </div>
    ),
  },
);

export default function Page() {
  return <MarsExperience />;
}
