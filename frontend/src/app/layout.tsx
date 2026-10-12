import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SWRegistration } from '@/hooks/SWRegistration';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Lapor Jalan - Pelaporan Kerusakan Jalan Berbasis AI',
  description: 'Sistem pelaporan kerusakan infrastruktur jalan otomatis dengan analisis AI, routing ke instansi berwenang, dan notifikasi real-time',
  keywords: ['lapor jalan', 'kerusakan jalan', 'infrastruktur', 'AI', 'smart city', 'pelaporan publik'],
  authors: [{ name: 'Lapor Jalan Team' }],
  creator: 'Lapor Jalan',
  publisher: 'Lapor Jalan',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://laporjalan.id',
    title: 'Lapor Jalan - Pelaporan Kerusakan Jalan Berbasis AI',
    description: 'Lapor kerusakan jalan mudah via chat, AI analisis foto, otomatis ke instansi berwenang',
    siteName: 'Lapor Jalan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lapor Jalan',
    description: 'Pelaporan kerusakan jalan cerdas dengan AI',
  },
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#18181b" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-secondary-50 dark:bg-secondary-950 antialiased">
        <Providers>
          <SWRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}