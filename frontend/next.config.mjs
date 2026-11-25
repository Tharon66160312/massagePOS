const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Forward all /api/* calls (except Frontend's own /api/auth/*) to the Backend server
      fallback: [
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL}/api/:path*`,
        },
      ],
    };
  },
};
