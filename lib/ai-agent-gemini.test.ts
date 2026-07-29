import { describe, expect, it } from "vitest";
import { agentMessagesToGeminiContents, type AgentChatMessage } from "@/lib/ai";

describe("agentMessagesToGeminiContents", () => {
  it("maps tool calls and tool results for Gemini", () => {
    const messages: AgentChatMessage[] = [
      { role: "system", content: "You are a calendar bot." },
      { role: "user", content: "Bila cuti semester?" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ name: "search_calendar_activities", arguments: { query: "cuti semester" } }],
      },
      {
        role: "tool",
        name: "search_calendar_activities",
        content: '{"rows":[{"name":"Cuti Semester","start":"01-01-2026"}]}',
      },
    ];

    const contents = agentMessagesToGeminiContents(messages);

    expect(contents[0]?.parts[0]).toEqual({
      text: "Instructions:\nYou are a calendar bot.",
    });
    expect(contents[2]?.role).toBe("model");
    expect(contents[2]?.parts[0]).toEqual({
      functionCall: {
        name: "search_calendar_activities",
        args: { query: "cuti semester" },
      },
    });
    expect(contents[3]?.role).toBe("user");
    expect(contents[3]?.parts[0]).toMatchObject({
      functionResponse: {
        name: "search_calendar_activities",
      },
    });
  });
});
