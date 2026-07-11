import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '700'],
});

export const metadata: Metadata = {
  title: 'UMRT // Built Beyond Earth',
  description:
    'Enter the machine. A cinematic, scroll-driven 3D experience by the UIU Mars Rover Team.',
  metadataBase: new URL('https://umrt.example.com'),
  openGraph: {
    title: 'UMRT // Built Beyond Earth',
    description: 'Enter the machine. Explore the rover built for worlds without roads.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1732,
        height: 909,
        alt: 'Built for worlds without roads — UIU Mars Rover Team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UMRT // Built Beyond Earth',
    description: 'Enter the machine. Explore the rover built for worlds without roads.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${spaceGrotesk.variable} bg-mars-900`}
    >
      <body className="min-h-screen bg-mars-900 font-body text-mars-50 antialiased selection:bg-[#d8ff4f] selection:text-black">
        {children}
      </body>
    </html>
  );
}
