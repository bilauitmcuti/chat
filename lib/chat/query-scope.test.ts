import { describe, expect, it } from "vitest";
import {
  buildQueryScopeBlock,
  detectRelativeSession,
  extractMentionedSessionIds,
  mergeSessionsForLoad,
  resolveQueryScope,
  type ResolvedQueryScope,
} from "@/lib/chat/query-scope";

const validIds = new Set(["A-20264", "A-20272", "B-20262", "B-20263", "B-20264"]);

describe("extractMentionedSessionIds", () => {
  it("finds explicit session ids with dash", () => {
    expect(extractMentionedSessionIds("Compare B-20263 and B-20264", validIds)).toEqual([
      "B-20263",
      "B-20264",
    ]);
  });

  it("handles @mention without dash", () => {
    expect(extractMentionedSessionIds("Tarikh @B20263 bila?", validIds)).toEqual(["B-20263"]);
  });

  it("ignores ids not in meta", () => {
    expect(extractMentionedSessionIds("What about B-99999?", validIds)).toEqual([]);
  });
});

describe("detectRelativeSession", () => {
  it("detects Malay next session phrases", () => {
    expect(detectRelativeSession("Bila pendaftaran semester depan?")).toBe("next");
    expect(detectRelativeSession("Sesi seterusnya bila mula?")).toBe("next");
  });

  it("detects previous and current session phrases", () => {
    expect(detectRelativeSession("Cuti semester lepas")).toBe("previous");
    expect(detectRelativeSession("Semester ini bila habis?")).toBe("current");
  });

  it("returns null when no hint", () => {
    expect(detectRelativeSession("Bila cuti?")).toBeNull();
  });
});

describe("mergeSessionsForLoad", () => {
  const getGroup = (id: string): "A" | "B" => (id.startsWith("A-") ? "A" : "B");

  it("merges effective sessions with mentioned ids in same group", () => {
    const scope: ResolvedQueryScope = {
      mentioned: ["B-20264"],
      relativeId: null,
      relativeKind: null,
    };
    const result = mergeSessionsForLoad(["B-20263"], scope, "B", getGroup);
    expect(result.sort()).toEqual(["B-20263", "B-20264"]);
  });

  it("drops mentioned ids from other groups", () => {
    const scope: ResolvedQueryScope = {
      mentioned: ["A-20264"],
      relativeId: null,
      relativeKind: null,
    };
    const result = mergeSessionsForLoad(["B-20263"], scope, "B", getGroup);
    expect(result).toEqual(["B-20263"]);
  });

  it("includes relative target when present", () => {
    const scope: ResolvedQueryScope = {
      mentioned: [],
      relativeId: "B-20264",
      relativeKind: "next",
    };
    const result = mergeSessionsForLoad(["B-20263"], scope, "B", getGroup);
    expect(result.sort()).toEqual(["B-20263", "B-20264"]);
  });
});

describe("buildQueryScopeBlock", () => {
  it("returns empty string when no mention or relative", () => {
    const scope = resolveQueryScope("Bila cuti?", "B", validIds, "2026-03-15");
    expect(buildQueryScopeBlock(scope, ["B-20263"])).toBe("");
  });

  it("emits mentioned and selected lines", () => {
    const scope: ResolvedQueryScope = {
      mentioned: ["B-20264"],
      relativeId: null,
      relativeKind: null,
    };
    const block = buildQueryScopeBlock(scope, ["B-20263"]);
    expect(block).toContain("MENTIONED SESSION(S): B-20264");
    expect(block).toContain("SELECTED SESSION(S): B-20263");
  });
});
