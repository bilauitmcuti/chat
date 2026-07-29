import { describe, expect, it } from "vitest";
import { shouldIncludeActivity, type Activity } from "./data";

const lecture: Activity = {
  name: "Kuliah",
  startDate: "2026-03-01",
  endDate: "2026-06-01",
  type: "lecture",
  group: "B",
};

const shortSem: Activity = {
  name: "Short Semester",
  startDate: "2026-07-01",
  endDate: "2026-08-01",
  type: "lecture",
  group: "B",
};

const intersession: Activity = {
  name: "Intersession Classes",
  startDate: "2026-07-01",
  endDate: "2026-08-01",
  type: "lecture",
  group: "B",
};

const exam: Activity = {
  name: "Peperiksaan Akhir",
  startDate: "2026-06-10",
  endDate: "2026-06-20",
  type: "examination",
  group: "B",
};

const otherExam: Activity = {
  name: "Peperiksaan Khas",
  startDate: "2026-08-01",
  endDate: "2026-08-05",
  type: "examination",
  group: "B",
};

describe("shouldIncludeActivity submenu independence", () => {
  it("shows short-sem when lecture is off but short-sem is on", () => {
    const filters = {
      selectedProgram: "All",
      showLecture: false,
      showSemesterPendek: true,
      showKuliahIntersesi: false,
    };
    expect(shouldIncludeActivity(shortSem, filters)).toBe(true);
    expect(shouldIncludeActivity(lecture, filters)).toBe(false);
    expect(shouldIncludeActivity(intersession, filters)).toBe(false);
  });

  it("shows intersession when lecture is off but intersession is on", () => {
    const filters = {
      selectedProgram: "All",
      showLecture: false,
      showSemesterPendek: false,
      showKuliahIntersesi: true,
    };
    expect(shouldIncludeActivity(intersession, filters)).toBe(true);
    expect(shouldIncludeActivity(lecture, filters)).toBe(false);
  });

  it("hides short-sem when lecture is on but short-sem is off", () => {
    expect(
      shouldIncludeActivity(shortSem, {
        selectedProgram: "All",
        showLecture: true,
        showSemesterPendek: false,
      })
    ).toBe(false);
  });

  it("shows other-exam when examination is off but other-exam is on", () => {
    const filters = {
      selectedProgram: "All",
      showExamination: false,
      showOthersExams: true,
    };
    expect(shouldIncludeActivity(otherExam, filters)).toBe(true);
    expect(shouldIncludeActivity(exam, filters)).toBe(false);
  });

  it("hides other-exam when examination is on but other-exam is off", () => {
    expect(
      shouldIncludeActivity(otherExam, {
        selectedProgram: "All",
        showExamination: true,
        showOthersExams: false,
      })
    ).toBe(false);
  });
});
