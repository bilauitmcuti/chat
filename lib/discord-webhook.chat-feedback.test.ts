import { describe, expect, it } from "vitest";
import { buildChatFeedbackEmbed } from "./discord-webhook";

describe("buildChatFeedbackEmbed", () => {
  it("does not set embed.timestamp (Discord requires ISO8601)", () => {
    const embed = buildChatFeedbackEmbed({
      rating: "up",
      userMessage: "When is cuti?",
      assistantMessage: "Next break is …",
      time: "24 May 2026, 3:00 pm",
      program: "CS",
      correlationId: "chat-abc",
    });
    expect(embed.timestamp).toBeUndefined();
    expect(embed.title).toContain("helpful");
    expect(embed.fields?.some((f) => f.name === "Time" && f.value === "24 May 2026, 3:00 pm")).toBe(true);
  });

  it("uses placeholder for empty question text", () => {
    const embed = buildChatFeedbackEmbed({
      rating: "down",
      userMessage: "   ",
      assistantMessage: "Answer here",
      time: "now",
    });
    const q = embed.fields?.find((f) => f.name === "Question");
    expect(q?.value).toBe("(empty)");
  });
});
