import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BFF_URL ?? "http://localhost:8080"}/:path*`,
      },
    ];
  },

  // drei's <Html> (the member scrolls) loses its content when StrictMode double-mounts it in dev.
  reactStrictMode: false,
};

export default nextConfig;
