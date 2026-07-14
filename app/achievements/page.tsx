'use client';

import dynamic from 'next/dynamic';
import AchievementsHero from '@/components/achievements/AchievementsHero';
import AchievementsStats from '@/components/achievements/AchievementsStats';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';
import styles from './page.module.css';
// Keep the lazy WebGL gallery's projection styles in the route stylesheet.
// Loading them only through the dynamic chunk can leave a frame of unstyled
// CSS3D content during navigation or Fast Refresh.
import '@/components/achievements/HelixGallery3D.module.css';

/**
 * HelixGallery3D — 3D scroll-driven helix timeline/gallery.
 * Dynamic import with ssr:false because it uses WebGL and browser observers.
 */
const HelixGallery3D = dynamic(
  () => import('@/components/achievements/HelixGallery3D'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.archiveLoader} aria-label="Loading the 3D achievement archive">
        <div className={styles.archiveLoaderStage}>
          <div className={styles.loaderOrbit} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.loaderCopy}>
            <span>ARCHIVE / LINKING</span>
            <strong>ACQUIRING ORBITAL RECORDS</strong>
            <div><i /></div>
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
      <main className={styles.page}>
        <AchievementsHero />
        <AchievementsStats />
        <HelixGallery3D />
        <SiteFooter />
      </main>
    </>
  );
}
