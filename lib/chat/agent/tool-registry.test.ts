import { describe, expect, it } from "vitest";
import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import type { AgentTurnContext } from "@/lib/chat/agent/types";

function baseCtx(overrides: Partial<AgentTurnContext> = {}): AgentTurnContext {
  return {
    message: "test",
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

describe("buildToolRegistryForTurn", () => {
  it("exposes calendar tools for academic_calendar topic", () => {
    const tools = buildToolRegistryForTurn(baseCtx());
    expect(tools).toContain("search_calendar_activities");
    expect(tools).toContain("get_academic_calendar");
    expect(tools).toContain("search_uitm_knowledge");
    expect(tools).not.toContain("get_lecture_weeks");
  });

  it("exposes lecture weeks tool when topic includes lecture_weeks", () => {
    const tools = buildToolRegistryForTurn(
      baseCtx({
        topicRoute: {
          topics: ["lecture_weeks"],
          hasNamedActivity: false,
        },
      })
    );
    expect(tools).toContain("get_lecture_weeks");
  });

  it("always includes search when activity matches exist", () => {
    const tools = buildToolRegistryForTurn(
      baseCtx({
        topicRoute: { topics: ["uitm_general"], hasNamedActivity: true },
        activityMatches: [
          {
            activity: {
              name: "Cuti Semester",
              startDate: "2026-06-01",
              type: "break",
              group: "B",
            },
            sessionId: "B-20254",
            score: 100,
          },
        ],
      })
    );
    expect(tools).toContain("search_calendar_activities");
  });
});
