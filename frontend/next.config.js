/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'laporjalan.id'],
    formats: ['image/avif', 'image/webp'],
  },
  output: 'standalone',
  // API routes are now in the same Next.js app (Vercel serverless)
  // No rewrites needed - /api/v1/* is handled by src/app/api/v1/*/route.ts
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  // PWA configuration
  // pwa: {
  //   dest: 'public',
  //   register: true,
  //   skipWaiting: true,
  //   manifest: {
  //     name: 'Lapor Jalan',
  //     short_name: 'LaporJalan',
  //     description: 'Sistem Pelaporan Kerusakan Infrastruktur Jalan Berbasis AI',
  //     start_url: '/',
  //     display: 'standalone',
  //     background_color: '#ffffff',
  //     theme_color: '#2563eb',
  //     icons: [
  //       { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
  //       { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
  //       { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
  //       { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
  //       { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
  //       { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
  //       { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
  //       { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  //     ],
  //   },
  // },
};

module.exports = nextConfig;