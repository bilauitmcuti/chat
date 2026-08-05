import { describe, expect, it } from "vitest";
import {
  mergeFollowUpTopics,
  resolveFollowUpTurn,
} from "@/lib/chat/follow-up-context";
import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import type { AgentTurnContext } from "@/lib/chat/agent/types";
import { resolveStateSlugsFromMessage } from "@/lib/chat/public-holiday-context";

function baseCtx(overrides: Partial<AgentTurnContext> = {}): AgentTurnContext {
  return {
    message: "test",
    effectiveQuery: "test",
    todayISO: "2026-05-26",
    todayFormatted: "26 May 2026",
    program: "All",
    programLabel: "All Programmes",
    primaryGroup: "B",
    secondaryGroup: "A",
    effectiveSessions: ["B-20254"],
    contextSessionIds: ["B-20254"],
    topicRoute: { topics: ["academic_calendar"], hasNamedActivity: false },
    activityMatches: [],
    queryScope: { mentioned: [], relativeId: null, relativeKind: null },
    contextIntent: "all",
    useIntentFilter: true,
    primaryActivities: [],
    sessionListContext: "B-20254",
    comparisonContext: "",
    includeSecondary: false,
    secondaryActivitiesCount: 0,
    ...overrides,
  };
}

describe("resolveFollowUpTurn", () => {
  it("carries public_holiday for Selangor after cuti umum question", () => {
    const result = resolveFollowUpTurn({
      message: "Selangor",
      history: [
        {
          role: "user",
          content: "Cuti umum negeri saya tahun ni ada apa je?",
        },
        {
          role: "assistant",
          content:
            "Boleh saya tahu anda berada di negeri mana? Saya perlukan maklumat negeri tersebut untuk menyenaraikan cuti umum.",
        },
      ],
    });

    expect(result.isClarifyingFollowUp).toBe(true);
    expect(result.suppressMinimalTurn).toBe(true);
    expect(result.carriedTopics).toContain("public_holiday");
    expect(result.effectiveQuery.toLowerCase()).toContain("cuti umum");
    expect(result.effectiveQuery).toContain("Selangor");
  });

  it("does not carry topics for bare hi", () => {
    const result = resolveFollowUpTurn({
      message: "hi",
      history: [],
    });
    expect(result.suppressMinimalTurn).toBe(false);
    expect(result.carriedTopics).toEqual([]);
    expect(result.effectiveQuery).toBe("hi");
  });

  it("does not treat bare Selangor as holiday without holiday history", () => {
    const result = resolveFollowUpTurn({
      message: "Selangor",
      history: [],
    });
    expect(result.suppressMinimalTurn).toBe(false);
    expect(result.carriedTopics).toEqual([]);
  });

  it("carries public_holiday for year-only follow-up", () => {
    const result = resolveFollowUpTurn({
      message: "2025",
      history: [
        { role: "user", content: "Senarai cuti umum Malaysia" },
        {
          role: "assistant",
          content: "Untuk tahun berapa anda mahu senarai cuti umum?",
        },
      ],
    });
    expect(result.suppressMinimalTurn).toBe(true);
    expect(result.carriedTopics).toContain("public_holiday");
    expect(result.effectiveQuery).toContain("2025");
  });

  it("carries lecture_weeks for Minggu 3 follow-up", () => {
    const result = resolveFollowUpTurn({
      message: "Minggu 3",
      history: [
        { role: "user", content: "Minggu kuliah sekarang week berapa?" },
        {
          role: "assistant",
          content: "Anda ingin lihat minggu ke berapa?",
        },
      ],
    });
    expect(result.suppressMinimalTurn).toBe(true);
    expect(result.carriedTopics).toContain("lecture_weeks");
    expect(result.effectiveQuery.toLowerCase()).toMatch(/minggu kuliah/);
  });

  it("carries on yes after assistant asks for state", () => {
    const result = resolveFollowUpTurn({
      message: "ya",
      history: [
        { role: "user", content: "Ada cuti umum bulan ni?" },
        {
          role: "assistant",
          content: "Nak saya senarai ikut negeri? Negeri mana?",
        },
      ],
    });
    expect(result.suppressMinimalTurn).toBe(true);
    expect(result.carriedTopics).toContain("public_holiday");
  });
});

describe("mergeFollowUpTopics", () => {
  it("keeps public_holiday without forcing academic_calendar for bare state", () => {
    const topics = mergeFollowUpTopics(["public_holiday"], "Selangor", false);
    expect(topics).toEqual(["public_holiday"]);
  });

  it("adds lecture_weeks when current message asks for weeks", () => {
    const topics = mergeFollowUpTopics(
      ["academic_calendar"],
      "minggu kuliah penuh",
      false
    );
    expect(topics).toContain("academic_calendar");
    expect(topics).toContain("lecture_weeks");
  });
});

describe("follow-up tool registry", () => {
  it("exposes holiday tools when carried public_holiday topic", () => {
    const tools = buildToolRegistryForTurn(
      baseCtx({
        message: "Selangor",
        effectiveQuery: "Cuti umum negeri saya tahun ni ada apa je? Selangor",
        topicRoute: { topics: ["public_holiday"], hasNamedActivity: false },
      })
    );
    expect(tools).toContain("get_public_holidays");
    expect(tools).toContain("get_public_holiday_meta");
  });

  it("exposes holiday tools in plan mode when topic is public_holiday", () => {
    const tools = buildToolRegistryForTurn(
      baseCtx({
        topicRoute: { topics: ["public_holiday"], hasNamedActivity: false },
      }),
      "plan"
    );
    expect(tools).toContain("get_public_holidays");
    expect(tools).toContain("get_lecture_weeks");
  });
});

describe("Selangor slug", () => {
  it("resolves Selangor to selangor slug", () => {
    expect(resolveStateSlugsFromMessage("Selangor")).toContain("selangor");
  });
});
