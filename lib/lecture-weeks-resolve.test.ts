import { describe, expect, it } from "vitest";
import { resolveLectureWeekMapForSessions } from "./lecture-weeks-resolve";

describe("resolveLectureWeekMapForSessions", () => {
  const lectureWeekBySession = {
    "B-20272": { "2026-07-08": 14 },
    "B-20263": { "2026-07-08": 3 },
  };

  it("merges only selected sessions", () => {
    const map = resolveLectureWeekMapForSessions({
      lectureWeekBySession,
      selectedSessions: ["B-20272"],
    });
    expect(map?.get("2026-07-08")).toBe(14);
  });

  it("returns null when selected sessions have no lecture weeks", () => {
    const map = resolveLectureWeekMapForSessions({
      lectureWeekBySession,
      selectedSessions: ["B-20999"],
    });
    expect(map).toBeNull();
  });

  it("does not fall back to initial data after store has session weeks", () => {
    const map = resolveLectureWeekMapForSessions({
      lectureWeekBySession,
      selectedSessions: ["B-20999"],
      initialLectureWeekByDate: { "2026-07-08": 14 },
    });
    expect(map).toBeNull();
  });
});
