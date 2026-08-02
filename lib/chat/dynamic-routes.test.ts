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
  it("maps Gemma 4 to dynamic/gemma-4", () => {
    expect(getDynamicRouteModelId(CHAT_MODEL_GEMMA_4)).toBe("dynamic/gemma-4");
    expect(getDynamicRouteModelId(DEFAULT_CHAT_MODEL)).toBe("dynamic/gemma-4");
    expect(getDynamicRouteModelId("@cf/google/gemma-4-other")).toBe(
      "dynamic/gemma-4"
    );
  });

  it("maps picker models to dynamic/<route>", () => {
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

  it("defaults non-Gemma Dynamic Routes off; Gemma always on", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "");
    expect(isDynamicRoutingEnabled()).toBe(false);
    expect(usesDynamicRoute(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(false);
    expect(usesDynamicRoute(CHAT_MODEL_GEMMA_4)).toBe(true);
  });

  it("enables non-Gemma when CHAT_USE_DYNAMIC_ROUTES=1", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "1");
    expect(isDynamicRoutingEnabled()).toBe(true);
    expect(usesDynamicRoute(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(usesDynamicRoute(CHAT_MODEL_GEMMA_4)).toBe(true);
  });

  it("enables when CHAT_USE_DYNAMIC_ROUTES=true", () => {
    vi.stubEnv("CHAT_USE_DYNAMIC_ROUTES", "true");
    expect(isDynamicRoutingEnabled()).toBe(true);
  });
});
