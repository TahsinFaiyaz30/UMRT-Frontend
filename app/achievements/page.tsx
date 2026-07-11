'use client';

import dynamic from 'next/dynamic';
import AchievementsFooter from '@/components/achievements/AchievementsFooter';
import { ACHIEVEMENT_STATS } from '@/components/achievements/achievementData';
import { PremiumNavbar } from '@/components/navbar';

/**
 * HelixGallery3D — 3D scroll-driven helix timeline/gallery.
 * Dynamic import with ssr:false because it uses WebGL.
 */
const HelixGallery3D = dynamic(
  () => import('@/components/achievements/HelixGallery3D'),
  {
    ssr: false,
    loading: () => (
      <section className="achievement-helix-section achievement-helix-loading" aria-label="Loading achievement archive">
        <div className="achievement-helix-sticky">
          <div className="achievement-archive-loader" role="status">
            <span aria-hidden="true" />
            <strong>Preparing rover archive</strong>
            <small>Eight milestones / 2020—2025</small>
          </div>
        </div>
      </section>
    ),
  },
);

export default function AchievementsPage() {
  return (
    <>
      <PremiumNavbar />
      <main className="achievement-page bg-mars-900">
        <section className="achievement-intro" aria-labelledby="achievement-page-title">
          <div className="achievement-intro-glow" aria-hidden="true" />
          <div className="achievement-intro-grid">
            <div className="achievement-intro-copy">
              <p>UMRT / Mission record / 2020—2025</p>
              <h1 id="achievement-page-title">Achievements</h1>
              <span>
                Every qualification, prototype, and competition run helped build the
                machine at the centre of this archive.
              </span>
              <a href="#helix-gallery">
                Enter the archive
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
        <AchievementsFooter />
      </main>
    </>
  );
}
