import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GAME_SERVER_URL: process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:3001',
    NEXT_PUBLIC_GAME_SERVER_WS: process.env.NEXT_PUBLIC_GAME_SERVER_WS ?? 'ws://localhost:3001',
  },
};

export default nextConfig;
