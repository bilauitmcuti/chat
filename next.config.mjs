import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import {
  NEXT_CONFIG_EXTRA_HEADER_ENTRIES,
  SECURITY_HEADER_ENTRIES,
} from "./lib/security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
      "@base-ui/react",
      "streamdown",
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
      process.env.TURNSTILE_SITE_KEY?.trim() ||
      "",
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/chat",
        destination: "/",
        permanent: true,
      },
      {
        source: "/chat/",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      ...NEXT_CONFIG_EXTRA_HEADER_ENTRIES,
      ...SECURITY_HEADER_ENTRIES,
    ].map(([key, value]) => ({ key, value }));
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

if (process.env.NODE_ENV === "development" && process.env.SKIP_CLOUDFLARE_DEV !== "1") {
  try {
    await initOpenNextCloudflareForDev();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      [
        "⚠ Cloudflare OpenNext dev bindings unavailable — starting Next.js without Workers AI.",
        "  Chat will return 503 until AI is available.",
        `  Cause: ${message}`,
        "  Fix: ensure api.cloudflare.com is reachable, run `npx wrangler login`, then restart.",
        "  Offline UI only: set SKIP_CLOUDFLARE_DEV=1 before `pnpm dev`.",
      ].join("\n"),
    );
  }
}

export default nextConfig;
