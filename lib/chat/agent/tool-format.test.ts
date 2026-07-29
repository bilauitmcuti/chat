import { describe, expect, it } from "vitest";
import {
  formatToolsForModel,
  usesOpenAiFunctionToolFormat,
} from "@/lib/chat/agent/tool-format";
import { MODEL_WORKERS_AI_PRODUCTION } from "@/lib/ai";

const MODEL_GEMINI_PARTNER = "google/gemini-3.1-flash-lite";

const sampleTool = {
  name: "search_calendar_activities",
  description: "Find calendar rows",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "keywords" },
    },
    required: ["query"],
  },
};

describe("formatToolsForModel", () => {
  it("wraps tools in OpenAI function shape for Gemma 4", () => {
    expect(usesOpenAiFunctionToolFormat(MODEL_WORKERS_AI_PRODUCTION)).toBe(true);
    const formatted = formatToolsForModel(MODEL_WORKERS_AI_PRODUCTION, [sampleTool]);
    expect(formatted[0]).toEqual({
      type: "function",
      function: {
        name: sampleTool.name,
        description: sampleTool.description,
        parameters: sampleTool.parameters,
      },
    });
  });

  it("uses functionDeclarations for Gemini partner models", () => {
    const formatted = formatToolsForModel(MODEL_GEMINI_PARTNER, [sampleTool]);
    expect(formatted[0]).toEqual({
      functionDeclarations: [
        {
          name: sampleTool.name,
          description: sampleTool.description,
          parameters: sampleTool.parameters,
        },
      ],
    });
  });
});
