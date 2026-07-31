import { describe, expect, it } from "vitest";
import {
  getRandomSuggestions,
  SUGGESTIONS_GENERAL,
  SUGGESTIONS_GROUP_A,
  SUGGESTIONS_GROUP_B,
} from "@/components/chat/suggestion-data";
import { isCalendarQuestion } from "@/lib/chat/intent";

describe("suggestion pools", () => {
  it("Group A has 18 questions", () => {
    expect(SUGGESTIONS_GROUP_A).toHaveLength(18);
  });

  it("Group B has 18 questions", () => {
    expect(SUGGESTIONS_GROUP_B).toHaveLength(18);
  });

  it("Group A/B avoid festival-specific cuti chips", () => {
    const festival = /aidil|fitri|raya|krismas|christmas|tahun baharu|perayaan|cuti khas/i;
    for (const q of [...SUGGESTIONS_GROUP_A, ...SUGGESTIONS_GROUP_B]) {
      expect(q, q).not.toMatch(festival);
    }
  });

  it("has general UiTM questions covering new tools and modes", () => {
    expect(SUGGESTIONS_GENERAL.length).toBeGreaterThanOrEqual(9);
    expect(
      SUGGESTIONS_GENERAL.some((q) => /minggu kuliah|week/i.test(q))
    ).toBe(true);
    expect(SUGGESTIONS_GENERAL.some((q) => /cuti umum/i.test(q))).toBe(true);
    expect(SUGGESTIONS_GENERAL.some((q) => /rancang|pelan/i.test(q))).toBe(
      true
    );
    expect(SUGGESTIONS_GENERAL.some((q) => /maksud|terangkan/i.test(q))).toBe(
      true
    );
  });

  it("every Group A suggestion routes to the calendar prompt", () => {
    for (const q of SUGGESTIONS_GROUP_A) {
      expect(isCalendarQuestion(q), q).toBe(true);
    }
  });

  it("every Group B suggestion routes to the calendar prompt", () => {
    for (const q of SUGGESTIONS_GROUP_B) {
      expect(isCalendarQuestion(q), q).toBe(true);
    }
  });
});

const DISPLAY_COUNT = 8;

describe("getRandomSuggestions", () => {
  it("returns 8 suggestions for Group A", () => {
    const picks = getRandomSuggestions("A", []);
    expect(picks).toHaveLength(DISPLAY_COUNT);
    const allowed = [...SUGGESTIONS_GROUP_A, ...SUGGESTIONS_GENERAL];
    expect(picks.every((s) => allowed.includes(s))).toBe(true);
  });

  it("returns 8 suggestions for Group B", () => {
    const picks = getRandomSuggestions("B", []);
    expect(picks).toHaveLength(DISPLAY_COUNT);
    const allowed = [...SUGGESTIONS_GROUP_B, ...SUGGESTIONS_GENERAL];
    expect(picks.every((s) => allowed.includes(s))).toBe(true);
  });

  it("includes at least one general question for Group A", () => {
    const picks = getRandomSuggestions("A", []);
    expect(picks.some((s) => SUGGESTIONS_GENERAL.includes(s))).toBe(true);
  });

  it("includes at least one general question for Group B", () => {
    const picks = getRandomSuggestions("B", []);
    expect(picks.some((s) => SUGGESTIONS_GENERAL.includes(s))).toBe(true);
  });
});
