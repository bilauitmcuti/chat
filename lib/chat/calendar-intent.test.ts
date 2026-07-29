import { describe, expect, it } from "vitest";
import { resolveCalendarContextIntent } from "@/lib/chat/calendar-intent";
import { filterActivitiesByContextIntent } from "@/lib/chat/context";
import { isCalendarQuestion } from "@/lib/chat/intent";
import type { Activity } from "@/lib/data";

const sample: Activity[] = [
  {
    name: "Cuti Pertengahan Semester",
    startDate: "2026-03-15",
    endDate: "2026-03-20",
    type: "break",
    group: "B",
  },
  {
    name: "Peperiksaan Akhir",
    startDate: "2026-06-01",
    type: "examination",
    group: "B",
  },
  {
    name: "Minggu Kuliah 1",
    startDate: "2026-02-01",
    type: "lecture",
    group: "B",
  },
];

describe("resolveCalendarContextIntent", () => {
  it("detects break intent", () => {
    expect(resolveCalendarContextIntent("When is the next break?")).toBe("break");
  });

  it("detects days until intent", () => {
    expect(resolveCalendarContextIntent("How many days until semester break?")).toBe(
      "days_until"
    );
  });

  it("returns all for study fee questions", () => {
    expect(resolveCalendarContextIntent("Berapa yuran pengajian diploma?")).toBe("all");
  });

  it("returns fee for calendar payment deadlines", () => {
    expect(resolveCalendarContextIntent("Bila tarikh akhir bayar yuran GT?")).toBe("fee");
  });

  it("returns fee for Online Fee Deferment wording", () => {
    expect(
      resolveCalendarContextIntent(
        "Bila tempoh permohonan penangguhan pembayaran yuran via Online Fee Deferment?"
      )
    ).toBe("fee");
  });
});

describe("isCalendarQuestion", () => {
  it("routes fee deferment tempoh questions to calendar", () => {
    expect(
      isCalendarQuestion(
        "Bila tempoh permohonan penangguhan pembayaran yuran via Online Fee Deferment?"
      )
    ).toBe(true);
  });

  it("routes related fee deferment dates to calendar", () => {
    expect(isCalendarQuestion("Ada tarikh berkaitan Fee Deferment?")).toBe(true);
  });
});

describe("filterActivitiesByContextIntent", () => {
  it("filters to breaks only", () => {
    const filtered = filterActivitiesByContextIntent(sample, "break");
    expect(filtered.every((a) => a.type === "break" || a.name.toLowerCase().includes("cuti"))).toBe(
      true
    );
  });

  it("filters fee intent to penangguhan rows", () => {
    const feeRows: Activity[] = [
      {
        name: "Tarikh Akhir Keputusan Permohonan Penangguhan Pembayaran Yuran",
        startDate: "2026-04-27",
        type: "registration",
        group: "B",
      },
      { name: "Cuti Pertengahan Semester", startDate: "2026-03-15", type: "break", group: "B" },
    ];
    const filtered = filterActivitiesByContextIntent(feeRows, "fee");
    expect(filtered.some((a) => a.name.toLowerCase().includes("penangguhan"))).toBe(true);
    expect(filtered.every((a) => a.type === "break")).toBe(false);
  });
});
