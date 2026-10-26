import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Arena Fit — Administration', template: '%s · Arena Fit Admin' },
  robots: { index: false, follow: false },
  icons: { icon: '/brand/arena-fit-logo.png' },
};

export const viewport: Viewport = { themeColor: '#0b0b0d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
