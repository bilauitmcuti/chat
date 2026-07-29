import { describe, expect, it, vi } from "vitest";
import { runDeterministicPrefetch } from "@/lib/chat/agent/deterministic-prefetch";
import type { AgentTurnContext } from "@/lib/chat/agent/types";

vi.mock("@/lib/chat/agent/tools/execute", () => ({
  executeChatTool: vi.fn(async (name: string) => `output:${name}`),
}));

function minimalCtx(topics: AgentTurnContext["topicRoute"]["topics"]): AgentTurnContext {
  return {
    message: "test",
    todayISO: "2026-03-15",
    todayFormatted: "15 March 2026",
    program: "All",
    programLabel: "All",
    primaryGroup: "B",
    secondaryGroup: "A",
    effectiveSessions: ["B-20263"],
    contextSessionIds: ["B-20263"],
    topicRoute: { topics, hasNamedActivity: false },
    activityMatches: [],
    queryScope: { mode: "default", mentioned: [], relativeId: null, relativeKind: null } as AgentTurnContext["queryScope"],
    contextIntent: { kind: "general", keywords: [] } as unknown as AgentTurnContext["contextIntent"],
    useIntentFilter: false,
    primaryActivities: [],
    sessionListContext: "",
    comparisonContext: "",
    includeSecondary: false,
    secondaryActivitiesCount: 0,
  };
}

describe("runDeterministicPrefetch", () => {
  it("runs tools for lecture weeks topic", async () => {
    const started: string[] = [];
    const result = await runDeterministicPrefetch(minimalCtx(["lecture_weeks"]), (toolName) => {
      started.push(toolName);
    });
    expect(result.toolsUsed.length).toBeGreaterThan(0);
    expect(result.outputBlock).toContain("get_lecture_weeks");
    expect(started).toContain("get_lecture_weeks");
  });
});
