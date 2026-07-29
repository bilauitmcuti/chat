import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// buildCommand must be `next build` — not `pnpm build`.
// package.json "build" is `opennextjs-cloudflare build`; without this override
// OpenNext would call `pnpm build` and recurse forever.
export default {
  ...defineCloudflareConfig(),
  buildCommand: "next build",
};
