import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
} from "@/lib/chat/models";

/** Cloudflare AI Gateway Dynamic Route names on gateway `buc-chat`. */
export const DYNAMIC_ROUTE_GEMMA_4 = "gemma-4" as const;
export const DYNAMIC_ROUTE_LLAMA_SCOUT = "llama-scout" as const;
export const DYNAMIC_ROUTE_MISTRAL_SMALL = "mistral-small" as const;
export const DYNAMIC_ROUTE_NEMOTRON = "nemotron" as const;

export const CHAT_MODEL_NEMOTRON = "@cf/nvidia/nemotron-3-120b-a12b" as const;

/**
 * Workers AI model id → Dynamic Route name.
 * `gemma-4` is deployed with Mistral Small as gateway fallback.
 */
const DYNAMIC_ROUTE_BY_MODEL: Readonly<Record<string, string>> = {
  [CHAT_MODEL_GEMMA_4]: DYNAMIC_ROUTE_GEMMA_4,
  [CHAT_MODEL_LLAMA_4_SCOUT]: DYNAMIC_ROUTE_LLAMA_SCOUT,
  [CHAT_MODEL_MISTRAL_SMALL]: DYNAMIC_ROUTE_MISTRAL_SMALL,
  [CHAT_MODEL_NEMOTRON]: DYNAMIC_ROUTE_NEMOTRON,
};

/** Route names deployed on Cloudflare AI Gateway `buc-chat`. */
export const ALL_DYNAMIC_ROUTE_NAMES = [
  DYNAMIC_ROUTE_GEMMA_4,
  DYNAMIC_ROUTE_LLAMA_SCOUT,
  DYNAMIC_ROUTE_MISTRAL_SMALL,
  DYNAMIC_ROUTE_NEMOTRON,
] as const;

/**
 * Compat `model` slug for AI Gateway Dynamic Routing, or `null` when the
 * caller should use `AI.run(workersModelId)` only.
 */
export function getDynamicRouteModelId(modelId: string): string | null {
  const routeName =
    DYNAMIC_ROUTE_BY_MODEL[modelId] ??
    (modelId.includes("gemma-4") ? DYNAMIC_ROUTE_GEMMA_4 : undefined);
  if (!routeName) return null;
  return `dynamic/${routeName}`;
}

/**
 * Opt-in for AI Gateway Dynamic Routes via compat (all picker models including Gemma).
 * Default off — compat currently returns 400 Bad input for some Workers AI models;
 * chat uses `AI.run` + app Gemma fallback instead.
 */
export function isDynamicRoutingEnabled(): boolean {
  const raw = process.env.CHAT_USE_DYNAMIC_ROUTES?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/**
 * Whether this model should call `dynamic/<route>` before `AI.run`.
 * All mapped models (including Gemma) require `CHAT_USE_DYNAMIC_ROUTES=1`.
 */
export function usesDynamicRoute(modelId: string): boolean {
  if (!getDynamicRouteModelId(modelId)) return false;
  return isDynamicRoutingEnabled();
}
