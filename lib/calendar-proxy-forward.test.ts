import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { buildForwardedSearch, calendarProxyForward } from "@/lib/calendar-proxy-forward";

describe("calendar-proxy-forward", () => {
  it("whitelists meta query keys and ignores unknown params", () => {
    const request = new NextRequest("http://localhost/api/v1/meta?group=A&_rsc=1");
    expect(buildForwardedSearch("v1/meta", request)).toBe("?group=A");
  });

  it("rejects invalid meta group", () => {
    const request = new NextRequest("http://localhost/api/v1/meta?group=Z");
    expect(buildForwardedSearch("v1/meta", request)).toBe("__invalid__");
  });

  it("whitelists calendar query keys", () => {
    const request = new NextRequest(
      "http://localhost/api/v1/calendar?session=B-20263&program=Diploma&foo=bar"
    );
    expect(buildForwardedSearch("v1/calendar", request)).toBe("?session=B-20263&program=Diploma");
  });

  it("normalizes boolean allSessions query", () => {
    const request = new NextRequest("http://localhost/api/v1/calendar?allSessions=yes");
    expect(buildForwardedSearch("v1/calendar", request)).toBe("?allSessions=true");
  });

  it("whitelists public-holiday query keys", () => {
    const request = new NextRequest(
      "http://localhost/api/v1/public-holiday?coverage=all&year=2026&foo=bar"
    );
    expect(buildForwardedSearch("v1/public-holiday", request)).toBe("?coverage=all&year=2026");
  });

  it("rejects invalid public-holiday coverage", () => {
    const request = new NextRequest("http://localhost/api/v1/public-holiday?coverage=state");
    expect(buildForwardedSearch("v1/public-holiday", request)).toBe("__invalid__");
  });
});

describe("calendarProxyForward lecture week enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges lectureWeekByDate into calendar responses with session", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/v1/calendar")) {
        return new Response(
          JSON.stringify({
            activities: [{ name: "Kuliah", startDate: "2026-01-05", type: "lecture" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/lecture-weeks")) {
        return new Response(
          JSON.stringify({
            weeks: [
              {
                weekNumber: 1,
                weekStart: "2026-01-05",
                weekEnd: "2026-01-11",
                rangeLabel: "Week 1",
                days: [{ date: "2026-01-05", weekday: "Mon", label: "Mon" }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "http://localhost/api/v1/calendar?session=B-20263&group=B&program=All"
    );
    const response = await calendarProxyForward(request, "v1/calendar");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      activities: unknown[];
      lectureWeekByDate?: Record<string, number>;
    };
    expect(body.activities).toHaveLength(1);
    expect(body.lectureWeekByDate).toEqual({ "2026-01-05": 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
