import { CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";

export const DEFAULT_CHAT_MODEL = "@cf/google/gemma-4-26b-a4b-it" as const;
export const CHAT_MODEL_GEMMA_4 = DEFAULT_CHAT_MODEL;
/** @deprecated Removed from picker — no function calling or reasoning. Kept for tests/compat. */
export const CHAT_MODEL_LLAMA_32 = "@cf/meta/llama-3.2-3b-instruct" as const;
export const CHAT_MODEL_LLAMA_4_SCOUT =
  "@cf/meta/llama-4-scout-17b-16e-instruct" as const;
export const CHAT_MODEL_MISTRAL_SMALL =
  "@cf/mistralai/mistral-small-3.1-24b-instruct" as const;
export const CHAT_MODEL_GLM_47_FLASH = "@cf/zai-org/glm-4.7-flash" as const;

/** Production chat host — nonProductionOnly models are hidden here. */
export const PRODUCTION_CHAT_HOST = "chat.bilauitmcuti.com";

export interface ChatModelOption {
  id: string;
  name: string;
  /** Short menu subtitle under the model name. */
  description: string;
  /** models.dev / ModelSelectorLogo provider slug */
  provider: string;
  functionCalling: boolean;
  reasoningUi: boolean;
  /** Per-model output ceiling (capped by CHAT_LIMITS.maxOutputTokens). */
  maxOutputTokens?: number;
  /** Only in picker / allowlist on localhost or Workers preview hosts. */
  nonProductionOnly?: boolean;
}

export const CHAT_MODELS: readonly ChatModelOption[] = [
  {
    id: CHAT_MODEL_GEMMA_4,
    name: "Gemma 4",
    description: "Best for most questions",
    provider: "google",
    functionCalling: true,
    reasoningUi: true,
  },
  {
    id: CHAT_MODEL_LLAMA_4_SCOUT,
    name: "Llama 4 Scout",
    description: "Quick everyday answers",
    provider: "llama",
    functionCalling: true,
    reasoningUi: false,
  },
  {
    id: CHAT_MODEL_MISTRAL_SMALL,
    name: "Mistral Small 3.1",
    description: "Fast, reliable responses",
    provider: "mistral",
    functionCalling: true,
    reasoningUi: false,
  },
  {
    id: "@cf/nvidia/nemotron-3-120b-a12b",
    name: "Nemotron 3 Super",
    description: "Best for complex reasoning",
    provider: "nvidia",
    functionCalling: true,
    reasoningUi: true,
  },
  {
    id: CHAT_MODEL_GLM_47_FLASH,
    name: "GLM 4.7 Flash",
    description: "Detailed explanations",
    provider: "zai",
    functionCalling: true,
    reasoningUi: true,
  },
] as const;

const ALLOWED_MODEL_IDS = new Set(CHAT_MODELS.map((m) => m.id));

export function normalizeChatHostname(hostname?: string | null): string {
  return (hostname ?? "").replace(/^www\./, "").split(":")[0].toLowerCase();
}

/** Localhost or Workers preview (`*.workers.dev`) — not production chat domain. */
export function isNonProductionChatHost(hostname?: string | null): boolean {
  const host = normalizeChatHostname(hostname);
  if (!host) return process.env.NODE_ENV !== "production";
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (host.endsWith(".workers.dev")) return true;
  return host !== PRODUCTION_CHAT_HOST;
}

export function getVisibleChatModels(
  hostname?: string | null
): readonly ChatModelOption[] {
  const allowNonProd = isNonProductionChatHost(hostname);
  return CHAT_MODELS.filter((m) => allowNonProd || !m.nonProductionOnly);
}
export interface ChatLimits {
  maxOutputTokens: number;
  maxSystemChars: number;
  maxHistoryMessages: number;
  maxMessageChars: number;
  maxUserPromptChars: number;
}

export const CHAT_LIMITS: ChatLimits = {
  maxOutputTokens: 8192,
  maxSystemChars: 16_000,
  maxHistoryMessages: 10,
  maxMessageChars: CHAT_MAX_MESSAGE_LENGTH,
  maxUserPromptChars: CHAT_MAX_MESSAGE_LENGTH,
};

export const MAX_OUTPUT_TOKENS = CHAT_LIMITS.maxOutputTokens;

export function getChatLimits(): ChatLimits {
  return CHAT_LIMITS;
}

export function getMaxOutputTokens(): number {
  return CHAT_LIMITS.maxOutputTokens;
}

/** Effective output ceiling for a model (global cap ∩ optional per-model cap). */
export function getModelMaxOutputTokens(modelId: string): number {
  const model = getChatModel(modelId);
  return Math.min(
    CHAT_LIMITS.maxOutputTokens,
    model?.maxOutputTokens ?? CHAT_LIMITS.maxOutputTokens
  );
}

export function isAllowedChatModel(
  modelId: string,
  hostname?: string | null
): boolean {
  if (!ALLOWED_MODEL_IDS.has(modelId)) return false;
  const model = getChatModel(modelId);
  if (model?.nonProductionOnly && !isNonProductionChatHost(hostname)) return false;
  return true;
}

export function getChatModel(modelId: string): ChatModelOption | undefined {
  return CHAT_MODELS.find((m) => m.id === modelId);
}

/** Server default — Gemma 4, or `WORKERS_AI_MODEL` when set and allowlisted. */
export function getDefaultChatModel(hostname?: string | null): string {
  const override = process.env.WORKERS_AI_MODEL?.trim();
  if (override && isAllowedChatModel(override, hostname)) return override;
  return DEFAULT_CHAT_MODEL;
}

/** Resolve model for a chat turn: allowlisted client choice, else server default. */
export function resolveChatModel(
  modelId?: string | null,
  hostname?: string | null
): string {
  const trimmed = modelId?.trim();
  if (trimmed && isAllowedChatModel(trimmed, hostname)) return trimmed;
  return getDefaultChatModel(hostname);
}

function isGooglePartnerModelId(modelId: string): boolean {
  return modelId.startsWith("google/");
}

export function modelSupportsFunctionCalling(modelId: string): boolean {
  const model = getChatModel(modelId);
  if (model) return model.functionCalling;
  if (modelId.includes("gemma-4") || modelId.includes("gemma-3")) return true;
  if (isGooglePartnerModelId(modelId)) return true;
  if (modelId.includes("llama-4")) return true;
  if (modelId.includes("mistral-small")) return true;
  if (modelId.includes("glm-4.7") || modelId.includes("glm-5")) return true;
  if (modelId.includes("nemotron-3")) return true;
  return false;
}

export function supportsReasoningUi(modelId: string): boolean {
  const model = getChatModel(modelId);
  if (model) return model.reasoningUi;
  if (modelId.includes("gemma-4") || modelId.includes("gemma-3")) return true;
  return isGooglePartnerModelId(modelId);
}

export const CHAT_MODEL_STORAGE_KEY = "chat-selected-model";

export function readStoredChatModel(hostname?: string | null): string | null {
  if (typeof window === "undefined") return null;
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  try {
    const raw = localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
    return raw && isAllowedChatModel(raw, host) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredChatModel(modelId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_MODEL_STORAGE_KEY, modelId);
  } catch {
    /* ignore quota / private mode */
  }
}
