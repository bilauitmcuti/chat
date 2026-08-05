/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  AI: Ai;
  /** From wrangler.jsonc vars — AI Gateway name for chat inference. */
  AI_GATEWAY_ID?: string;
  /** Set to 1 or true in wrangler vars to bypass AI Gateway locally. */
  SKIP_AI_GATEWAY?: string;
}
