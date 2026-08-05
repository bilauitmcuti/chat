import { describe, expect, it } from "vitest";
import {
  agentModeForModelChain,
  agentModeForModelId,
  isChatAgentEnabled,
} from "@/lib/chat/agent/run-agent";
import { supportsFunctionCalling } from "@/lib/ai";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_32,
} from "@/lib/chat/models";

describe("isChatAgentEnabled", () => {
  it("is enabled by default", () => {
    expect(isChatAgentEnabled()).toBe(true);
  });
});

describe("supportsFunctionCalling", () => {
  it("enables FC for Gemma", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_GEMMA_4)).toBe(true);
  });

  it("disables FC for Llama", () => {
    expect(supportsFunctionCalling(CHAT_MODEL_LLAMA_32)).toBe(false);
  });
});

describe("agentModeForModelId", () => {
  it("uses tools mode for Gemma", () => {
    expect(agentModeForModelId(CHAT_MODEL_GEMMA_4)).toBe("tools");
  });

  it("uses compact mode for Llama", () => {
    expect(agentModeForModelId(CHAT_MODEL_LLAMA_32)).toBe("compact");
  });
});

describe("agentModeForModelChain", () => {
  it("uses tools when any model supports FC", () => {
    expect(agentModeForModelChain([CHAT_MODEL_GEMMA_4])).toBe("tools");
  });

  it("uses compact for Llama-only chain", () => {
    expect(agentModeForModelChain([CHAT_MODEL_LLAMA_32])).toBe("compact");
  });
});
