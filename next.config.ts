import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/xi/bdk",
        destination: "/xi/bull-demon-king",
        permanent: true,
      },
      {
        // Compat: legacy root slot → canonical play (single GameClient stack)
        source: "/",
        destination: "/xi/bull-demon-king/play",
        permanent: true,
      },
      {
        source: "/game",
        destination: "/xi/bull-demon-king/play",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
