import { describe, expect, it } from "vitest";
import { mapChatErrorForTest } from "@/lib/chat/map-error";
import {
  CHAT_AI_UNAVAILABLE_MESSAGE,
  CHAT_EMPTY_REPLY_ERROR_MESSAGE,
  CHAT_MODEL_ACCESS_DENIED_MESSAGE,
  CHAT_MODEL_ERROR_MESSAGE,
  CHAT_MODEL_UNAVAILABLE_MESSAGE,
  CHAT_RATE_LIMIT_MESSAGE,
  CHAT_TIMEOUT_MESSAGE,
  CHAT_TOOL_FORMAT_ERROR_MESSAGE,
} from "@/lib/chat/user-messages";

describe("mapChatError", () => {
  it("maps missing AI binding to 503 with user-facing copy", () => {
    const err = Object.assign(new Error("Workers AI binding not available"), {
      status: 503,
    });
    const mapped = mapChatErrorForTest(err);
    expect(mapped.status).toBe(503);
    expect(mapped.message).toBe(CHAT_AI_UNAVAILABLE_MESSAGE);
  });

  it("maps empty model response to 502 with switch-model hint", () => {
    const mapped = mapChatErrorForTest(new Error("Empty response from model"));
    expect(mapped.status).toBe(502);
    expect(mapped.message).toBe(CHAT_EMPTY_REPLY_ERROR_MESSAGE);
  });

  it("maps rate limit errors to 429 with distinct message", () => {
    const mapped = mapChatErrorForTest(
      Object.assign(new Error("rate limit exceeded"), { status: 429 })
    );
    expect(mapped.status).toBe(429);
    expect(mapped.message).toBe(CHAT_RATE_LIMIT_MESSAGE);
  });

  it("maps model loading to unavailable message", () => {
    const mapped = mapChatErrorForTest(new Error("model is loading"));
    expect(mapped.status).toBe(503);
    expect(mapped.message).toBe(CHAT_MODEL_UNAVAILABLE_MESSAGE);
  });

  it("maps access denied to switch-model message", () => {
    const mapped = mapChatErrorForTest(
      Object.assign(new Error("403 forbidden"), { status: 403 })
    );
    expect(mapped.status).toBe(502);
    expect(mapped.message).toBe(CHAT_MODEL_ACCESS_DENIED_MESSAGE);
  });

  it("maps tool format errors to switch-model guidance", () => {
    const mapped = mapChatErrorForTest(
      new Error("Validation error on tools function schema")
    );
    expect(mapped.status).toBe(502);
    expect(mapped.message).toBe(CHAT_TOOL_FORMAT_ERROR_MESSAGE);
  });

  it("maps unknown model failures to model error message", () => {
    const mapped = mapChatErrorForTest(new Error("Unknown model not found"));
    expect(mapped.status).toBe(502);
    expect(mapped.message).toBe(CHAT_MODEL_ERROR_MESSAGE);
  });

  it("maps timeouts to timeout message", () => {
    const mapped = mapChatErrorForTest(
      Object.assign(new Error("Request timed out"), { status: 504 })
    );
    expect(mapped.status).toBe(504);
    expect(mapped.message).toBe(CHAT_TIMEOUT_MESSAGE);
  });
});
