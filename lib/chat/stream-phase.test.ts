import { describe, expect, it } from "vitest";
import { CHAT_STREAM_PHASE, isChatStreamPhase } from "@/lib/chat/stream-phase";

describe("stream-phase", () => {
  it("recognizes retry phase", () => {
    expect(isChatStreamPhase(CHAT_STREAM_PHASE.RETRY)).toBe(true);
    expect(isChatStreamPhase("thinking")).toBe(false);
  });
});
