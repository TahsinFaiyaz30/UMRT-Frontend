'use client';

import dynamic from 'next/dynamic';
import AchievementsHero from '@/components/achievements/AchievementsHero';
import AchievementsStats from '@/components/achievements/AchievementsStats';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';

/**
 * HelixGallery3D — 3D scroll-driven helix timeline/gallery.
 * Dynamic import with ssr:false because it uses WebGL and browser observers.
 */
const HelixGallery3D = dynamic(
  () => import('@/components/achievements/HelixGallery3D'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center"
        style={{ height: '500vh', background: '#030306' }}
      >
        <div className="sticky top-0 flex h-screen w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            {/* Thin line loader */}
            <div className="h-px w-16 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full w-8"
                style={{
                  background: 'rgba(255,138,77,0.5)',
                  animation: 'shimmerLoad 1.5s ease-in-out infinite',
                }}
              />
            </div>
            <p
              className="font-body text-[10px] uppercase tracking-[0.5em]"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              Loading Sequence
            </p>
            <style>{`
              @keyframes shimmerLoad {
                0%   { transform: translateX(-32px); }
                100% { transform: translateX(64px); }
              }
            `}</style>
          </div>
        </div>
      </div>
    ),
  },
);

export default function AchievementsPage() {
  return (
    <>
      <PremiumNavbar />
      <main className="bg-mars-900">
        {/* Full-screen hero with particles and glassmorphism card */}
        <AchievementsHero />

        {/* Animated stats counters */}
        <AchievementsStats />

        {/* 
          The 3D scroll-driven helix completely replaces the old 2D timeline 
          and acts as the main chronological achievements display.
        */}
        <HelixGallery3D />

        <SiteFooter />
      </main>
    </>
  );
}
