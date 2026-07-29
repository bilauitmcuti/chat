import { describe, expect, it } from "vitest";
import {
  buildCalendarAbsoluteUrl,
  buildCalendarUrlPath,
  buildSessionQueryString,
  parseSessionIdsFromSearchParams,
  resolveCleanCalendarPath,
  resolveProgramForSessionQuery,
} from "./session-query";

describe("session query URL helpers", () => {
  it("builds bare session query keys", () => {
    expect(buildSessionQueryString(["B-20263", "A-20251"])).toBe("B-20263&A-20251");
    expect(buildSessionQueryString([])).toBe("");
  });

  it("builds calendar paths with session query", () => {
    expect(buildCalendarUrlPath("/diploma", ["B-20263"])).toBe("/diploma?B-20263");
    expect(buildCalendarUrlPath("/list", ["B-20263"])).toBe("/list?B-20263");
    expect(buildCalendarUrlPath("/", ["B-20263"])).toBe("/?B-20263");
    expect(buildCalendarUrlPath("/diploma", [])).toBe("/diploma");
  });

  it("builds calendar paths with session and filter query keys", () => {
    expect(buildCalendarUrlPath("/diploma", ["B-20263"], ["lecture", "exam"])).toBe(
      "/diploma?B-20263&lecture&exam"
    );
    expect(buildCalendarUrlPath("/diploma", [], ["short-sem", "states"])).toBe(
      "/diploma?short-sem&states"
    );
  });

  it("builds absolute og/share URLs", () => {
    expect(buildCalendarAbsoluteUrl("/diploma", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/diploma?B-20263"
    );
    expect(buildCalendarAbsoluteUrl("/diploma/list", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/diploma/list?B-20263"
    );
    expect(buildCalendarAbsoluteUrl("/", [])).toBe("https://bilauitmcuti.com");
    expect(buildCalendarAbsoluteUrl("/", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/?B-20263"
    );
  });

  it("round-trips session ids from search params and ignores unknown Group A ids", () => {
    const params = new URLSearchParams("B-20263&A-20251");
    expect(parseSessionIdsFromSearchParams(params)).toEqual(["B-20263"]);
  });

  it("homepage session query ignores cookie Foundation and uses All for Group B", () => {
    expect(
      resolveProgramForSessionQuery("/", ["B-20263"], "Foundation/Professional")
    ).toBe("All");
    expect(resolveProgramForSessionQuery("/list", ["B-20263"], "Foundation/Professional")).toBe(
      "All"
    );
  });

  it("homepage session query ignores unknown Group A session ids", () => {
    expect(resolveProgramForSessionQuery("/", ["A-20251"], "All")).toBe("All");
  });

  it("program route wins over cookie for session query", () => {
    expect(
      resolveProgramForSessionQuery("/diploma", ["B-20263"], "Foundation/Professional")
    ).toBe("Diploma");
  });

  it("resolves clean calendar path for program routes", () => {
    expect(
      resolveCleanCalendarPath("/", "Foundation/Professional", "grid")
    ).toBe("/foundation-professional");
    expect(resolveCleanCalendarPath("/", "All", "grid")).toBe("/");
  });
});
