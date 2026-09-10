import type { Metadata } from 'next';
import { PremiumNavbar } from '@/components/navbar';
import { SiteFooter } from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Team — UMRT // Built Beyond Earth',
  description:
    'Meet the engineers, scientists, and strategists powering the UIU Mars Rover Team.',
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PremiumNavbar />
      {/* The nebula/star backdrop lives on `.team-page` in globals.css so all
          three views share one treatment. */}
      <main className="team-page relative min-h-screen">
        <div className="team-page-content">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
