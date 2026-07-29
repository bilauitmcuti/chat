import { describe, expect, it, vi } from "vitest";
import type { ChatTopic } from "@/lib/chat/topic-router";
import {
  buildReasoningLlmPrompt,
  generateReasoningStatusLlm,
  isChatReasoningLlmEnabled,
  parseReasoningLlmJson,
  sanitizeLlmReasoningStatus,
} from "@/lib/chat/reasoning-llm";
import {
  MAX_REASONING_WORDS,
  MIN_REASONING_WORDS,
  wordCount,
} from "@/lib/chat/reasoning-status";

const baseInput = {
  message: "Kuliah semester ini bermula bila?",
  topics: ["academic_calendar"] as ChatTopic[],
  programLabel: "Diploma",
  sessionCount: 1,
  hasMatchedActivity: false,
  activityMatches: [] as [],
  contextIntent: "lecture" as const,
  needsList: false,
  phase: "pre_answer" as const,
};

describe("reasoning-llm", () => {
  it("builds a prompt that asks for JSON and forbids internal jargon", () => {
    const { systemPrompt, userPrompt } = buildReasoningLlmPrompt(baseInput);
    expect(systemPrompt).toMatch(/JSON/i);
    expect(systemPrompt).toMatch(/18 and 64/);
    expect(systemPrompt).toMatch(/Do not mention APIs/i);
    expect(userPrompt).toContain(baseInput.message);
    expect(userPrompt).toContain("Phase: pre_answer");
  });

  it("includes final answer for post_answer phase", () => {
    const { userPrompt } = buildReasoningLlmPrompt({
      ...baseInput,
      phase: "post_answer",
      finalAnswer: "Kuliah bermula pada 13-10-2025.",
    });
    expect(userPrompt).toContain("Final answer");
    expect(userPrompt).toContain("13-10-2025");
  });

  it("parses plain JSON and fenced JSON", () => {
    const plain = parseReasoningLlmJson(
      JSON.stringify({
        intent: "semester_start",
        topic: "lecture start date",
        source: "official academic calendar",
        progress_summary:
          "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date.",
      })
    );
    expect(plain?.intent).toBe("semester_start");
    expect(plain?.topic).toBe("lecture start date");

    const fenced = parseReasoningLlmJson(`\`\`\`json
{"intent":"short_semester","topic":"short semester dates","source":"official academic calendar","progress_summary":"The short semester period is being matched with the correct session so the answer reflects the right start and end dates."}
\`\`\``);
    expect(fenced?.intent).toBe("short_semester");
  });

  it("returns null for invalid JSON", () => {
    expect(parseReasoningLlmJson("not json")).toBeNull();
    expect(parseReasoningLlmJson("")).toBeNull();
  });

  it("sanitizes valid LLM output within word bounds", () => {
    const status = sanitizeLlmReasoningStatus(
      {
        intent: "semester_start",
        topic: "lecture start date",
        source: "official academic calendar",
        progress_summary:
          "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date from the official calendar.",
      },
      baseInput
    );
    expect(status).not.toBeNull();
    expect(wordCount(status!.progress_summary)).toBeGreaterThanOrEqual(MIN_REASONING_WORDS);
    expect(wordCount(status!.progress_summary)).toBeLessThanOrEqual(MAX_REASONING_WORDS);
  });

  it("rejects forbidden terms and multi-paragraph summaries", () => {
    expect(
      sanitizeLlmReasoningStatus(
        {
          progress_summary:
            "I'm calling the internal API and using RAG embeddings to load the database before composing the answer for you carefully.",
        },
        baseInput
      )
    ).toBeNull();

    expect(
      sanitizeLlmReasoningStatus(
        {
          progress_summary:
            "First line about the semester start date for lectures.\n\nSecond line that should not appear in the summary.",
        },
        baseInput
      )
    ).toBeNull();
  });

  it("fills missing intent/topic/source from heuristics", () => {
    const status = sanitizeLlmReasoningStatus(
      {
        progress_summary:
          "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date from the official calendar.",
      },
      baseInput
    );
    expect(status?.intent).toBe("semester_start");
    expect(status?.topic).toBe("lecture start date");
    expect(status?.source).toBe("official academic calendar");
  });

  it("returns null on timeout or AI failure", async () => {
    const prev = process.env.CHAT_REASONING_LLM;
    process.env.CHAT_REASONING_LLM = "1";
    const askAi = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return "{}";
    });
    const result = await generateReasoningStatusLlm({
      ...baseInput,
      askAi,
      timeoutMs: 1,
    });
    expect(result).toBeNull();
    process.env.CHAT_REASONING_LLM = prev;
  });

  it("returns sanitized status when askAi succeeds", async () => {
    const prev = process.env.CHAT_REASONING_LLM;
    process.env.CHAT_REASONING_LLM = "1";
    const askAi = vi.fn(async () =>
      JSON.stringify({
        intent: "semester_start",
        topic: "lecture start date",
        source: "official academic calendar",
        progress_summary:
          "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date from the official calendar.",
      })
    );
    const result = await generateReasoningStatusLlm({
      ...baseInput,
      askAi,
      timeoutMs: 2000,
    });
    expect(result?.intent).toBe("semester_start");
    expect(result?.progress_summary).toMatch(/semester|lecture/i);
    expect(askAi).toHaveBeenCalledOnce();
    process.env.CHAT_REASONING_LLM = prev;
  });

  it("returns null when reasoning LLM is disabled by default", async () => {
    const prev = process.env.CHAT_REASONING_LLM;
    delete process.env.CHAT_REASONING_LLM;
    const askAi = vi.fn(async () => "{}");
    const result = await generateReasoningStatusLlm({
      ...baseInput,
      askAi,
    });
    expect(result).toBeNull();
    expect(askAi).not.toHaveBeenCalled();
    process.env.CHAT_REASONING_LLM = prev;
  });

  it("respects CHAT_REASONING_LLM enable flag (off by default)", () => {
    const prev = process.env.CHAT_REASONING_LLM;
    delete process.env.CHAT_REASONING_LLM;
    expect(isChatReasoningLlmEnabled()).toBe(false);
    process.env.CHAT_REASONING_LLM = "1";
    expect(isChatReasoningLlmEnabled()).toBe(true);
    process.env.CHAT_REASONING_LLM = "0";
    expect(isChatReasoningLlmEnabled()).toBe(false);
    process.env.CHAT_REASONING_LLM = prev;
  });
});
