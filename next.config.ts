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
        // Product: apex/root → Lobby (not BDK play)
        source: "/",
        destination: "/xi",
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
