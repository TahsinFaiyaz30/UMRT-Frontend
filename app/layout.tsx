import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

// Self-hosted, preloaded, font-display: swap. Replaces the previous
// render-blocking <link rel="stylesheet"> to fonts.googleapis.com which
// stalled first paint until a third-party CSS file arrived.
const inter = Inter({
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
  title: 'UMRT // Mission Mars',
  description:
    'Cinematic, scroll-driven 3D landing page where a user-provided model roams on Mars before being revealed and freely inspected.',
  metadataBase: new URL('https://umrt.example.com'),
  openGraph: {
    title: 'UMRT // Mission Mars',
    description: 'A WebGL landing page for the Mars rover experience.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} bg-mars-900`}
    >
      <body className="min-h-screen bg-mars-900 font-body text-mars-50 antialiased">
        {children}
      </body>
    </html>
  );
}
