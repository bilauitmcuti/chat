#!/usr/bin/env node
/**
 * After OpenNext build, mirror `_next` under `chat/_next` so Workers Assets
 * can serve `assetPrefix: "/chat"` URLs. Middleware rewrite alone is not enough:
 * Assets match the request path before the Worker runs, and a Next rewrite does
 * not re-fetch from the ASSETS binding.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, ".open-next", "assets", "_next");
const dest = path.join(root, ".open-next", "assets", "chat", "_next");

if (!fs.existsSync(src)) {
  console.error(
    `mirror-chat-assets: missing ${src} — run opennextjs-cloudflare build first`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`mirror-chat-assets: ${src} → ${dest}`);
