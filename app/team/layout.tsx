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
      <main className="team-page relative min-h-screen" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(127, 33, 15, 0.2), transparent 30%), #050504' }}>
        {/* Premium Grid Overlay */}
        <div className="relative z-10">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
