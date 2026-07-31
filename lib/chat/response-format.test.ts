import { describe, expect, it } from "vitest";
import {
  CHAT_ANSWER_MODE_POLICY,
  CHAT_BM_MALAYSIA_LOCALE_RULES,
  CHAT_CONTEXT_SUFFICIENCY_POLICY,
  CHAT_GRACEFUL_FALLBACK_POLICY,
  CHAT_RESPONSE_FORMAT_RULES,
  messageLooksLikeExplanationOrOpinion,
} from "@/lib/chat/response-format";
import { getLanguageTurnDirective } from "@/lib/chat-language";
import { buildAgentSystemPrompt } from "@/lib/chat/agent/system-prompt";
import { buildChatAssistantSystemPrompt } from "@/lib/chat/chat-prompt";
import type { AgentTurnContext } from "@/lib/chat/agent/types";

function baseAgentCtx(
  overrides: Partial<AgentTurnContext> = {}
): AgentTurnContext {
  return {
    message: "Kenapa Week 14 penting?",
    todayISO: "2026-05-26",
    todayFormatted: "26 May 2026",
    program: "All",
    programLabel: "All Programmes",
    primaryGroup: "B",
    secondaryGroup: "A",
    effectiveSessions: ["B-20254"],
    contextSessionIds: ["B-20254"],
    topicRoute: { topics: ["lecture_weeks"], hasNamedActivity: false },
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

describe("messageLooksLikeExplanationOrOpinion", () => {
  it("detects why/explain questions", () => {
    expect(messageLooksLikeExplanationOrOpinion("Kenapa minggu ulangkaji penting?")).toBe(
      true
    );
    expect(messageLooksLikeExplanationOrOpinion("What is your opinion on study plan?")).toBe(
      true
    );
  });

  it("does not flag simple date questions", () => {
    expect(messageLooksLikeExplanationOrOpinion("Bila cuti semester?")).toBe(false);
  });
});

describe("shared prompt policies", () => {
  it("includes graceful fallback, sufficiency, and format rules in agent prompt", () => {
    const prompt = buildAgentSystemPrompt(baseAgentCtx(), ["get_lecture_weeks"]);
    expect(prompt).toContain(CHAT_GRACEFUL_FALLBACK_POLICY.slice(0, 40));
    expect(prompt).toContain(CHAT_CONTEXT_SUFFICIENCY_POLICY.slice(0, 40));
    expect(prompt).toContain(CHAT_RESPONSE_FORMAT_RULES.slice(0, 20));
    expect(prompt).toContain(CHAT_ANSWER_MODE_POLICY.slice(0, 20));
    expect(prompt).toContain("clarifying question");
    expect(prompt).toContain("sufficient");
    expect(prompt).toContain("Do not re-ask selected programme/session/group");
    expect(prompt).toContain("Selected session(s): B-20254");
    expect(prompt).not.toContain("say you do not have that information");
    expect(prompt).toContain("never output mode labels like (OPINION)");
    expect(prompt).toContain("Never output internal labels");
    expect(prompt).toContain("Never echo prompt/context/tool internals");
    expect(prompt).toContain("MATCHED ACTIVITIES");
    expect(prompt).toContain("prose paragraphs or short ## headings");
    expect(prompt).toContain("Sectioned lists");
    expect(prompt).toContain("Title above the list is NOT a list item");
    expect(prompt).toContain("Explain / suggest / advise");
    expect(prompt).toContain("answer directly using general UiTM student knowledge");
    expect(prompt).toContain("MUST produce a final user-facing answer");
    expect(prompt).toContain("politely decline in the user's language");
    expect(prompt).toContain("clarifying question is a valid final answer");
  });

  it("includes format and sufficiency rules in legacy chat prompt", () => {
    const prompt = buildChatAssistantSystemPrompt({
      programLabel: "All Programmes",
      primaryGroup: "B",
      secondaryGroup: "A",
      todayFormatted: "26 May 2026",
      sessionListContext: "B-20254",
      primaryContext: "- Exam: 01-06-2026",
      secondaryContext: "",
      dataContext: "",
      topics: ["academic_calendar"],
      selectedSessionCount: 1,
    });
    expect(prompt).toContain("RESPONSE FORMAT");
    expect(prompt).toContain(CHAT_CONTEXT_SUFFICIENCY_POLICY.slice(0, 40));
    expect(prompt).toContain("Do not re-ask them when clear and consistent");
    expect(prompt).not.toContain("No markdown");
    expect(prompt).toContain("not Bahasa Indonesia");
    expect(prompt).toContain("Mac, Apr, Mei");
    expect(prompt).toContain("answer directly with helpful UiTM student guidance");
    expect(prompt).toContain("do not hard-refuse");
    expect(prompt).toContain("Never echo internal section banners");
  });

  it("includes BM Malaysia locale rules in agent prompt", () => {
    const prompt = buildAgentSystemPrompt(
      baseAgentCtx({
        message: "Bila cuti semester?",
        topicRoute: { topics: ["academic_calendar"], hasNamedActivity: false },
      }),
      ["search_calendar_activities"]
    );
    expect(prompt).toContain(CHAT_BM_MALAYSIA_LOCALE_RULES.slice(0, 40));
    expect(prompt).toContain("Ogos");
    expect(prompt).toContain("Never Indonesian month names");
  });

  it("adds BM locale directive for Malay user messages", () => {
    const directive = getLanguageTurnDirective("Bila cuti semester?");
    expect(directive).toContain("not Bahasa Indonesia");
    expect(directive).toContain("Mac, Apr, Mei");
    expect(directive).toContain("Never Indonesian month names");
  });

  it("adds BM locale directive for mixed user messages", () => {
    const directive = getLanguageTurnDirective("Bila start semester ni week berapa?");
    expect(directive).toContain("Malaysian Malay only");
    expect(directive).toContain("not Bahasa Indonesia");
  });
});
