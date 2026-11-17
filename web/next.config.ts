import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial Prerendering: static shells (layout, headings) are prerendered, and anything that reads the
  // session cookie streams in behind <Suspense>. Both flags are the Next.js 16 defaults for new apps.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // A self-contained server (server.js plus only the node_modules it needs) for the Docker image.
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
