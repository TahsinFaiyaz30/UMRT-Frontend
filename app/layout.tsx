import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="bg-mars-900">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-mars-900 font-body text-mars-50 antialiased">
        {children}
      </body>
    </html>
  );
}
