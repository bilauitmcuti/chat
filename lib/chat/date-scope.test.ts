import { describe, expect, it } from "vitest";
import {
  filterActivitiesByDateScope,
  messageExplicitlyRequestsDateScope,
  parseExplicitDate,
  resolveDateScope,
} from "@/lib/chat/date-scope";
import type { Activity } from "@/lib/data";

const TODAY = "2026-03-15";

const sample: Activity[] = [
  { name: "Pendaftaran", startDate: "2026-03-01", endDate: "2026-03-07", type: "registration" },
  { name: "Kuliah", startDate: "2026-03-08", endDate: "2026-06-14", type: "lecture" },
  { name: "Cuti Pertengahan", startDate: "2026-04-13", endDate: "2026-04-19", type: "break" },
  { name: "Peperiksaan Akhir", startDate: "2026-06-29", endDate: "2026-07-12", type: "examination" },
];

describe("resolveDateScope", () => {
  it("returns day scope for 'today'", () => {
    expect(resolveDateScope("Apa cuti hari ini?", TODAY)).toMatchObject({
      kind: "day",
      startISO: TODAY,
      endISO: TODAY,
    });
  });

  it("returns month scope for named month with intent", () => {
    const scope = resolveDateScope("Senarai aktiviti bulan Mac 2026", TODAY);
    expect(scope?.kind).toBe("month");
    expect(scope?.startISO).toBe("2026-03-01");
    expect(scope?.endISO).toBe("2026-03-31");
  });

  it("returns range scope for month-to-month", () => {
    const scope = resolveDateScope("Kalendar dari Mac hingga Mei 2026", TODAY);
    expect(scope?.kind).toBe("range");
    expect(scope?.startISO).toBe("2026-03-01");
    expect(scope?.endISO).toBe("2026-05-31");
  });

  it("falls back to null when no date context", () => {
    expect(resolveDateScope("Hello there", TODAY)).toBeNull();
  });

  it("does not scope on session id alone", () => {
    expect(resolveDateScope("When is registration for B-20263?", TODAY)).toBeNull();
    expect(messageExplicitlyRequestsDateScope("When is registration for B-20263?")).toBe(
      false
    );
  });

  it("scopes on explicit month list request", () => {
    expect(messageExplicitlyRequestsDateScope("Senarai aktiviti bulan April 2026")).toBe(
      true
    );
  });
});

describe("filterActivitiesByDateScope", () => {
  it("keeps activities overlapping the month", () => {
    const scope = resolveDateScope("Aktiviti bulan April 2026", TODAY)!;
    const filtered = filterActivitiesByDateScope(sample, scope);
    expect(filtered.map((a) => a.name)).toContain("Cuti Pertengahan");
    expect(filtered.map((a) => a.name)).toContain("Kuliah");
    expect(filtered.map((a) => a.name)).not.toContain("Peperiksaan Akhir");
  });
});

describe("parseExplicitDate", () => {
  it("parses DD-MM-YYYY", () => {
    expect(parseExplicitDate("Cuti pada 15-03-2026?", 2026)).toBe("2026-03-15");
  });

  it("parses Malay short month", () => {
    expect(parseExplicitDate("15 Mac 2026", 2026)).toBe("2026-03-15");
  });

  it("parses English month-day", () => {
    expect(parseExplicitDate("March 15, 2026", 2026)).toBe("2026-03-15");
  });
});
