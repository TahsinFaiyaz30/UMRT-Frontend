import type { Metadata } from 'next';
import { PremiumNavbar } from '@/components/navbar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { TeamSpaceMount } from '@/components/team/space/TeamSpaceMount';

export const metadata: Metadata = {
  title: 'Team — UMRT // Built Beyond Earth',
  description:
    'Meet the engineers, scientists, and strategists powering the UIU Mars Rover Team.',
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PremiumNavbar />
      <main className="team-page relative min-h-screen">
        {/* A streamed 3D voyage shared by all database-driven team views. */}
        <TeamSpaceMount />
        <div className="team-page-content">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
