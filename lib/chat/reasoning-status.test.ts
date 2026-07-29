import { describe, expect, it } from "vitest";
import {
  applyValidationFallback,
  buildRetryStatusLine,
  inferAnswerTopic,
  MAX_REASONING_WORDS,
  MIN_REASONING_WORDS,
  pickProgressPhrase,
  replaceReasoningParagraph,
  resolveReasoningIntent,
  validateReasoningStatus,
  wordCount,
} from "@/lib/chat/reasoning-status";
import {
  buildReasoningOpener,
  buildReasoningParagraph,
  buildReasoningStatus,
} from "@/lib/chat/reasoning-templates";
import type { ChatTopic } from "@/lib/chat/topic-router";

const FORBIDDEN =
  /\b(function[\s-]?calling|function calls?|tool calls?|\btools\b|\brag\b|embeddings?|vector search|loading data|internal apis?|\bapi\b|\bapis\b|databases?|composing answer|chain of thought|reasoning process|prefetch|\bprompts?\b)\b/i;

function expectParagraph(paragraph: string) {
  expect(paragraph.trim().length).toBeGreaterThan(0);
  expect(wordCount(paragraph)).toBeGreaterThanOrEqual(MIN_REASONING_WORDS);
  expect(wordCount(paragraph)).toBeLessThanOrEqual(MAX_REASONING_WORDS);
  expect(paragraph).not.toMatch(FORBIDDEN);
  expect(paragraph).not.toMatch(/^Checking\b/);
}

describe("reasoning-status + templates", () => {
  it("builds structured status with four fields for semester start", () => {
    const status = buildReasoningStatus({
      message: "Kuliah semester ini bermula bila?",
      topics: ["academic_calendar"],
      programLabel: "Diploma",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      contextIntent: "lecture",
      needsList: false,
    });
    expect(status.intent).toBe("semester_start");
    expect(status.topic).toBe("lecture start date");
    expect(status.source).toBe("official academic calendar");
    expectParagraph(status.progress_summary);
    expect(status.progress_summary.toLowerCase()).toMatch(
      /semester|kuliah|lecture|start|mula|bermula/
    );
  });

  it("resolves short semester intent and topic", () => {
    const status = buildReasoningStatus({
      message: "When is the short semester?",
      topics: ["academic_calendar"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      contextIntent: "all",
    });
    expect(status.intent).toBe("short_semester");
    expect(status.topic).toBe("short semester dates");
    expectParagraph(status.progress_summary);
    expect(status.progress_summary.toLowerCase()).toMatch(/short semester|intersession/);
  });

  it("resolves lecture week list intent for week 1-14", () => {
    const status = buildReasoningStatus({
      message: "List semua week 1-14",
      topics: ["lecture_weeks"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      needsList: true,
      contextIntent: "lecture_count",
    });
    expect(status.intent).toBe("lecture_week_list");
    expect(status.topic).toBe("lecture week dates");
    expectParagraph(status.progress_summary);
    expect(status.progress_summary).toMatch(
      /Week 1|Minggu 1|week-by-week|lecture week|minggu kuliah/i
    );
  });

  it("builds a start paragraph for lecture weeks without quoting the user", () => {
    const paragraph = buildReasoningOpener({
      message: "minggu kuliah 5 bila?",
      topics: ["lecture_weeks"],
      hasMatchedActivity: false,
      activityMatches: [],
      programLabel: "Diploma",
      sessionCount: 1,
    });
    expectParagraph(paragraph);
    expect(paragraph).not.toContain("minggu kuliah 5");
    expect(paragraph).toMatch(/lecture week|minggu kuliah/i);
  });

  it("builds progress and final paragraphs for public holidays", () => {
    const base = {
      message: "cuti umum 2027",
      topics: ["public_holiday"] as ChatTopic[],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
    };
    expectParagraph(buildReasoningParagraph({ ...base, phase: "start" }));
    expectParagraph(buildReasoningParagraph({ ...base, phase: "progress" }));
    expectParagraph(buildReasoningParagraph({ ...base, phase: "final" }));
  });

  it("covers student-focused UiTM questions", () => {
    const status = buildReasoningStatus({
      message: "berapa yuran pelajar diploma uitm?",
      topics: ["uitm_general"],
      programLabel: "Diploma",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      contextIntent: "all",
    });
    expect(status.intent).toMatch(/student_fees|uitm_general/);
    expectParagraph(status.progress_summary);
    expect(status.progress_summary).toMatch(/student|pelajar|UiTM|yuran|fee/i);
  });

  it("varies phrasing by message seed", () => {
    const a = buildReasoningParagraph({
      message: "bila cuti semester?",
      phase: "start",
      topics: ["academic_calendar"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      contextIntent: "break",
    });
    const b = buildReasoningParagraph({
      message: "when does semester break start for diploma?",
      phase: "start",
      topics: ["academic_calendar"],
      programLabel: "Diploma",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      contextIntent: "break",
    });
    expectParagraph(a);
    expectParagraph(b);
    expect(a).not.toBe(b);
  });

  it("replaces the paragraph instead of appending", () => {
    const first =
      "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date.";
    const second =
      "Reviewing the official information so the answer stays accurate and relevant.";
    expect(replaceReasoningParagraph(first, second)).toBe(second);
    expect(replaceReasoningParagraph(second, second)).toBe(second);
  });

  it("pickProgressPhrase is deterministic for the same seed", () => {
    const pool = [
      "I'm identifying the current semester and confirming when lectures begin before giving you the exact start date.",
      "The current semester is being matched so the lecture start date reflects the official academic calendar.",
    ] as const;
    expect(pickProgressPhrase(pool, "seed-a")).toBe(pickProgressPhrase(pool, "seed-a"));
    expect(pickProgressPhrase(pool, "seed-b")).toBe(pickProgressPhrase(pool, "seed-b"));
  });

  it("builds retry paragraphs within the word range", () => {
    const paragraph = buildReasoningParagraph({
      message: "bila cuti?",
      phase: "retry",
      topics: ["academic_calendar"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      activityMatches: [],
      retryReason: "dates",
    });
    expectParagraph(paragraph);
  });

  it("includes program context for multi-session comparisons", () => {
    const status = buildReasoningStatus({
      message: "compare session dates",
      topics: ["academic_calendar"],
      programLabel: "Degree",
      sessionCount: 3,
      hasMatchedActivity: false,
      activityMatches: [],
    });
    expect(status.intent).toBe("multi_session");
    expectParagraph(status.progress_summary);
    expect(status.progress_summary).toMatch(/session|sesi/i);
  });

  it("builds short retry status lines by language and reason", () => {
    const datesEn = buildRetryStatusLine({
      message: "when does semester start?",
      topics: ["academic_calendar"],
      sessionCount: 1,
      hasMatchedActivity: false,
      retryReason: "dates",
    });
    expect(datesEn.length).toBeGreaterThan(0);
    expect(datesEn.length).toBeLessThan(80);
    expect(datesEn).toMatch(/verif|double-check/i);

    const incompleteMs = buildRetryStatusLine({
      message: "senarai cuti semester",
      topics: ["academic_calendar"],
      sessionCount: 1,
      hasMatchedActivity: false,
      retryReason: "incomplete",
    });
    expect(incompleteMs).toMatch(/jawapan|respons/i);
  });

  it("infers answer topic from reply content", () => {
    expect(
      inferAnswerTopic(
        "Kuliah bermula pada 13 Oktober 2025.",
        "Kuliah semester ini bermula bila?"
      )
    ).toBe("lecture start date");

    expect(
      inferAnswerTopic(
        "Week 1: 13-10-2025 to 19-10-2025\nWeek 2: ...",
        "List semua week 1-14"
      )
    ).toBe("lecture week dates");

    expect(
      inferAnswerTopic("Yuran pengajian diploma adalah RM...", "berapa yuran diploma?")
    ).toBe("student fees and services");
  });

  it("keeps progress_summary when topic matches the answer", () => {
    const status = buildReasoningStatus({
      message: "Kuliah semester ini bermula bila?",
      topics: ["academic_calendar"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      contextIntent: "lecture",
    });
    const validated = validateReasoningStatus(
      status,
      "Kuliah untuk semester ini bermula pada 13-10-2025.",
      "Kuliah semester ini bermula bila?"
    );
    expect(validated.needsLlmRefine).toBe(false);
    expect(validated.status.progress_summary).toBe(status.progress_summary);
  });

  it("flags needsLlmRefine when topic mismatches without rewriting summary", () => {
    const status = buildReasoningStatus({
      message: "when is lecture week 5?",
      topics: ["lecture_weeks"],
      programLabel: "All",
      sessionCount: 1,
      hasMatchedActivity: false,
      contextIntent: "lecture",
    });
    expect(status.intent).toBe("lecture_weeks");
    const validated = validateReasoningStatus(
      status,
      "Yuran pengajian diploma adalah RM 1,200 setiap semester di kampus utama.",
      "when is lecture week 5?"
    );
    expect(validated.needsLlmRefine).toBe(true);
    expect(validated.status.progress_summary).toBe(status.progress_summary);
  });

  it("applyValidationFallback uses bilingual static text", () => {
    const status = {
      intent: "lecture_weeks",
      topic: "lecture week dates",
      source: "official academic calendar",
      progress_summary:
        "Jadual minggu kuliah sedang diteliti supaya minggu dan tarikh yang anda perlukan selari dengan kalendar rasmi.",
    };
    expect(applyValidationFallback(status, "when is lecture week 5?").progress_summary).toBe(
      "Reviewing the official information so the answer stays accurate and relevant."
    );
    expect(applyValidationFallback(status, "bila minggu kuliah 3?").progress_summary).toBe(
      "Menyemak maklumat rasmi supaya jawapan kekal tepat dan relevan."
    );
  });

  it("resolveReasoningIntent covers general and random in-scope questions", () => {
    expect(
      resolveReasoningIntent({
        message: "apa itu UiTM?",
        topics: ["uitm_general"],
        programLabel: "All",
        sessionCount: 1,
        hasMatchedActivity: false,
      })
    ).toBe("uitm_general");

    expect(
      resolveReasoningIntent({
        message: "tarikh penting semester ni",
        topics: ["academic_calendar"],
        programLabel: "All",
        sessionCount: 1,
        hasMatchedActivity: false,
        contextIntent: "all",
      })
    ).toBe("general_info");
  });
});
