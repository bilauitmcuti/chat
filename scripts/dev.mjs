#!/usr/bin/env node
/**
 * Dev entry: ExFAT-safe Wrangler persist + optional APFS workerd, then `next dev`.
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");

process.env.COPYFILE_DISABLE = "1";

spawnSync(process.execPath, [path.join(root, "ensure-wrangler-home-persist.mjs")], {
  cwd: projectRoot,
  stdio: "inherit",
});

const envFile = path.join(os.homedir(), ".cache", "buc-chat-wrangler-env");
try {
  const text = fs.readFileSync(envFile, "utf8");
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  // optional
}

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
