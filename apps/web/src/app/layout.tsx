import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'STAR-MES Platform',
    template: '%s | STAR-MES',
  },
  description:
    'Enterprise Manufacturing Execution System — Real-time production monitoring, quality management, maintenance, and industrial IoT integration.',
  keywords: ['MES', 'Manufacturing', 'OEE', 'Production', 'Quality', 'Maintenance', 'IIoT', 'SCADA'],
  authors: [{ name: 'STAR-MES', url: 'https://industry360.sa' }],
  creator: 'STAR-MES',
  publisher: 'STAR-MES',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mes.industry360.sa',
    title: 'STAR-MES Platform',
    description: 'Enterprise Manufacturing Execution System',
    siteName: 'STAR-MES',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e17' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head />
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
