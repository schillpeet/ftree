import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",

  // release-please bumps the version in package.json; it is baked into the bundle at build time.
  env: { APP_VERSION: packageJson.version },

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
