import type { Metadata } from 'next';
import { CertificatesArchive } from '@/components/certificates/CertificatesArchive';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';

const description =
  'Explore the UIU Mars Rover Team certificate archive, with official competition and engineering records arriving soon.';

export const metadata: Metadata = {
  title: 'Certificates // UIU Mars Rover Team',
  description,
  openGraph: {
    title: 'Certificates // UIU Mars Rover Team',
    description,
    url: '/certificates',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1732,
        height: 909,
        alt: 'UIU Mars Rover Team certificate archive',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Certificates // UIU Mars Rover Team',
    description,
    images: ['/og.png'],
  },
};

export default function CertificatesPage() {
  return (
    <>
      <PremiumNavbar />
      <main>
        <CertificatesArchive />
        <SiteFooter />
      </main>
    </>
  );
}
