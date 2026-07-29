import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODEL_WORKERS_AI_DEV,
  MODEL_WORKERS_AI_PRODUCTION,
  hostSupportsReasoningUi,
  modelChainSupportsReasoningUi,
  resolveProductionChatModelChain,
  resolveWorkersAiModelTier,
  shouldStreamTokensToClient,
  supportsReasoningUi,
} from "@/lib/ai";

describe("resolveProductionChatModelChain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Llama on dev host", () => {
    expect(resolveProductionChatModelChain("localhost:3000")).toEqual([
      MODEL_WORKERS_AI_DEV,
    ]);
  });

  it("uses Gemma on production chat host", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveProductionChatModelChain("chat.bilauitmcuti.com")).toEqual([
      MODEL_WORKERS_AI_PRODUCTION,
    ]);
  });

  it("uses Gemma on Workers preview host", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveProductionChatModelChain("bilauitmcuti-chat.my.workers.dev")).toEqual([
      MODEL_WORKERS_AI_PRODUCTION,
    ]);
    expect(resolveWorkersAiModelTier("bilauitmcuti-chat.my.workers.dev")).toBe("production");
  });

  it("marks production tier for chat.bilauitmcuti.com", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveWorkersAiModelTier("chat.bilauitmcuti.com")).toBe("production");
  });

  it("uses dev tier on localhost even when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveWorkersAiModelTier("localhost:3000")).toBe("dev");
    expect(resolveProductionChatModelChain("localhost:3000")).toEqual([
      MODEL_WORKERS_AI_DEV,
    ]);
  });

  it("uses Gemma on localhost when WORKERS_AI_USE_PRODUCTION_MODEL=1", () => {
    vi.stubEnv("WORKERS_AI_USE_PRODUCTION_MODEL", "1");
    expect(resolveWorkersAiModelTier("localhost:3000")).toBe("production");
    expect(resolveProductionChatModelChain("localhost:3000")).toEqual([
      MODEL_WORKERS_AI_PRODUCTION,
    ]);
  });

  it("streams tokens to the chat client (progressive paint, done replaces full reply)", () => {
    expect(shouldStreamTokensToClient("chat.bilauitmcuti.com")).toBe(true);
    expect(shouldStreamTokensToClient("localhost:3000")).toBe(true);
  });
});

describe("supportsReasoningUi", () => {
  it("enables reasoning UI for Gemma and Google partner models", () => {
    expect(supportsReasoningUi(MODEL_WORKERS_AI_PRODUCTION)).toBe(true);
    expect(supportsReasoningUi("@cf/google/gemma-3-12b-it")).toBe(true);
    expect(supportsReasoningUi("google/gemini-2.0-flash")).toBe(true);
  });

  it("disables reasoning UI for dev Llama", () => {
    expect(supportsReasoningUi(MODEL_WORKERS_AI_DEV)).toBe(false);
  });

  it("resolves host support from model chain", () => {
    expect(modelChainSupportsReasoningUi([MODEL_WORKERS_AI_PRODUCTION])).toBe(true);
    expect(modelChainSupportsReasoningUi([MODEL_WORKERS_AI_DEV])).toBe(false);
    expect(hostSupportsReasoningUi("chat.bilauitmcuti.com")).toBe(true);
    expect(hostSupportsReasoningUi("localhost:3000")).toBe(false);
  });
});
