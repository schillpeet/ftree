import type { NextConfig } from "next";
import packageJson from "./package.json";

const isDev = process.env.NODE_ENV === "development";

// Next.js streams the page with inline scripts, and `RIDE_PENDING` in `app/layout.tsx` is one too; nonces would make every
// page render per request, so scripts stay on `'unsafe-inline'`. Inline styles come from React's `style` props and drei's
// `<Html>`, `data:` images from the snapshot (`html-to-image`), `blob:` images from the preview of a picked photo. Photos,
// the API, and its event stream are same-origin through the `/api` rewrite; fonts are self-hosted by `next/font`.
// In development React needs `eval`, and hot reloading a WebSocket.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Report-only for now: browsers log violations in the console and block nothing, `frame-ancestors` included.
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Tree URLs name a family, so they stay on this site.
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },

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
