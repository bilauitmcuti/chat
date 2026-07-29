import { afterEach, describe, expect, it, vi } from "vitest";

function calendarActivityResponse(sessionId: string) {
  return new Response(
    JSON.stringify({
      activities: [
        {
          name: `Activity for ${sessionId}`,
          startDate: "2026-01-01",
          endDate: "2026-01-01",
          type: "lecture",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function lectureWeeksResponse() {
  return new Response(JSON.stringify({ weeks: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetchMock() {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/v1/calendar")) return calendarActivityResponse(new URL(url).searchParams.get("session") ?? "");
    if (url.includes("/api/v1/lecture-weeks")) return lectureWeeksResponse();
    if (url.includes("/api/v1/public-holiday")) {
      const year = new URL(url).searchParams.get("year") ?? "2026";
      return new Response(
        JSON.stringify({
          defaultYear: Number(year),
          holidays: [
            {
              id: `ph-${year}`,
              name: "Hari Merdeka",
              date: `${year}-08-31`,
              day: "Monday",
              states: ["all"],
              isSubjectToChange: false,
            },
          ],
          query: { year: Number(year) },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("not found", { status: 404 });
  });
}

const TEST_META = {
  defaultSession: { A: "A-20261", B: "B-20263" },
  sessionOptions: [
    { id: "A-20261", label: "Group A S1", group: "A" as const },
    { id: "B-20263", label: "Group B S1", group: "B" as const },
    { id: "B-20264", label: "Group B S2", group: "B" as const },
  ],
  programOptions: [{ value: "All", label: "All Programs", group: "B" as const }],
};

describe("chat calendar load per session", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loadActivitiesIntoStoreForChat fetches each selected B session", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { setMeta } = await import("@/lib/calendar-store");
    setMeta(TEST_META);

    const { loadActivitiesIntoStoreForChat } = await import("@/lib/chat-calendar-load");
    await loadActivitiesIntoStoreForChat("All", "B", ["B-20263", "B-20264"]);

    const calendarUrls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes("/api/v1/calendar"));
    expect(calendarUrls.some((u) => u.includes("session=B-20263"))).toBe(true);
    expect(calendarUrls.some((u) => u.includes("session=B-20264"))).toBe(true);
  });

  it("different selectedSessions trigger different calendar upstream URLs", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { setMeta } = await import("@/lib/calendar-store");
    setMeta(TEST_META);

    const { loadActivitiesIntoStoreForChat } = await import("@/lib/chat-calendar-load");

    await loadActivitiesIntoStoreForChat("All", "B", ["B-20263"]);
    const firstBatch = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes("/api/v1/calendar"));

    fetchMock.mockClear();

    await loadActivitiesIntoStoreForChat("All", "B", ["B-20264"]);
    const secondBatch = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes("/api/v1/calendar"));

    expect(firstBatch.some((u) => u.includes("session=B-20263"))).toBe(true);
    expect(secondBatch.some((u) => u.includes("session=B-20264"))).toBe(true);
    expect(secondBatch.some((u) => u.includes("session=B-20263"))).toBe(false);
  });

  it("buildPublicHolidayChatContext fetches public-holiday API for resolved year", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { setMeta } = await import("@/lib/calendar-store");
    setMeta(TEST_META);

    const { buildPublicHolidayChatContext } = await import(
      "@/lib/chat/public-holiday-context"
    );
    const ctx = await buildPublicHolidayChatContext(
      "Senarai cuti umum 2026",
      "2026-03-15",
      { sessionIds: ["B-20263"] }
    );

    expect(ctx.block).toContain("Hari Merdeka");
    const holidayUrls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes("/api/v1/public-holiday"));
    expect(holidayUrls.some((u) => u.includes("year=2026"))).toBe(true);
    expect(holidayUrls.some((u) => u.includes("coverage=all"))).toBe(true);
  });
});
