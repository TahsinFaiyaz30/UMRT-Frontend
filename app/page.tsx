'use client';

import dynamic from 'next/dynamic';

// Three.js / WebGL must run in the browser; keep the experience client-only.
const MarsExperience = dynamic(
  () => import('@/components/experience/MarsExperience'),
  { ssr: false },
);

export default function Page() {
  return <MarsExperience />;
}
