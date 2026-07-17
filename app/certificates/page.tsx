import type { Metadata } from 'next';
import { CertificateValidator } from '@/components/certificates/CertificateValidator';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PremiumNavbar } from '@/components/navbar';

const description =
  'Verify an official UIU Mars Rover Team certificate by certificate ID or recipient name.';

export const metadata: Metadata = {
  title: 'Certificate Verification // UIU Mars Rover Team',
  description,
  openGraph: {
    title: 'Certificate Verification // UIU Mars Rover Team',
    description,
    url: '/certificates',
    type: 'website',
    images: [
      {
        url: '/certificate-verification-og.png',
        width: 1731,
        height: 909,
        alt: 'Verify the record — UIU Mars Rover Team certificate registry',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Certificate Verification // UIU Mars Rover Team',
    description,
    images: ['/certificate-verification-og.png'],
  },
};

export default function CertificatesPage() {
  return (
    <>
      <PremiumNavbar />
      <main>
        <CertificateValidator />
        <SiteFooter />
      </main>
    </>
  );
}
