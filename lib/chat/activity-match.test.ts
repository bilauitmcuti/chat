import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/data";
import {
  extractActivityAliases,
  formatClosestActivitiesBlock,
  matchActivitiesInMessage,
  searchActivitiesInMessage,
  HIGH_CONFIDENCE_MATCH_SCORE,
} from "@/lib/chat/activity-match";

const sufoActivity: Activity = {
  name: "Student Feedback Online (SuFO)",
  startDate: "2026-05-01",
  endDate: "2026-05-15",
  type: "registration",
};

const mdsActivity: Activity = {
  name: "Minggu Destini Siswa (MDS)",
  startDate: "2026-03-10",
  endDate: "2026-03-14",
  type: "registration",
};

const yuranActivity: Activity = {
  name: "Bayaran Yuran Pengajian",
  startDate: "2026-04-01",
  endDate: "2026-04-30",
  type: "registration",
};

const rpgtActivity: Activity = {
  name: "Permohonan RPGT (RPGT)",
  startDate: "2026-08-01",
  endDate: "2026-08-15",
  type: "registration",
};

const lecture1: Activity = {
  name: "Lecture 1",
  startDate: "2026-03-01",
  endDate: "2026-03-07",
  type: "lecture",
};

const peperiksaan: Activity = {
  name: "Peperiksaan Akhir",
  startDate: "2026-06-29",
  endDate: "2026-07-12",
  type: "examination",
};

const pool = (activities: Activity[]) =>
  activities.map((activity) => ({ activity, sessionId: "B-20263" as const }));

describe("extractActivityAliases", () => {
  it("extracts parenthetical abbreviations", () => {
    expect(extractActivityAliases("Student Feedback Online (SuFO)")).toEqual(["SuFO"]);
    expect(extractActivityAliases("Minggu Destini Siswa (MDS)")).toEqual(["MDS"]);
  });
});

describe("searchActivitiesInMessage fuzzy", () => {
  it("matches SuFO abbreviation", () => {
    const matches = searchActivitiesInMessage("SuFO — bila perlu siap?", pool([sufoActivity]));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.activity.name).toContain("SuFO");
    expect(matches[0]!.score).toBeGreaterThanOrEqual(HIGH_CONFIDENCE_MATCH_SCORE);
  });

  it("matches MDS abbreviation", () => {
    const matches = searchActivitiesInMessage("MDS bila?", pool([mdsActivity, peperiksaan]));
    expect(matches[0]!.activity.name).toContain("MDS");
  });

  it("matches yuran keyword to fee activity", () => {
    const matches = searchActivitiesInMessage("bila akhir bayar yuran?", pool([yuranActivity, peperiksaan]));
    expect(matches.some((m) => m.activity.name.includes("Yuran"))).toBe(true);
  });

  it("matches RPGT abbreviation", () => {
    const matches = searchActivitiesInMessage("Permohonan RPGT bila?", pool([rpgtActivity]));
    expect(matches[0]!.activity.name).toContain("RPGT");
  });

  it("matches Lecture 1 short name", () => {
    const matches = searchActivitiesInMessage("Lecture 1 bila?", pool([lecture1, peperiksaan]));
    expect(matches[0]!.activity.name).toBe("Lecture 1");
  });
});

describe("matchActivitiesInMessage", () => {
  it("matches exact activity name in bila question", () => {
    const matches = matchActivitiesInMessage("bila Peperiksaan Akhir?", pool([peperiksaan]));
    expect(matches).toHaveLength(1);
    expect(matches[0]!.activity.name).toBe("Peperiksaan Akhir");
  });

  it("does not match unrelated short question", () => {
    const matches = matchActivitiesInMessage("hello", pool([peperiksaan]));
    expect(matches).toHaveLength(0);
  });
});

describe("formatClosestActivitiesBlock", () => {
  it("includes closest matches header", () => {
    const block = formatClosestActivitiesBlock([
      { activity: sufoActivity, sessionId: "B-20263", score: 40 },
    ]);
    expect(block).toContain("CLOSEST MATCHES");
    expect(block).toContain("SuFO");
  });
});
