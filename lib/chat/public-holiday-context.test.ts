import { describe, expect, it, vi } from "vitest";
import * as data from "@/lib/data";
import {
  formatPublicHolidayBlock,
  formatPublicHolidayLine,
  getPublicHolidayUnderstandingDirective,
  needsPublicHolidayContext,
  parseDateFromMessage,
  parseDateRangeFromMessage,
  resolvePrimaryPublicHolidayYear,
  resolvePublicHolidayQueryIntent,
  resolvePublicHolidayYears,
  resolveStateSlugFromMessage,
  resolveStateSlugsFromMessage,
} from "./public-holiday-context";
import type { PublicHolidaysResponse } from "@/lib/calendar-api";
import type { PublicHolidayRow } from "@/lib/calendar-api";

const sampleHoliday: PublicHolidayRow = {
  id: "cny",
  name: "Chinese New Year",
  date: "2026-02-17",
  day: "Tuesday",
  states: ["selangor", "johor"],
  isSubjectToChange: false,
};

describe("needsPublicHolidayContext", () => {
  it("detects public holiday phrasing", () => {
    expect(needsPublicHolidayContext("Is 17 Feb a public holiday in Selangor?")).toBe(true);
    expect(needsPublicHolidayContext("Cuti umum Malaysia ada dalam kalendar UiTM tak?")).toBe(
      true
    );
  });

  it("ignores generic semester break without public-holiday cues", () => {
    expect(needsPublicHolidayContext("When is mid semester break?")).toBe(false);
  });
});

describe("resolveStateSlugFromMessage", () => {
  it("maps state names to API slugs", () => {
    expect(resolveStateSlugFromMessage("public holiday in Selangor")).toBe("selangor");
    expect(resolveStateSlugFromMessage("cuti di Pulau Pinang")).toBe("pulau-pinang");
  });
});

describe("parseDateFromMessage", () => {
  it("parses day-month with default year", () => {
    expect(parseDateFromMessage("holiday on 17 feb", 2026)).toBe("2026-02-17");
  });

  it("parses ISO dates", () => {
    expect(parseDateFromMessage("on 2026-03-21", 2026)).toBe("2026-03-21");
  });
});

describe("parseDateRangeFromMessage", () => {
  it("parses this month until december", () => {
    const range = parseDateRangeFromMessage(
      "List public holiday for Selangor starting this month until december",
      "2026-05-25",
      2026
    );
    expect(range.start).toBe("2026-05-01");
    expect(range.end).toBe("2026-12-31");
  });
});

describe("resolvePublicHolidayYears", () => {
  it("includes explicit year from the message", () => {
    expect(resolvePublicHolidayYears("cuti umum 2027", "2026-06-01")).toEqual([2027]);
  });

  it("includes both years when session label spans 2026 and 2027", () => {
    vi.spyOn(data, "getSessionOptions").mockReturnValue([
      { id: "A-20272", label: "Group A: Sep 2026 - Feb 2027", group: "A" },
    ]);
    vi.spyOn(data, "getSessionActivityDateRange").mockReturnValue(null);
    expect(
      resolvePublicHolidayYears("senarai cuti umum", "2026-09-01", ["A-20272"])
    ).toEqual([2026, 2027]);
    vi.restoreAllMocks();
  });

  it("adds next calendar year for upcoming-only questions near year end", () => {
    expect(
      resolvePublicHolidayYears("next public holiday in Selangor", "2026-11-15")
    ).toEqual([2026, 2027]);
  });

  it("uses today year when no year or session hint", () => {
    expect(resolvePublicHolidayYears("cuti umum Selangor", "2026-03-01")).toEqual([2026]);
  });
});

describe("resolvePrimaryPublicHolidayYear", () => {
  it("prefers explicit message year", () => {
    expect(resolvePrimaryPublicHolidayYear([2026, 2027], "holidays 2027", "2026-03-01")).toBe(
      2027
    );
  });

  it("uses today year when it is in the resolved set", () => {
    expect(resolvePrimaryPublicHolidayYear([2026, 2027], "cuti umum", "2026-09-01")).toBe(2026);
  });
});

describe("resolvePublicHolidayQueryIntent", () => {
  it("detects Selangor list with period", () => {
    const intent = resolvePublicHolidayQueryIntent(
      "List public holiday for Selangor starting this month until december",
      "2026-05-25",
      2026
    );
    expect(intent.stateSlug).toBe("selangor");
    expect(intent.stateSlugs).toEqual(["selangor"]);
    expect(intent.wantsList).toBe(true);
    expect(intent.rangeStartISO).toBe("2026-05-01");
    expect(intent.rangeEndISO).toBe("2026-12-31");
  });
});

describe("getPublicHolidayUnderstandingDirective", () => {
  it("scopes any single state and period (Selangor example)", () => {
    const d = getPublicHolidayUnderstandingDirective(
      "List public holiday for Selangor starting this month until december",
      "2026-05-25",
      2026
    );
    expect(d).toContain("Selangor");
    expect(d).toMatch(/KKT/i);
    expect(d).toContain("01-05-2026");
    expect(d).toContain("31-12-2026");
  });

  it("scopes Johor public holiday lists", () => {
    const d = getPublicHolidayUnderstandingDirective(
      "List public holidays in Johor for 2026",
      "2026-03-01",
      2026
    );
    expect(d).toContain("Johor");
    expect(d).not.toContain("Selangor");
  });

  it("scopes Kedah without UiTM KKT list format", () => {
    const d = getPublicHolidayUnderstandingDirective(
      "Senarai cuti umum Kedah bulan ini hingga disember",
      "2026-05-25",
      2026
    );
    expect(d).toContain("Kedah");
    expect(d).toMatch(/semester calendar|KKT/i);
  });
});

describe("resolveStateSlugsFromMessage", () => {
  it("detects multiple states when named", () => {
    expect(
      resolveStateSlugsFromMessage("public holidays in Kedah and Kelantan")
    ).toEqual(["kedah", "kelantan"]);
  });
});

describe("formatPublicHolidayBlock", () => {
  it("lists holidays oldest to newest for full list requests", () => {
    const data: PublicHolidaysResponse = {
      defaultYear: 2026,
      year: 2026,
      total: 2,
      holidays: [
        {
          id: "xmas",
          name: "Christmas",
          date: "2026-12-25",
          day: "Friday",
          states: ["selangor"],
          isSubjectToChange: false,
        },
        {
          id: "ny",
          name: "New Year",
          date: "2026-01-01",
          day: "Thursday",
          states: ["selangor"],
          isSubjectToChange: false,
        },
      ],
    };
    const block = formatPublicHolidayBlock(
      data,
      "senarai cuti umum Selangor 2026",
      "2026-06-01"
    );
    expect(block.indexOf("01-01-2026")).toBeLessThan(block.indexOf("25-12-2026"));
  });

  it("filters Johor holidays by date range", () => {
    const data: PublicHolidaysResponse = {
      defaultYear: 2026,
      year: 2026,
      total: 2,
      holidays: [
        {
          id: "jan",
          name: "New Year",
          date: "2026-01-01",
          day: "Thu",
          states: ["johor"],
          isSubjectToChange: false,
        },
        {
          id: "cny",
          name: "Chinese New Year",
          date: "2026-02-17",
          day: "Tue",
          states: ["johor"],
          isSubjectToChange: false,
        },
      ],
    };
    const block = formatPublicHolidayBlock(
      data,
      "list public holidays Johor from February to April 2026",
      "2026-05-25"
    );
    expect(block).toContain("Johor");
    expect(block).toContain("Chinese New Year");
    expect(block).not.toMatch(/- New Year:/);
  });

  it("includes interpretation and Selangor May–Dec rows only", () => {
    const data: PublicHolidaysResponse = {
      defaultYear: 2026,
      year: 2026,
      total: 3,
      holidays: [
        {
          id: "jan",
          name: "New Year",
          date: "2026-01-01",
          day: "Thu",
          states: ["selangor"],
          isSubjectToChange: false,
        },
        {
          id: "may",
          name: "Labour Day",
          date: "2026-05-01",
          day: "Fri",
          states: ["selangor"],
          isSubjectToChange: false,
        },
        {
          id: "dec",
          name: "Christmas",
          date: "2026-12-25",
          day: "Fri",
          states: ["selangor"],
          isSubjectToChange: false,
        },
      ],
    };
    const block = formatPublicHolidayBlock(
      data,
      "List public holiday for Selangor starting this month until december",
      "2026-05-25"
    );
    expect(block).toContain("USER QUESTION INTERPRETATION");
    expect(block).toContain("Selangor");
    expect(block).toContain("Labour Day");
    expect(block).toContain("Christmas");
    expect(block).not.toMatch(/- New Year:/);
    expect(block).toContain("Do not use Kedah/Kelantan/Terengganu (KKT) headings");
  });
});

describe("formatPublicHolidayLine", () => {
  it("omits yes/no scope when state is already filtered", () => {
    const line = formatPublicHolidayLine(sampleHoliday, "selangor");
    expect(line).toContain("Chinese New Year");
    expect(line).toContain("17-02-2026");
    expect(line).not.toMatch(/yes in|not in/i);
  });

  it("shows human state names only for regional rows without state filter", () => {
    const line = formatPublicHolidayLine(sampleHoliday, null);
    expect(line).toContain("Johor, Selangor");
    expect(line).not.toMatch(/yes in/i);
  });
});
