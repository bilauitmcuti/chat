import { describe, expect, it } from "vitest";
import {
  ALL_DYNAMIC_ROUTE_NAMES,
  CHAT_MODEL_NEMOTRON,
  getDynamicRouteModelId,
  usesDynamicRoute,
} from "@/lib/chat/dynamic-routes";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_GLM_47_FLASH,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  DEFAULT_CHAT_MODEL,
} from "@/lib/chat/models";

describe("getDynamicRouteModelId", () => {
  it("returns null for Gemma 4 (direct AI.run path)", () => {
    expect(getDynamicRouteModelId(CHAT_MODEL_GEMMA_4)).toBeNull();
    expect(getDynamicRouteModelId(DEFAULT_CHAT_MODEL)).toBeNull();
    expect(usesDynamicRoute(CHAT_MODEL_GEMMA_4)).toBe(false);
  });

  it("maps non-Gemma picker models to dynamic/<route>", () => {
    expect(getDynamicRouteModelId(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(
      "dynamic/llama-scout"
    );
    expect(getDynamicRouteModelId(CHAT_MODEL_MISTRAL_SMALL)).toBe(
      "dynamic/mistral-small"
    );
    expect(getDynamicRouteModelId(CHAT_MODEL_NEMOTRON)).toBe("dynamic/nemotron");
    expect(getDynamicRouteModelId(CHAT_MODEL_GLM_47_FLASH)).toBe(
      "dynamic/glm-flash"
    );
    expect(usesDynamicRoute(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
  });

  it("returns null for unknown models", () => {
    expect(getDynamicRouteModelId("@cf/unknown/model")).toBeNull();
  });

  it("lists all Dynamic Route names on buc-chat including gemma-4", () => {
    expect(ALL_DYNAMIC_ROUTE_NAMES).toEqual([
      "gemma-4",
      "llama-scout",
      "mistral-small",
      "nemotron",
      "glm-flash",
    ]);
  });
});
