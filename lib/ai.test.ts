import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_32,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  DEFAULT_CHAT_MODEL,
  getModelMaxOutputTokens,
  getVisibleChatModels,
  isAllowedChatModel,
  isNonProductionChatHost,
  PRODUCTION_CHAT_HOST,
  resolveChatModel,
  supportsReasoningUi,
  modelSupportsFunctionCalling,
} from "@/lib/chat/models";
import {
  shouldStreamTokensToClient,
  supportsFunctionCalling,
} from "@/lib/ai";

describe("resolveChatModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Gemma 4 on all hosts", () => {
    expect(resolveChatModel()).toBe(DEFAULT_CHAT_MODEL);
    expect(resolveChatModel(null)).toBe(DEFAULT_CHAT_MODEL);
    expect(resolveChatModel(undefined)).toBe(DEFAULT_CHAT_MODEL);
  });

  it("uses allowlisted client model when provided", () => {
    expect(resolveChatModel(CHAT_MODEL_LLAMA_32, "localhost")).toBe(CHAT_MODEL_LLAMA_32);
    expect(resolveChatModel(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(CHAT_MODEL_LLAMA_4_SCOUT);
    expect(resolveChatModel(CHAT_MODEL_MISTRAL_SMALL)).toBe(CHAT_MODEL_MISTRAL_SMALL);
    expect(resolveChatModel("@cf/moonshotai/kimi-k2.6")).toBe("@cf/moonshotai/kimi-k2.6");
  });

  it("falls back to default for unknown model ids", () => {
    expect(resolveChatModel("@cf/unknown/model")).toBe(DEFAULT_CHAT_MODEL);
  });

  it("falls back when Llama 3.2 is requested on production", () => {
    expect(resolveChatModel(CHAT_MODEL_LLAMA_32, PRODUCTION_CHAT_HOST)).toBe(
      DEFAULT_CHAT_MODEL
    );
  });

  it("respects WORKERS_AI_MODEL when allowlisted", () => {
    vi.stubEnv("WORKERS_AI_MODEL", CHAT_MODEL_LLAMA_32);
    expect(resolveChatModel(undefined, "localhost")).toBe(CHAT_MODEL_LLAMA_32);
  });
});

describe("isAllowedChatModel", () => {
  it("allows all catalog models on localhost", () => {
    expect(isAllowedChatModel(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_32, "localhost")).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_MISTRAL_SMALL)).toBe(true);
    expect(isAllowedChatModel("@cf/zai-org/glm-5.2")).toBe(true);
    expect(isAllowedChatModel("invalid")).toBe(false);
  });

  it("blocks Llama 3.2 on production host", () => {
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_32, PRODUCTION_CHAT_HOST)).toBe(false);
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_4_SCOUT, PRODUCTION_CHAT_HOST)).toBe(true);
  });
});

describe("getVisibleChatModels / isNonProductionChatHost", () => {
  it("treats localhost and workers.dev as non-production", () => {
    expect(isNonProductionChatHost("localhost")).toBe(true);
    expect(isNonProductionChatHost("127.0.0.1:8787")).toBe(true);
    expect(isNonProductionChatHost("bilauitmcuti-chat.workers.dev")).toBe(true);
    expect(isNonProductionChatHost(PRODUCTION_CHAT_HOST)).toBe(false);
  });

  it("hides Llama 3.2 from production picker", () => {
    const prod = getVisibleChatModels(PRODUCTION_CHAT_HOST).map((m) => m.id);
    const local = getVisibleChatModels("localhost").map((m) => m.id);
    expect(prod).not.toContain(CHAT_MODEL_LLAMA_32);
    expect(local).toContain(CHAT_MODEL_LLAMA_32);
    expect(prod).toContain(CHAT_MODEL_LLAMA_4_SCOUT);
    expect(prod).toContain(CHAT_MODEL_MISTRAL_SMALL);
  });
});

describe("getModelMaxOutputTokens", () => {
  it("uses the global ceiling for Gemma and mid-size models", () => {
    expect(getModelMaxOutputTokens(CHAT_MODEL_GEMMA_4)).toBe(8192);
    expect(getModelMaxOutputTokens(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(8192);
    expect(getModelMaxOutputTokens(CHAT_MODEL_MISTRAL_SMALL)).toBe(8192);
  });

  it("applies per-model ceilings", () => {
    expect(getModelMaxOutputTokens(CHAT_MODEL_LLAMA_32)).toBe(2048);
    expect(getModelMaxOutputTokens("@cf/moonshotai/kimi-k2.6")).toBe(4096);
    expect(getModelMaxOutputTokens("@cf/zai-org/glm-5.2")).toBe(4096);
    expect(getModelMaxOutputTokens("@cf/nvidia/nemotron-3-120b-a12b")).toBe(4096);
  });

  it("falls back to the global ceiling for unknown model ids", () => {
    expect(getModelMaxOutputTokens("@cf/unknown/model")).toBe(8192);
  });
});

describe("supportsFunctionCalling", () => {
  it("enables FC for Gemma and new frontier models", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(supportsFunctionCalling(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(supportsFunctionCalling(CHAT_MODEL_MISTRAL_SMALL)).toBe(true);
    expect(supportsFunctionCalling("@cf/moonshotai/kimi-k2.6")).toBe(true);
    expect(supportsFunctionCalling("@cf/zai-org/glm-5.2")).toBe(true);
    expect(supportsFunctionCalling("@cf/nvidia/nemotron-3-120b-a12b")).toBe(true);
  });

  it("disables FC for Llama 3.2", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_LLAMA_32)).toBe(false);
    expect(modelSupportsFunctionCalling(CHAT_MODEL_LLAMA_32)).toBe(false);
  });
});

describe("supportsReasoningUi", () => {
  it("enables reasoning UI for Gemma and frontier models", () => {
    expect(supportsReasoningUi(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(supportsReasoningUi("@cf/google/gemma-3-12b-it")).toBe(true);
    expect(supportsReasoningUi("google/gemini-2.0-flash")).toBe(true);
    expect(supportsReasoningUi("@cf/moonshotai/kimi-k2.6")).toBe(true);
  });

  it("disables reasoning UI for Llama and Mistral Small", () => {
    expect(supportsReasoningUi(CHAT_MODEL_LLAMA_32)).toBe(false);
    expect(supportsReasoningUi(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(false);
    expect(supportsReasoningUi(CHAT_MODEL_MISTRAL_SMALL)).toBe(false);
  });
});

describe("shouldStreamTokensToClient", () => {
  it("streams tokens to the chat client", () => {
    expect(shouldStreamTokensToClient()).toBe(true);
    expect(shouldStreamTokensToClient("localhost:3000")).toBe(true);
  });
});
