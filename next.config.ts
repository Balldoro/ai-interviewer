import type { NextConfig } from 'next';

// Validates env vars when `next dev` / `next build` start, so misconfiguration fails fast.
import './env';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Answers are sent to a Server Action as audio. At the recorder's 32 kbps, 2 MB is about
      // 8 minutes of speech; the default 1 MB would cut off at about 4.
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
