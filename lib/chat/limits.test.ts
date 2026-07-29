import { describe, expect, it } from "vitest";
import { CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";
import { parseChatRequest } from "@/lib/chat/parse-request";

describe("chat message limits", () => {
  it("accepts messages up to CHAT_MAX_MESSAGE_LENGTH", () => {
    const message = "x".repeat(CHAT_MAX_MESSAGE_LENGTH);
    const result = parseChatRequest({ message });
    expect(result.success).toBe(true);
  });

  it("rejects messages over CHAT_MAX_MESSAGE_LENGTH", () => {
    const message = "x".repeat(CHAT_MAX_MESSAGE_LENGTH + 1);
    const result = parseChatRequest({ message });
    expect(result.success).toBe(false);
  });

});
