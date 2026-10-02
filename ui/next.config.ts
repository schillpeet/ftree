import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drei's <Html> (the member scrolls) loses its content when StrictMode double-mounts it in dev.
  reactStrictMode: false,
};

export default nextConfig;
