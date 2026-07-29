import { describe, expect, it } from "vitest";
import {
  applyGroupASessionsToMeta,
  GROUP_A_DEFAULT_SESSION_ID,
  GROUP_A_SESSION_IDS,
  isGroupASessionId,
} from "./group-a-sessions";

describe("group-a-sessions", () => {
  it("defines only A-20264 and A-20272", () => {
    expect(GROUP_A_SESSION_IDS).toEqual(["A-20264", "A-20272"]);
    expect(isGroupASessionId("A-20264")).toBe(true);
    expect(isGroupASessionId("A-20272")).toBe(true);
    expect(isGroupASessionId("A-20251")).toBe(false);
  });

  it("filters API meta to configured Group A sessions", () => {
    const meta = applyGroupASessionsToMeta({
      defaultSession: { A: "A-20251", B: "B-20263" },
      sessionOptions: [
        { id: "A-20251", label: "Dec 2025 - May 2026", group: "A" },
        { id: "A-20264", label: "Jun - Oct 2026", group: "A" },
        { id: "A-20272", label: "Sep 2026 - Feb 2027", group: "A" },
        { id: "B-20263", label: "Mar - Aug 2026", group: "B" },
      ],
      programOptions: [],
    });
    expect(meta.sessionOptions.map((s) => s.id)).toEqual(["A-20264", "A-20272", "B-20263"]);
    expect(meta.defaultSession).toEqual({
      A: GROUP_A_DEFAULT_SESSION_ID,
      B: "B-20263",
    });
  });
});
