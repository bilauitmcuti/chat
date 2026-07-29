import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  areProgramSessionMapsEqual,
  isChatSelectionInSyncWithHomepage,
  mergeSessionMapsFromHomepage,
  persistChatProgramSessions,
  type ChatHomepageHydration,
} from "@/lib/chat/session-state";
import type { FilterStates } from "@/lib/cookie-utils";
import type { ProgramValue } from "@/lib/route-utils";

vi.mock("@/lib/cookie-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cookie-utils")>();
  return {
    ...actual,
    getFiltersFromCookie: vi.fn(() => ({
      showKKT: true,
      showRegistration: true,
      showLecture: true,
      showSemesterPendek: true,
      showKuliahIntersesi: true,
      showExamination: true,
      showOthersExams: true,
      showBreak: true,
      showCountdown: true,
      selectedProgram: "All" as ProgramValue,
      sessionIds: ["B-20263"],
      sessionId: "B-20263",
    })),
    setFiltersToCookie: vi.fn(),
  };
});

import { getFiltersFromCookie, setFiltersToCookie } from "@/lib/cookie-utils";

describe("areProgramSessionMapsEqual", () => {
  it("treats missing keys as empty lists", () => {
    expect(
      areProgramSessionMapsEqual(
        { All: ["B-20263"] },
        { All: ["B-20263"], "Foundation/Professional": [] }
      )
    ).toBe(true);
  });

  it("detects order-sensitive list mismatches", () => {
    expect(
      areProgramSessionMapsEqual(
        { All: ["B-20263", "B-20262"] },
        { All: ["B-20262", "B-20263"] }
      )
    ).toBe(false);
  });
});

describe("isChatSelectionInSyncWithHomepage", () => {
  it("is true when program, sessions, and map match", () => {
    const current: ChatHomepageHydration = {
      program: "Bachelor",
      selectedSessions: ["B-20263"],
      sessionsByProgram: { All: ["B-20263"] },
    };
    expect(isChatSelectionInSyncWithHomepage(current, { ...current })).toBe(true);
  });

  it("is false when program differs", () => {
    const base = {
      selectedSessions: ["B-20263"] as ChatHomepageHydration["selectedSessions"],
      sessionsByProgram: { All: ["B-20263"] },
    };
    expect(
      isChatSelectionInSyncWithHomepage(
        { ...base, program: "Bachelor" },
        { ...base, program: "Diploma" }
      )
    ).toBe(false);
  });
});

describe("mergeSessionMapsFromHomepage", () => {
  it("lets cookie overwrite overlapping local keys", () => {
    const filters = {
      sessionIdsByProgram: { All: ["B-20262"] },
    } as FilterStates;
    const merged = mergeSessionMapsFromHomepage({ All: ["B-20263"] }, filters);
    expect(merged.All).toEqual(["B-20262"]);
  });
});

describe("persistChatProgramSessions", () => {
  const setItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const localStorageMock = {
      getItem: vi.fn(),
      setItem,
      removeItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes localStorage and merges filter toggles into the cookie", () => {
    persistChatProgramSessions({
      program: "Bachelor",
      sessionsByProgram: { All: ["B-20263", "B-20262"] },
      selectedSessions: ["B-20263", "B-20262"],
    });

    expect(setItem).toHaveBeenCalledWith("selectedProgram", "Bachelor");
    expect(setItem).toHaveBeenCalledWith(
      "sessionIdsByProgram",
      JSON.stringify({ All: ["B-20263", "B-20262"] })
    );
    expect(getFiltersFromCookie).toHaveBeenCalled();
    expect(setFiltersToCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        showKKT: true,
        selectedProgram: "Bachelor",
        sessionId: "B-20263",
        sessionIds: ["B-20263", "B-20262"],
        sessionIdsByProgram: { All: ["B-20263", "B-20262"] },
      })
    );
  });

  it("skips empty selectedSessions", () => {
    persistChatProgramSessions({
      program: "Bachelor",
      sessionsByProgram: { All: ["B-20263"] },
      selectedSessions: [],
    });
    expect(setFiltersToCookie).not.toHaveBeenCalled();
  });
});
