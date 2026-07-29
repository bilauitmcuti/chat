import { describe, expect, it } from "vitest";
import type { FilterStates } from "@/lib/cookie-utils";
import { DEFAULT_FILTER_STATES } from "@/lib/data";
import {
  applyFilterKeysToFilters,
  buildCalendarQueryString,
  buildFilterQueryString,
  filtersToQueryKeys,
  hasFilterQueryParams,
  isFilterQueryKey,
  parseFilterKeysFromSearchParams,
} from "./filter-query";

const baseFilters: FilterStates = {
  ...DEFAULT_FILTER_STATES,
  sessionId: "B-20263",
  sessionIds: ["B-20263"],
};

describe("filter query helpers", () => {
  it("recognizes known bare filter keys", () => {
    expect(isFilterQueryKey("lecture")).toBe(true);
    expect(isFilterQueryKey("short-sem")).toBe(true);
    expect(isFilterQueryKey("other-exam")).toBe(true);
    expect(isFilterQueryKey("states")).toBe(true);
    expect(isFilterQueryKey("B-20263")).toBe(false);
    expect(isFilterQueryKey("countdown")).toBe(false);
  });

  it("parses bare filter keys and ignores unknown / session keys", () => {
    const params = new URLSearchParams("B-20263&lecture&exam&break&unknown&short-sem");
    expect(parseFilterKeysFromSearchParams(params)).toEqual([
      "lecture",
      "exam",
      "break",
      "short-sem",
    ]);
    expect(hasFilterQueryParams(params)).toBe(true);
    expect(hasFilterQueryParams(new URLSearchParams("B-20263"))).toBe(false);
  });

  it("applies whitelist mode and preserves countdown", () => {
    const existing: FilterStates = {
      ...baseFilters,
      showRegistration: true,
      showLecture: true,
      showExamination: true,
      showBreak: true,
      showCountdown: false,
      showKKT: false,
    };
    const next = applyFilterKeysToFilters(existing, ["lecture", "short-sem", "states"]);
    expect(next).toMatchObject({
      showRegistration: false,
      showLecture: true,
      showSemesterPendek: true,
      showKuliahIntersesi: false,
      showExamination: false,
      showOthersExams: false,
      showBreak: false,
      showKKT: true,
      showCountdown: false,
      sessionIds: ["B-20263"],
    });
  });

  it("returns existing when keys empty", () => {
    expect(applyFilterKeysToFilters(baseFilters, [])).toBe(baseFilters);
  });

  it("builds filter query string and reverse-maps toggles", () => {
    expect(buildFilterQueryString(["lecture", "exam", "break", "lecture"])).toBe(
      "lecture&exam&break"
    );
    expect(
      filtersToQueryKeys({
        showRegistration: false,
        showLecture: true,
        showSemesterPendek: true,
        showKuliahIntersesi: false,
        showExamination: true,
        showOthersExams: false,
        showBreak: false,
        showKKT: true,
      })
    ).toEqual(["lecture", "short-sem", "exam", "states"]);
  });

  it("combines session and filter keys", () => {
    expect(
      buildCalendarQueryString({
        sessionIds: ["B-20263"],
        filterKeys: ["lecture", "exam"],
      })
    ).toBe("B-20263&lecture&exam");
    expect(buildCalendarQueryString({ filterKeys: ["states"] })).toBe("states");
    expect(buildCalendarQueryString({ sessionIds: ["B-20263"] })).toBe("B-20263");
    expect(buildCalendarQueryString({})).toBe("");
  });
});
