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

/** Never create or mutate `.wrangler` in CI / Cloudflare Builds. */
function isCiOrBuildEnvironment() {
  return (
    process.env.CI === "true" ||
    process.env.CI === "1" ||
    Boolean(process.env.CF_PAGES) ||
    Boolean(process.env.CF_PAGES_URL) ||
    Boolean(process.env.WORKERS_CI) ||
    Boolean(process.env.CLOUDFLARE_BUILD)
  );
}

if (isCiOrBuildEnvironment()) {
  process.exit(0);
}

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

function platformWorkerdPackageName() {
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "@cloudflare/workerd-darwin-arm64"
      : "@cloudflare/workerd-darwin-64";
  }
  if (process.platform === "linux") {
    return process.arch === "arm64"
      ? "@cloudflare/workerd-linux-arm64"
      : "@cloudflare/workerd-linux-64";
  }
  if (process.platform === "win32") return "@cloudflare/workerd-windows-64";
  return null;
}

/** Resolve the installed workerd binary from pnpm (never pin an old version). */
function resolveProjectWorkerdBinary() {
  const pkgName = platformWorkerdPackageName();
  if (!pkgName) return null;

  const direct = path.join(
    projectRoot,
    "node_modules",
    pkgName,
    "bin",
    process.platform === "win32" ? "workerd.exe" : "workerd"
  );
  if (fs.existsSync(direct)) return direct;

  const pnpmDir = path.join(projectRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) return null;

  const prefix = `${pkgName.replace("/", "+")}@`;
  const matches = fs
    .readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith(prefix))
    .sort();
  const latest = matches.at(-1);
  if (!latest) return null;

  const fromPnpm = path.join(
    pnpmDir,
    latest,
    "node_modules",
    pkgName,
    "bin",
    process.platform === "win32" ? "workerd.exe" : "workerd"
  );
  return fs.existsSync(fromPnpm) ? fromPnpm : null;
}

function readWorkerdVersion(binaryPath) {
  const result = spawnSync(binaryPath, ["--version"], { encoding: "utf8" });
  const line = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const match = line.match(/workerd\s+(\S+)/i);
  return match?.[1] ?? null;
}

/** Prefer workerd binary on APFS when the project lives on ExFAT. */
function ensureWorkerdOnHomeVolume() {
  const source = resolveProjectWorkerdBinary();
  if (!source) return;

  const binDir = path.join(os.homedir(), ".cache", "buc-chat-bins");
  const target = path.join(
    binDir,
    process.platform === "win32" ? "workerd.exe" : "workerd"
  );
  const envFile = path.join(os.homedir(), ".cache", "buc-chat-wrangler-env");
  fs.mkdirSync(binDir, { recursive: true });

  try {
    const sourceVersion = readWorkerdVersion(source);
    const targetVersion = fs.existsSync(target) ? readWorkerdVersion(target) : null;
    const srcStat = fs.statSync(source);
    const dstStat = fs.existsSync(target) ? fs.statSync(target) : null;
    const shouldCopy =
      !dstStat ||
      dstStat.size !== srcStat.size ||
      sourceVersion !== targetVersion;

    if (shouldCopy) {
      fs.copyFileSync(source, target);
      fs.chmodSync(target, 0o755);
      if (sourceVersion && sourceVersion !== targetVersion) {
        console.log(
          `[ensure-wrangler-home-persist] Updated cached workerd ${targetVersion ?? "none"} → ${sourceVersion}`
        );
      }
    }

    // Parent shell must export this — write a small env file for the dev wrapper.
    fs.writeFileSync(envFile, `MINIFLARE_WORKERD_PATH=${target}\n`, "utf8");
  } catch (error) {
    console.warn(
      "[ensure-wrangler-home-persist] Could not cache workerd on home volume:",
      error instanceof Error ? error.message : error
    );
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
