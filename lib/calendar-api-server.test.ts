import { afterEach, describe, expect, it, vi } from "vitest";

describe("fetchPublicHolidays (server upstream)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("fetches from upstream v1/public-holiday and parses holidays", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/api/v1/public-holiday?");
      expect(url).toContain("coverage=all");
      expect(url).toContain("year=2026");
      return new Response(
        JSON.stringify({
          defaultYear: 2026,
          holidays: [
            {
              id: "ph-1",
              name: "Hari Merdeka",
              date: "2026-08-31",
              day: "Monday",
              states: ["all"],
              isSubjectToChange: false,
            },
          ],
          query: { year: 2026 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchPublicHolidays } = await import("@/lib/calendar-api-server");
    const result = await fetchPublicHolidays({ coverage: "all", year: 2026 });

    expect(result.year).toBe(2026);
    expect(result.holidays).toHaveLength(1);
    expect(result.holidays[0]?.name).toBe("Hari Merdeka");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
