import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  agentModeForModelChain,
  agentModeForModelId,
  isChatAgentEnabled,
} from "@/lib/chat/agent/run-agent";
import {
  MODEL_WORKERS_AI_DEV,
  MODEL_WORKERS_AI_PRODUCTION,
  supportsFunctionCalling,
} from "@/lib/ai";

describe("isChatAgentEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true by default", () => {
    expect(isChatAgentEnabled()).toBe(true);
  });

  it("is false when CHAT_USE_AGENT=0", () => {
    vi.stubEnv("CHAT_USE_AGENT", "0");
    expect(isChatAgentEnabled()).toBe(false);
  });

  it("is true when CHAT_USE_AGENT=1", () => {
    vi.stubEnv("CHAT_USE_AGENT", "1");
    expect(isChatAgentEnabled()).toBe(true);
  });
});

describe("supportsFunctionCalling", () => {
  it("enables Gemma production model", () => {
    expect(supportsFunctionCalling(MODEL_WORKERS_AI_PRODUCTION)).toBe(true);
    expect(supportsFunctionCalling("google/gemini-3.1-flash-lite")).toBe(true);
  });

  it("disables Llama dev model", () => {
    expect(supportsFunctionCalling(MODEL_WORKERS_AI_DEV)).toBe(false);
  });
});

describe("agentModeForModelId", () => {
  it("uses tools for Gemma on dev host selection", () => {
    expect(agentModeForModelId(MODEL_WORKERS_AI_PRODUCTION)).toBe("tools");
  });

  it("uses compact fallback for Llama", () => {
    expect(agentModeForModelId(MODEL_WORKERS_AI_DEV)).toBe("compact");
  });
});

describe("agentModeForModelChain", () => {
  it("uses tools when chain includes a function-calling model", () => {
    expect(agentModeForModelChain([MODEL_WORKERS_AI_PRODUCTION])).toBe("tools");
  });

  it("uses compact fallback for dev-only chain", () => {
    expect(agentModeForModelChain([MODEL_WORKERS_AI_DEV])).toBe("compact");
  });
});
