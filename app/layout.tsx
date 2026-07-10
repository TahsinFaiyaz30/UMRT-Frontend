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
      <head>
        {/*
          Preload the GLB at the byte level. The browser starts the network
          fetch the moment it sees this <link> — *before* React mounts and
          *before* `useGLTF` runs. By the time MarsExperience mounts, the
          file is either already in cache (warm) or already streaming
          (cold). Either way, the long-task is no longer on the JS thread.

          We use as="fetch" with crossOrigin so the response goes into the
          HTTP cache, not just the memory cache.
        */}
        <link
          rel="preload"
          as="fetch"
          crossOrigin="anonymous"
          href="/models/curiosity_v4_semantic_external.glb"
        />
      </head>
      <body className="min-h-screen bg-mars-900 font-body text-mars-50 antialiased selection:bg-[#d8ff4f] selection:text-black">
        {children}
      </body>
    </html>
  );
}
