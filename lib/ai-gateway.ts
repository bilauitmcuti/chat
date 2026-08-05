/** Default gateway name — create in Cloudflare dashboard (AI → AI Gateway). */
export const DEFAULT_AI_GATEWAY_ID = "buc-chat";

export interface AiGatewayRunOptions {
  skipCache?: boolean;
  cacheTtl?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

type AiGatewayMetadata = Record<string, string | number | bigint | boolean | null>;

function sanitizeGatewayMetadata(
  metadata?: Record<string, string | number | boolean | null | undefined>
): AiGatewayMetadata | undefined {
  if (!metadata) return undefined;
  const out: AiGatewayMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export interface AiGatewayBindingOptions {
  gateway: {
    id: string;
    skipCache: boolean;
    cacheTtl?: number;
    collectLog: boolean;
    metadata?: AiGatewayMetadata;
  };
}

async function readConfigVar(name: "AI_GATEWAY_ID" | "SKIP_AI_GATEWAY"): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const raw = (env as CloudflareEnv | undefined)?.[name];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  } catch {
    // No Cloudflare context (unit tests, next dev without platform, etc.)
  }
  const fromProcess = process.env[name]?.trim();
  return fromProcess || undefined;
}

/** Sync resolver for tests and callers without async context. Uses process.env only. */
export function resolveAiGatewayIdFromProcessEnv(): string {
  const id = process.env.AI_GATEWAY_ID?.trim();
  if (id && id.toLowerCase() !== "off") return id;
  return DEFAULT_AI_GATEWAY_ID;
}

export async function isAiGatewayEnabled(): Promise<boolean> {
  const skip = await readConfigVar("SKIP_AI_GATEWAY");
  if (skip === "1" || skip === "true") return false;
  const id = await readConfigVar("AI_GATEWAY_ID");
  if (id?.toLowerCase() === "off") return false;
  return true;
}

export async function resolveAiGatewayId(): Promise<string> {
  const id = await readConfigVar("AI_GATEWAY_ID");
  if (id && id.toLowerCase() !== "off") return id;
  return DEFAULT_AI_GATEWAY_ID;
}

/** Third argument for `env.AI.run()` when AI Gateway is enabled. */
export async function buildAiGatewayRunOptions(
  opts?: AiGatewayRunOptions
): Promise<AiGatewayBindingOptions | undefined> {
  if (!(await isAiGatewayEnabled())) return undefined;

  const gateway: AiGatewayBindingOptions["gateway"] = {
    id: await resolveAiGatewayId(),
    skipCache: opts?.skipCache ?? false,
    collectLog: true,
  };

  const cacheTtl = opts?.cacheTtl;
  if (cacheTtl !== undefined && !opts?.skipCache) {
    gateway.cacheTtl = cacheTtl;
  }

  if (opts?.metadata) {
    const metadata = sanitizeGatewayMetadata(opts.metadata);
    if (metadata) gateway.metadata = metadata;
  }

  return { gateway };
}
