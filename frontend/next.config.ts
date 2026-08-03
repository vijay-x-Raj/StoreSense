import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NEXT_PUBLIC_API_URL is injected at build time by Vercel (or .env.local for dev)
};

export default nextConfig;

