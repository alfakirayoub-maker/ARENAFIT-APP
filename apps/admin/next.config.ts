import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** True for a Supabase server key: a legacy service_role JWT or a new sb_secret_ key. */
function isServerKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true;
  const payload = value.split('.')[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * Deployment guard (Vercel builds): the browser gets only public Supabase values.
 * Fails the build when a server key sits in any NEXT_PUBLIC_* variable, or when
 * the project URL is not a hosted https URL.
 */
if (process.env.VERCEL === '1') {
  const leaked = Object.entries(process.env).filter(([k, v]) => k.startsWith('NEXT_PUBLIC_') && v && isServerKey(v.trim()));
  if (leaked.length) throw new Error(`Server key in public variable(s): ${leaked.map(([k]) => k).join(', ')}. Use the anon/publishable key.`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be https://<project-ref>.supabase.co (got "${url}").`);
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
}

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
