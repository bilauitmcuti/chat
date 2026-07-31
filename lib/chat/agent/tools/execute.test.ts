import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Activity } from "@/lib/data";
import type { AgentTurnContext } from "@/lib/chat/agent/types";
import { executeChatTool } from "@/lib/chat/agent/tools/execute";

vi.mock("@/lib/chat/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat/context")>();
  return {
    ...actual,
    formatPrimaryCalendarContext: vi.fn(() => "MOCK CALENDAR ROW: Cuti Semester 01-06-2026"),
    getFilteredActivitiesForSession: vi.fn(() => []),
  };
});

vi.mock("@/lib/calendar-api-server", () => ({
  fetchTodayStatus: vi.fn(async () => ({
    date: "2026-03-15",
    primaryStatus: "lecture",
    statuses: ["lecture"],
    sessionResolved: { id: "B-20263", label: "Sesi", group: "B" },
    matchedActivities: [
      {
        name: "Kuliah",
        startDate: "2026-03-01",
        endDate: "2026-06-01",
        type: "lecture",
        group: "B",
      },
    ],
  })),
  fetchPublicHolidayMeta: vi.fn(async () => ({
    defaultYear: 2026,
    yearOptions: [{ value: 2026, label: "2026" }],
    coverageOptions: [{ value: "all" as const, label: "All" }],
    stateOptions: [{ value: "selangor", label: "Selangor" }],
  })),
  fetchPublicHolidays: vi.fn(async () => ({
    defaultYear: 2026,
    year: 2026,
    total: 0,
    holidays: [],
  })),
}));

function baseCtx(overrides: Partial<AgentTurnContext> = {}): AgentTurnContext {
  return {
    message: "bila xyz unknown event?",
    todayISO: "2026-03-15",
    todayFormatted: "15 Mar 2026",
    program: "All",
    programLabel: "All Programs",
    primaryGroup: "B",
    secondaryGroup: "A",
    effectiveSessions: ["B-20263"],
    contextSessionIds: ["B-20263"],
    topicRoute: { topics: ["academic_calendar"], hasNamedActivity: false },
    activityMatches: [],
    queryScope: { mentioned: [], relativeId: null, relativeKind: null },
    contextIntent: "all",
    useIntentFilter: true,
    primaryActivities: [],
    sessionListContext: "Session B-20263",
    comparisonContext: "",
    includeSecondary: false,
    secondaryActivitiesCount: 0,
    ...overrides,
  };
}

describe("executeSearchCalendarActivities partial fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-includes calendar excerpt on search miss", async () => {
    const result = await executeChatTool(
      "search_calendar_activities",
      { query: "xyz unknown" },
      baseCtx()
    );
    expect(result).toContain("SEARCH RESULT");
    expect(result).toContain("MOCK CALENDAR ROW");
    expect(result).toContain("Copy dates only from these rows");
  });

  it("returns matched block for alias query when activities exist", async () => {
    const sufo: Activity = {
      name: "Student Feedback Online (SuFO)",
      startDate: "2026-05-01",
      endDate: "2026-05-15",
      type: "registration",
    };
    const { getFilteredActivitiesForSession } = await import("@/lib/chat/context");
    vi.mocked(getFilteredActivitiesForSession).mockReturnValue([sufo]);

    const result = await executeChatTool(
      "search_calendar_activities",
      { query: "SuFO" },
      baseCtx({ message: "SuFO bila?" })
    );
    expect(result).toContain("MATCHED ACTIVITIES");
    expect(result).toContain("SuFO");
  });
});

describe("executeGetTodayStatus", () => {
  it("returns primaryStatus from today API", async () => {
    const result = await executeChatTool("get_today_status", {}, baseCtx());
    expect(result).toContain("TODAY STATUS");
    expect(result).toContain("lecture");
    expect(result).toContain("Kuliah");
  });
});

describe("executeGetPublicHolidayMeta", () => {
  it("returns filter options block", async () => {
    const result = await executeChatTool("get_public_holiday_meta", {}, baseCtx());
    expect(result).toContain("PUBLIC HOLIDAY META");
    expect(result).toContain("selangor");
  });
});
