import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_DYNAMIC_ROUTE_NAMES,
  CHAT_MODEL_NEMOTRON,
  getDynamicRouteModelId,
  isDynamicRoutingEnabled,
  usesDynamicRoute,
} from "@/lib/chat/dynamic-routes";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  DEFAULT_CHAT_MODEL,
} from "@/lib/chat/models";

describe("getDynamicRouteModelId", () => {
  it("returns null for Gemma 4 (direct AI.run path)", () => {
    expect(getDynamicRouteModelId(CHAT_MODEL_GEMMA_4)).toBeNull();
    expect(getDynamicRouteModelId(DEFAULT_CHAT_MODEL)).toBeNull();
  });

  it("maps non-Gemma picker models to dynamic/<route>", () => {
    expect(getDynamicRouteModelId(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(
      "dynamic/llama-scout"
    );
    expect(getDynamicRouteModelId(CHAT_MODEL_MISTRAL_SMALL)).toBe(
      "dynamic/mistral-small"
    );
    expect(getDynamicRouteModelId(CHAT_MODEL_NEMOTRON)).toBe("dynamic/nemotron");
  });

  it("returns null for unknown models", () => {
    expect(getDynamicRouteModelId("@cf/unknown/model")).toBeNull();
  });

  it("lists Dynamic Route names on buc-chat including gemma-4", () => {
    expect(ALL_DYNAMIC_ROUTE_NAMES).toEqual([
      "gemma-4",
      "llama-scout",
      "mistral-small",
      "nemotron",
    ]);
  });
});

describe("isDynamicRoutingEnabled / usesDynamicRoute", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to off", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "");
    expect(isDynamicRoutingEnabled()).toBe(false);
    expect(usesDynamicRoute(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(false);
    expect(usesDynamicRoute(CHAT_MODEL_GEMMA_4)).toBe(false);
  });

  it("enables when CHAT_USE_DYNAMIC_ROUTES=1", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "1");
    expect(isDynamicRoutingEnabled()).toBe(true);
    expect(usesDynamicRoute(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(usesDynamicRoute(CHAT_MODEL_GEMMA_4)).toBe(false);
  });

  it("enables when CHAT_USE_DYNAMIC_ROUTES=true", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "true");
    expect(isDynamicRoutingEnabled()).toBe(true);
  });
});
