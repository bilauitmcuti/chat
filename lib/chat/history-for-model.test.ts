import { describe, expect, it } from "vitest";
import {
  MODEL_HISTORY_ASSISTANT_MAX_CHARS,
  MODEL_HISTORY_USER_MAX_CHARS,
  trimHistoryForModel,
} from "@/lib/chat/history-for-model";

describe("trimHistoryForModel", () => {
  it("keeps only the last four messages", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${i}`,
    }));
    const trimmed = trimHistoryForModel(history);
    expect(trimmed).toHaveLength(4);
    expect(trimmed[0]?.content).toBe("msg-2");
    expect(trimmed[3]?.content).toBe("msg-5");
  });

  it("truncates long user messages", () => {
    const long = "u".repeat(MODEL_HISTORY_USER_MAX_CHARS + 500);
    const trimmed = trimHistoryForModel([{ role: "user", content: long }]);
    expect(trimmed[0]?.content.length).toBeLessThanOrEqual(
      MODEL_HISTORY_USER_MAX_CHARS + 20
    );
    expect(trimmed[0]?.content).toContain("...[truncated]");
  });

  it("preserves head and tail for long assistant replies", () => {
    const head = "START-";
    const tail = "-END";
    const middle = "m".repeat(MODEL_HISTORY_ASSISTANT_MAX_CHARS + 500);
    const long = head + middle + tail;
    const trimmed = trimHistoryForModel([{ role: "assistant", content: long }]);
    const content = trimmed[0]?.content ?? "";
    expect(content.startsWith(head)).toBe(true);
    expect(content.endsWith(tail)).toBe(true);
    expect(content).toContain("...[truncated]");
    expect(content.length).toBeLessThanOrEqual(MODEL_HISTORY_ASSISTANT_MAX_CHARS + 20);
  });
});
