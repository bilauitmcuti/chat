import { describe, expect, it } from "vitest";
import {
  areSessionListsEqual,
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";

describe("session-memory", () => {
  it("maps Foundation/Professional to group A", () => {
    expect(getGroupFromProgram("Foundation/Professional")).toBe("A");
    expect(getGroupFromProgram("All")).toBe("B");
  });

  it("uses All as session memory key for group B programs", () => {
    expect(getSessionMemoryKey("Diploma")).toBe("All");
    expect(getSessionMemoryKey("Foundation/Professional")).toBe("Foundation/Professional");
  });

  it("filters sessions by group prefix", () => {
    expect(normalizeSessionsForGroup(["A-20251", "B-20263"], "A")).toEqual([]);
    expect(normalizeSessionsForGroup(["A-20251", "B-20263"], "B")).toEqual(["B-20263"]);
  });

  it("compares session lists in order", () => {
    expect(areSessionListsEqual(["A-20251"], ["A-20251"])).toBe(true);
    expect(areSessionListsEqual(["A-20251", "B-20263"], ["B-20263", "A-20251"])).toBe(false);
  });
});
