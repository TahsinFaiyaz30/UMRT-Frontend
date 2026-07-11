'use client';

import dynamic from 'next/dynamic';
import { ACHIEVEMENT_STATS } from '@/components/achievements/achievementData';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';

const HelixGallery3D = dynamic(
  () => import('@/components/achievements/HelixGallery3D'),
  {
    ssr: false,
    loading: () => (
      <section className="achievement-cosmic-section achievement-cosmic-loading" aria-label="Loading celestial achievement archive">
        <div className="achievement-cosmic-sticky">
          <div className="achievement-archive-loader" role="status">
            <span aria-hidden="true" />
            <strong>Synchronizing the constellation</strong>
            <small>Eight signals / 2020—2025</small>
          </div>
        </div>
      </section>
    ),
  },
);

const CosmicIntroUniverse = dynamic(
  () => import('@/components/achievements/CosmicIntroUniverse'),
  { ssr: false },
);

export default function AchievementsPage() {
  return (
    <>
      <PremiumNavbar />
      <main className="achievement-page bg-mars-900">
        <section className="achievement-intro" aria-labelledby="achievement-page-title">
          <CosmicIntroUniverse />
          <div className="achievement-intro-glow" aria-hidden="true" />
          <div className="achievement-intro-grid">
            <div className="achievement-intro-copy">
              <p>UMRT / Celestial record / 2020—2025</p>
              <h1 id="achievement-page-title">
                <span>Achievements</span>
                <b>In orbit</b>
              </h1>
              <span>
                Not a trophy shelf. A living constellation of every prototype,
                qualification, breakthrough, and world-stage result that moved UMRT forward.
              </span>
              <a href="#cosmic-archive">
                Enter the constellation
                <i aria-hidden="true">↓</i>
              </a>
            </div>

            <dl className="achievement-intro-stats" aria-label="Team achievements by the numbers">
              {ACHIEVEMENT_STATS.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <HelixGallery3D />
        <SiteFooter />
      </main>
    </>
  );
}
