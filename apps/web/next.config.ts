import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@influenceai/core', '@influenceai/integrations'],
};

export default nextConfig;
