import fs from "fs";
import os from "os";
import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import {
  NEXT_CONFIG_EXTRA_HEADER_ENTRIES,
  SECURITY_HEADER_ENTRIES,
} from "./lib/security-headers.mjs";

/**
 * Miniflare/Wrangler local SQLite persistence fails on ExFAT (AppleDouble `._*` files
 * → "invalid digit found in string"). Keep state on the Mac home volume instead.
 */
function resolveWranglerPersistPath() {
  return path.join(os.homedir(), ".cache", "buc-chat-wrangler");
}

function isWranglerPersistError(reason) {
  const message =
    reason instanceof Error
      ? `${reason.message} ${reason.cause instanceof Error ? reason.cause.message : reason.cause ?? ""}`
      : String(reason);
  return /Failed to open database|persistence directory failed|invalid digit found in string/i.test(
    message
  );
}

function warnCloudflareDevUnavailable(cause) {
  console.warn(
    [
      "⚠ Cloudflare OpenNext dev bindings unavailable — Next.js will keep running.",
      "  Chat may return 503 until Workers AI bindings work.",
      `  Cause: ${cause}`,
      "  Tip: ExFAT volumes break Wrangler/Miniflare persistence. Prefer an APFS path (e.g. ~/labs/buc-chat).",
      "  Offline UI only: SKIP_CLOUDFLARE_DEV=1 pnpm dev",
    ].join("\n"),
  );
}

/** Prevent late Wrangler/workerd failures from killing `next dev` after Ready. */
function installCloudflareDevErrorGuard() {
  const g = globalThis;
  if (g.__bucChatCfDevGuard) return;
  g.__bucChatCfDevGuard = true;

  process.on("unhandledRejection", (reason) => {
    if (!isWranglerPersistError(reason)) return;
    warnCloudflareDevUnavailable(
      reason instanceof Error ? reason.message : String(reason),
    );
  });

  process.on("uncaughtException", (error) => {
    if (!isWranglerPersistError(error)) throw error;
    warnCloudflareDevUnavailable(error.message);
  });
}

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
  const onExternalVolume = process.cwd().startsWith("/Volumes/");
  const forceCloudflare =
    process.env.FORCE_CLOUDFLARE_DEV === "1" ||
    process.env.FORCE_CLOUDFLARE_REMOTE === "1";

  // ExFAT (common on /Volumes/…) breaks Miniflare/workerd SQLite with:
  // "Failed to open database … invalid digit found in string" and kills `next dev`.
  // Skip OpenNext Cloudflare init unless explicitly forced.
  if (onExternalVolume && !forceCloudflare) {
    console.warn(
      [
        "⚠ External volume detected — skipping Cloudflare OpenNext bindings.",
        "  `pnpm dev` will run; chat AI may return 503.",
        "  For full local chat: move the repo to APFS (e.g. ~/labs/buc-chat), or set",
        "  FORCE_CLOUDFLARE_DEV=1 (may still crash on ExFAT).",
      ].join("\n"),
    );
  } else {
    installCloudflareDevErrorGuard();
    const persistEnv = process.env.WRANGLER_PERSIST_PATH?.trim();
    const persist =
      persistEnv === "0" || persistEnv === "false"
        ? false
        : { path: persistEnv || resolveWranglerPersistPath() };

    void initOpenNextCloudflareForDev({
      persist,
      remoteBindings: true,
    }).catch((error) => {
      warnCloudflareDevUnavailable(
        error instanceof Error ? error.message : String(error),
      );
    });
  }
}

export default nextConfig;
