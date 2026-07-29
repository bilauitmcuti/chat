#!/usr/bin/env node
/**
 * HTTP smoke checks against a running dev/preview server.
 * Usage: SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 */

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function check(name, path, assertFn) {
  const url = `${baseUrl}${path}`;
  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: fetch ${url} — ${msg}`);
    console.error("Is the dev/preview server running? Try: pnpm dev");
    process.exit(1);
  }
  try {
    await assertFn(res);
    console.log(`OK   ${name} (${res.status})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Smoke base: ${baseUrl}\n`);

  await check("GET /api/health", "/api/health", async (res) => {
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`expected 200 or 503, got ${res.status}`);
    }
    const body = await res.json();
    if (typeof body.status !== "string") {
      throw new Error("response missing status field");
    }
  });

  await check("GET /api/version", "/api/version", async (res) => {
    if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
    await res.json();
  });

  await check("GET /api/v1/meta?group=A", "/api/v1/meta?group=A", async (res) => {
    if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
    await res.json();
  });

  console.log("\nAll smoke checks passed.");
}

main();
