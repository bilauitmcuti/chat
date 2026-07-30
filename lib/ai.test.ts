import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_32,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  CHAT_MODEL_GLM_47_FLASH,
  CHAT_MODELS,
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
  buildDynamicRouteCompatQuery,
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
    expect(resolveChatModel(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(CHAT_MODEL_LLAMA_4_SCOUT);
    expect(resolveChatModel(CHAT_MODEL_MISTRAL_SMALL)).toBe(CHAT_MODEL_MISTRAL_SMALL);
    expect(resolveChatModel(CHAT_MODEL_GLM_47_FLASH)).toBe(CHAT_MODEL_GLM_47_FLASH);
  });

  it("falls back to default for unknown model ids", () => {
    expect(resolveChatModel("@cf/unknown/model")).toBe(DEFAULT_CHAT_MODEL);
  });

  it("falls back when Llama 3.2 is requested (excluded from picker)", () => {
    expect(resolveChatModel(CHAT_MODEL_LLAMA_32, "localhost")).toBe(
      DEFAULT_CHAT_MODEL
    );
    expect(resolveChatModel(CHAT_MODEL_LLAMA_32, PRODUCTION_CHAT_HOST)).toBe(
      DEFAULT_CHAT_MODEL
    );
  });

  it("respects WORKERS_AI_MODEL when allowlisted", () => {
    vi.stubEnv("WORKERS_AI_MODEL", CHAT_MODEL_LLAMA_4_SCOUT);
    expect(resolveChatModel(undefined, "localhost")).toBe(CHAT_MODEL_LLAMA_4_SCOUT);
  });

  it("ignores WORKERS_AI_MODEL when excluded from catalog", () => {
    vi.stubEnv("WORKERS_AI_MODEL", CHAT_MODEL_LLAMA_32);
    expect(resolveChatModel(undefined, "localhost")).toBe(DEFAULT_CHAT_MODEL);
  });
});

describe("isAllowedChatModel", () => {
  it("allows catalog models", () => {
    expect(isAllowedChatModel(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_MISTRAL_SMALL)).toBe(true);
    expect(isAllowedChatModel(CHAT_MODEL_GLM_47_FLASH)).toBe(true);
    expect(isAllowedChatModel("invalid")).toBe(false);
  });

  it("blocks Llama 3.2 everywhere", () => {
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_32, "localhost")).toBe(false);
    expect(isAllowedChatModel(CHAT_MODEL_LLAMA_32, PRODUCTION_CHAT_HOST)).toBe(false);
  });
});

describe("getVisibleChatModels / isNonProductionChatHost", () => {
  it("treats localhost and workers.dev as non-production", () => {
    expect(isNonProductionChatHost("localhost")).toBe(true);
    expect(isNonProductionChatHost("127.0.0.1:8787")).toBe(true);
    expect(isNonProductionChatHost("bilauitmcuti-chat.workers.dev")).toBe(true);
    expect(isNonProductionChatHost(PRODUCTION_CHAT_HOST)).toBe(false);
    expect(isNonProductionChatHost("bilauitmcuti.com")).toBe(false);
    expect(isNonProductionChatHost("www.bilauitmcuti.com")).toBe(false);
  });

  it("excludes Llama 3.2 from the picker on all hosts", () => {
    const prod = getVisibleChatModels(PRODUCTION_CHAT_HOST).map((m) => m.id);
    const local = getVisibleChatModels("localhost").map((m) => m.id);
    expect(prod).not.toContain(CHAT_MODEL_LLAMA_32);
    expect(local).not.toContain(CHAT_MODEL_LLAMA_32);
    expect(prod).toContain(CHAT_MODEL_LLAMA_4_SCOUT);
    expect(prod).toContain(CHAT_MODEL_MISTRAL_SMALL);
    expect(prod).toHaveLength(CHAT_MODELS.length);
  });

  it("includes descriptions for every visible model", () => {
    for (const model of getVisibleChatModels()) {
      expect(model.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("orders picker models by provider A-Z", () => {
    const providers = getVisibleChatModels().map((m) => m.provider);
    expect(providers).toEqual([...providers].sort((a, b) => a.localeCompare(b)));
  });
});

describe("getModelMaxOutputTokens", () => {
  it("uses the global ceiling for Gemma and mid-size models", () => {
    expect(getModelMaxOutputTokens(CHAT_MODEL_GEMMA_4)).toBe(8192);
    expect(getModelMaxOutputTokens(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(8192);
    expect(getModelMaxOutputTokens(CHAT_MODEL_MISTRAL_SMALL)).toBe(8192);
  });

  it("applies the global ceiling when models have no per-model cap", () => {
    expect(getModelMaxOutputTokens(CHAT_MODEL_GLM_47_FLASH)).toBe(8192);
    expect(getModelMaxOutputTokens("@cf/nvidia/nemotron-3-120b-a12b")).toBe(8192);
  });

  it("falls back to the global ceiling for unknown model ids", () => {
    expect(getModelMaxOutputTokens("@cf/unknown/model")).toBe(8192);
    expect(getModelMaxOutputTokens(CHAT_MODEL_LLAMA_32)).toBe(8192);
  });
});

describe("supportsFunctionCalling", () => {
  it("enables FC for all picker models", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(supportsFunctionCalling(CHAT_MODEL_LLAMA_4_SCOUT)).toBe(true);
    expect(supportsFunctionCalling(CHAT_MODEL_MISTRAL_SMALL)).toBe(true);
    expect(supportsFunctionCalling(CHAT_MODEL_GLM_47_FLASH)).toBe(true);
    expect(supportsFunctionCalling("@cf/nvidia/nemotron-3-120b-a12b")).toBe(true);
  });

  it("disables FC for excluded Llama 3.2", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_LLAMA_32)).toBe(false);
    expect(modelSupportsFunctionCalling(CHAT_MODEL_LLAMA_32)).toBe(false);
  });
});

describe("supportsReasoningUi", () => {
  it("enables reasoning UI for Gemma and frontier models", () => {
    expect(supportsReasoningUi(CHAT_MODEL_GEMMA_4)).toBe(true);
    expect(supportsReasoningUi("@cf/google/gemma-3-12b-it")).toBe(true);
    expect(supportsReasoningUi("google/gemini-2.0-flash")).toBe(true);
    expect(supportsReasoningUi(CHAT_MODEL_GLM_47_FLASH)).toBe(true);
  });

  it("disables reasoning UI for Scout and Mistral Small", () => {
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

describe("buildDynamicRouteCompatQuery", () => {
  it("maps Workers AI input to OpenAI compat query", () => {
    expect(
      buildDynamicRouteCompatQuery("dynamic/llama-scout", {
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 256,
        temperature: 0.2,
        stream: true,
        chat_template_kwargs: { enable_thinking: false },
        tools: [
          {
            name: "search",
            description: "Find rows",
            parameters: { type: "object", properties: {} },
          },
        ],
      })
    ).toEqual({
      model: "dynamic/llama-scout",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 256,
      temperature: 0.2,
      stream: true,
      tools: [
        {
          type: "function",
          function: {
            name: "search",
            description: "Find rows",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });
  });
});
