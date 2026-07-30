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
 * Workers AI model id → Dynamic Route name for non-Gemma models.
 * Gemma stays on `AI.run` (no dynamic route in the inference path).
 */
const DYNAMIC_ROUTE_BY_MODEL: Readonly<Record<string, string>> = {
  [CHAT_MODEL_LLAMA_4_SCOUT]: DYNAMIC_ROUTE_LLAMA_SCOUT,
  [CHAT_MODEL_MISTRAL_SMALL]: DYNAMIC_ROUTE_MISTRAL_SMALL,
  [CHAT_MODEL_NEMOTRON]: DYNAMIC_ROUTE_NEMOTRON,
};

/** Route names deployed on Cloudflare AI Gateway `buc-chat` (including Gemma). */
export const ALL_DYNAMIC_ROUTE_NAMES = [
  DYNAMIC_ROUTE_GEMMA_4,
  DYNAMIC_ROUTE_LLAMA_SCOUT,
  DYNAMIC_ROUTE_MISTRAL_SMALL,
  DYNAMIC_ROUTE_NEMOTRON,
] as const;

/**
 * Compat `model` slug for AI Gateway Dynamic Routing, or `null` when the
 * caller should use `AI.run(workersModelId)` (Gemma / unknown / no fallback).
 */
export function getDynamicRouteModelId(modelId: string): string | null {
  if (modelId === CHAT_MODEL_GEMMA_4 || modelId.includes("gemma-4")) return null;
  const routeName = DYNAMIC_ROUTE_BY_MODEL[modelId];
  if (!routeName) return null;
  return `dynamic/${routeName}`;
}

/**
 * Opt-in: call AI Gateway Dynamic Routes via compat.
 * Default off — compat currently returns 400 Bad input for Workers AI models;
 * chat uses `AI.run` + app Gemma fallback instead.
 */
export function isDynamicRoutingEnabled(): boolean {
  const raw = process.env.CHAT_USE_DYNAMIC_ROUTES?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function usesDynamicRoute(modelId: string): boolean {
  return isDynamicRoutingEnabled() && getDynamicRouteModelId(modelId) !== null;
}
