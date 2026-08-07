/**
 * ExFAT (and similar) volumes create AppleDouble `._*` sidecars. Miniflare/workerd
 * then fail local SQLite/persistence with:
 *   Failed to open database → invalid digit found in string
 *
 * 1) Point `.wrangler` at the Mac home volume (symlink).
 * 2) Strip AppleDouble files under Wrangler/Miniflare package trees before start.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const projectRoot = process.cwd();
const wranglerLink = path.join(projectRoot, ".wrangler");
const homePersist = path.join(os.homedir(), ".cache", "buc-chat-wrangler");

fs.mkdirSync(homePersist, { recursive: true });

function resolveExistingLinkTarget() {
  try {
    const stat = fs.lstatSync(wranglerLink);
    if (!stat.isSymbolicLink()) return null;
    return path.resolve(path.dirname(wranglerLink), fs.readlinkSync(wranglerLink));
  } catch {
    return null;
  }
}

const currentTarget = resolveExistingLinkTarget();
if (currentTarget !== path.resolve(homePersist)) {
  fs.rmSync(wranglerLink, { recursive: true, force: true });
  for (const sidecar of ["._wrangler", "._.wrangler"]) {
    fs.rmSync(path.join(projectRoot, sidecar), { force: true });
  }
  try {
    fs.symlinkSync(homePersist, wranglerLink, "dir");
  } catch (error) {
    console.warn(
      `[ensure-wrangler-home-persist] Could not symlink .wrangler → ${homePersist}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Critical packages whose `._*` sidecars break remote AI / Miniflare on ExFAT. */
const appleDoubleRoots = [
  path.join(projectRoot, "node_modules", "wrangler"),
  path.join(projectRoot, "node_modules", "miniflare"),
  path.join(projectRoot, "node_modules", "workerd"),
  path.join(projectRoot, "node_modules", ".pnpm"),
  path.join(projectRoot, ".wrangler"),
  homePersist,
];

for (const root of appleDoubleRoots) {
  if (!fs.existsSync(root)) continue;
  // Prefer find(1) — much faster than recursive JS walks on large trees.
  spawnSync(
    "find",
    [root, "-name", "._*", "-delete"],
    { stdio: "ignore" }
  );
}

/** Prefer workerd binary on APFS when the project lives on ExFAT. */
function ensureWorkerdOnHomeVolume() {
  const candidates = [
    path.join(
      projectRoot,
      "node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd"
    ),
    path.join(
      projectRoot,
      "node_modules/.pnpm/@cloudflare+workerd-darwin-arm64@1.20260526.1/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd"
    ),
  ];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) return;

  const binDir = path.join(os.homedir(), ".cache", "buc-chat-bins");
  const target = path.join(binDir, "workerd");
  fs.mkdirSync(binDir, { recursive: true });

  try {
    const srcStat = fs.statSync(source);
    const dstStat = fs.existsSync(target) ? fs.statSync(target) : null;
    if (!dstStat || dstStat.size !== srcStat.size || dstStat.mtimeMs < srcStat.mtimeMs) {
      fs.copyFileSync(source, target);
      fs.chmodSync(target, 0o755);
    }
    // Parent shell must export this — write a small env file for the dev wrapper.
    fs.writeFileSync(
      path.join(os.homedir(), ".cache", "buc-chat-wrangler-env"),
      `MINIFLARE_WORKERD_PATH=${target}\n`,
      "utf8"
    );
  } catch {
    // non-fatal
  }
}

ensureWorkerdOnHomeVolume();

/** Stale Turbopack cache after a failed Wrangler init can re-trigger workerd crashes. */
function clearStaleNextCacheOnExternalVolume() {
  if (!projectRoot.startsWith("/Volumes/")) return;
  const marker = path.join(homePersist, ".exfat-next-cache-cleared");
  if (fs.existsSync(marker)) return;
  const nextDir = path.join(projectRoot, ".next");
  if (fs.existsSync(nextDir)) {
    console.warn(
      "[ensure-wrangler-home-persist] Clearing .next once (ExFAT + Wrangler crash recovery)…"
    );
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
  fs.mkdirSync(homePersist, { recursive: true });
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`, "utf8");
}

clearStaleNextCacheOnExternalVolume();
