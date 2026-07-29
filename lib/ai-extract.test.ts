import { describe, expect, it } from "vitest";
import {
  extractStreamParts,
  extractToolCalls,
  tryExtractWorkersAiContent,
} from "@/lib/ai";

describe("extractToolCalls", () => {
  it("reads tool_calls from choices[0].message (OpenAI / Gemma shape)", () => {
    const calls = extractToolCalls({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "search_calendar_activities",
                  arguments: '{"query":"cuti semester"}',
                },
              },
            ],
          },
        },
      ],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("search_calendar_activities");
    expect(calls[0]?.arguments).toEqual({ query: "cuti semester" });
    expect(calls[0]?.id).toBe("call_1");
  });

  it("merges top-level and nested tool_calls without duplicates", () => {
    const calls = extractToolCalls({
      tool_calls: [{ name: "get_lecture_weeks", arguments: { full_table: true } }],
      choices: [
        {
          message: {
            tool_calls: [{ name: "get_lecture_weeks", arguments: { full_table: true } }],
          },
        },
      ],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("get_lecture_weeks");
  });
});

describe("tryExtractWorkersAiContent", () => {
  it("returns choices message content", () => {
    expect(
      tryExtractWorkersAiContent({
        choices: [{ message: { content: "Cuti semester bermula 15 Jun 2026." } }],
      })
    ).toBe("Cuti semester bermula 15 Jun 2026.");
  });

  it("falls back to reasoning when content is empty", () => {
    expect(
      tryExtractWorkersAiContent({
        choices: [
          {
            message: {
              content: "",
              reasoning: "Cuti semester bermula 15 Jun 2026.",
            },
          },
        ],
      })
    ).toBe("Cuti semester bermula 15 Jun 2026.");
  });

  it("prefers content over reasoning", () => {
    expect(
      tryExtractWorkersAiContent({
        choices: [
          {
            message: {
              content: "Jawapan rasmi.",
              reasoning: "Internal chain of thought.",
            },
          },
        ],
      })
    ).toBe("Jawapan rasmi.");
  });

  it("returns null for empty payloads", () => {
    expect(tryExtractWorkersAiContent({ choices: [{ message: { content: "" } }] })).toBeNull();
  });
});

describe("extractStreamParts", () => {
  it("keeps reasoning separate from answer content", () => {
    expect(
      extractStreamParts({
        choices: [
          {
            delta: {
              content: "Jawapan rasmi.",
              reasoning: "Internal chain of thought.",
            },
          },
        ],
      })
    ).toEqual({
      content: "Jawapan rasmi.",
      reasoning: "Internal chain of thought.",
    });
  });

  it("returns reasoning-only chunks without promoting them to content", () => {
    expect(
      extractStreamParts({
        choices: [
          {
            delta: {
              content: "",
              reasoning: "Checking lecture week table.",
            },
          },
        ],
      })
    ).toEqual({
      reasoning: "Checking lecture week table.",
    });
  });
});
