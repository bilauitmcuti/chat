import { CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";

/** Dev / preview / localhost chat model (fast, lower cost). */
export const MODEL_WORKERS_AI_DEV = "@cf/meta/llama-3.2-3b-instruct" as const;

/** Production primary chat model. */
export const MODEL_WORKERS_AI_PRODUCTION =
  "@cf/google/gemma-4-26b-a4b-it" as const;

const PRODUCTION_SITE_HOST = "chat.bilauitmcuti.com";

export type WorkersAiModelTier = "dev" | "production";

export interface WorkersAiTierLimits {
  maxOutputTokens: number;
  maxSystemChars: number;
  maxHistoryMessages: number;
  maxMessageChars: number;
  maxUserPromptChars: number;
}

const TIER_LIMITS: Record<WorkersAiModelTier, WorkersAiTierLimits> = {
  dev: {
    maxOutputTokens: 8192,
    maxSystemChars: 12_000,
    maxHistoryMessages: 8,
    maxMessageChars: CHAT_MAX_MESSAGE_LENGTH,
    maxUserPromptChars: CHAT_MAX_MESSAGE_LENGTH,
  },
  production: {
    maxOutputTokens: 8192,
    maxSystemChars: 16_000,
    maxHistoryMessages: 10,
    maxMessageChars: CHAT_MAX_MESSAGE_LENGTH,
    maxUserPromptChars: CHAT_MAX_MESSAGE_LENGTH,
  },
};

/** Default max completion tokens (dev tier). */
export const MAX_OUTPUT_TOKENS = TIER_LIMITS.dev.maxOutputTokens;

export function getWorkersAiTierLimits(tier: WorkersAiModelTier): WorkersAiTierLimits {
  return TIER_LIMITS[tier];
}

export function getMaxOutputTokensForHost(requestHost?: string | null): number {
  const tier = resolveWorkersAiModelTier(requestHost);
  return TIER_LIMITS[tier].maxOutputTokens;
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").split(":")[0].toLowerCase();
}

function isProductionSiteHost(host: string | null | undefined): boolean {
  if (!host?.trim()) return false;
  return normalizeHost(host) === PRODUCTION_SITE_HOST;
}

function isWorkersPreviewHost(host: string): boolean {
  return normalizeHost(host).endsWith(".workers.dev");
}

function isStrictLocalDevHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1";
}

function isWorkersAiUseProductionModelLocally(): boolean {
  const v = process.env.WORKERS_AI_USE_PRODUCTION_MODEL;
  return v === "1" || v === "true";
}

function isGemmaThinkingCapableModel(modelId: string): boolean {
  return modelId.includes("gemma-4") || modelId.includes("gemma-3");
}

function isGooglePartnerModelId(modelId: string): boolean {
  return modelId.startsWith("google/");
}

/**
 * Production (chat.bilauitmcuti.com) + Workers preview (*.workers.dev): Gemma 4.
 * Localhost: Llama 3.2 3B (override with WORKERS_AI_USE_PRODUCTION_MODEL=1).
 * Optional: WORKERS_AI_MODEL, WORKERS_AI_USE_DEV_MODEL=1.
 */
export function resolveWorkersAiModelTier(requestHost?: string | null): WorkersAiModelTier {
  const override = process.env.WORKERS_AI_MODEL?.trim();
  if (override) {
    return override === MODEL_WORKERS_AI_PRODUCTION ? "production" : "dev";
  }

  if (process.env.WORKERS_AI_USE_DEV_MODEL === "1" || process.env.WORKERS_AI_USE_DEV_MODEL === "true") {
    return "dev";
  }

  if (requestHost) {
    if (isProductionSiteHost(requestHost)) return "production";
    if (isWorkersPreviewHost(requestHost)) return "production";
    if (isStrictLocalDevHost(requestHost)) {
      if (isWorkersAiUseProductionModelLocally()) return "production";
      return "dev";
    }
  }

  if (process.env.NODE_ENV !== "production") return "dev";

  return "dev";
}

/** Ordered model ids for chat completion (production + preview: Gemma; localhost: Llama). */
export function resolveProductionChatModelChain(requestHost?: string | null): string[] {
  const override = process.env.WORKERS_AI_MODEL?.trim();
  if (override) return [override];

  const tier = resolveWorkersAiModelTier(requestHost);
  if (tier === "dev") return [MODEL_WORKERS_AI_DEV];

  return [MODEL_WORKERS_AI_PRODUCTION];
}

export function resolveWorkersAiModelId(requestHost?: string | null): string {
  return resolveProductionChatModelChain(requestHost)[0]!;
}

/** Tier limits follow the selected model, not only the host. */
export function resolveWorkersAiTierForModelId(
  modelId: string,
  requestHost?: string | null
): WorkersAiModelTier {
  if (
    modelId.includes("gemma-4") ||
    modelId.includes("gemma-3") ||
    modelId.startsWith("google/")
  ) {
    return "production";
  }
  if (modelId === MODEL_WORKERS_AI_DEV) return "dev";
  return resolveWorkersAiModelTier(requestHost);
}

/** Models that may show the server-authored reasoning UI (Gemma / Google partner). */
export function supportsReasoningUi(modelId: string): boolean {
  return isGemmaThinkingCapableModel(modelId) || isGooglePartnerModelId(modelId);
}

export function modelChainSupportsReasoningUi(chain: string[]): boolean {
  return chain.some(supportsReasoningUi);
}

export function hostSupportsReasoningUi(requestHost?: string | null): boolean {
  return modelChainSupportsReasoningUi(resolveProductionChatModelChain(requestHost));
}
