import fs from "fs";
import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import {
  NEXT_CONFIG_EXTRA_HEADER_ENTRIES,
  SECURITY_HEADER_ENTRIES,
} from "./lib/security-headers.mjs";

/**
 * One stable id for client bundle + /api/version across multi-pass Next/OpenNext builds.
 * Prefer CI SHA; otherwise persist once to `.next-build-id` for this build.
 */
function resolvePublicBuildId() {
  const fromEnv =
    process.env.NEXT_PUBLIC_BUILD_ID?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim() ||
    "";
  if (fromEnv) return fromEnv;

  const filePath = path.join(process.cwd(), ".next-build-id");
  try {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, "utf8").trim();
      if (existing) return existing;
    }
  } catch {
    // fall through to write
  }

  const generated = `${Date.now()}`;
  try {
    fs.writeFileSync(filePath, generated, "utf8");
  } catch {
    // still return generated so this process stays consistent
  }
  return generated;
}

const PUBLIC_BUILD_ID = resolvePublicBuildId();

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
    NEXT_PUBLIC_BUILD_ID: PUBLIC_BUILD_ID,
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
  /**
   * Dual-host: HTML references /chat/_next/*. OpenNext emits files under
   * .open-next/assets/_next; scripts/mirror-chat-assets.mjs copies them to
   * chat/_next so Workers Assets can serve the prefixed URLs (middleware
   * rewrite alone does not re-fetch ASSETS).
   */
  assetPrefix: "/chat",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
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
