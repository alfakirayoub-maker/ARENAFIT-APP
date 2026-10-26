import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@arenafit/reception-print'],
  // The dashboard is internal: never indexed.
  async headers() {
    return [{ source: '/:path*', headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
