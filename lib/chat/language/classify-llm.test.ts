import { describe, expect, it } from "vitest";
import {
  buildLanguageClassifyPrompt,
  parseLanguageClassifyJson,
} from "@/lib/chat/language/classify-llm";
import { detectHeuristicLanguage } from "@/lib/chat/language/detect";

describe("parseLanguageClassifyJson", () => {
  it("parses soft-JSON classify payload", () => {
    const parsed = parseLanguageClassifyJson(
      '{"reply_language":"en","locale":"en","code_switch":false,"confidence":0.91}'
    );
    expect(parsed).toEqual({
      replyLanguage: "en",
      locale: "en",
      codeSwitch: false,
      confidence: 0.91,
    });
  });

  it("normalizes malay aliases to ms-MY", () => {
    const parsed = parseLanguageClassifyJson(
      'Here you go:\n```json\n{"reply_language":"malay","locale":"ms","code_switch":false,"confidence":0.7}\n```'
    );
    expect(parsed?.replyLanguage).toBe("ms-MY");
    expect(parsed?.locale).toBe("ms-MY");
  });

  it("returns null on garbage", () => {
    expect(parseLanguageClassifyJson("not json")).toBeNull();
  });
});

describe("buildLanguageClassifyPrompt", () => {
  it("asks for JSON schema and mentions loanword rule", () => {
    const heuristic = detectHeuristicLanguage("When is cuti semester?");
    const { systemPrompt, userPrompt } = buildLanguageClassifyPrompt({
      message: "When is cuti semester?",
      heuristic,
    });
    expect(systemPrompt).toMatch(/JSON/i);
    expect(systemPrompt).toContain("ms-MY");
    expect(systemPrompt).toContain("loanwords");
    expect(userPrompt).toContain("When is cuti semester?");
  });
});
