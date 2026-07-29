import { describe, expect, it } from "vitest";
import {
  FALLBACK_DEFAULT_SESSION_MAP,
  normalizeDefaultSession,
} from "./calendar-api";

describe("normalizeDefaultSession", () => {
  it("parses all=true map shape", () => {
    expect(
      normalizeDefaultSession({ A: "A-20264", B: "B-20264" })
    ).toEqual({ A: "A-20264", B: "B-20264" });
  });

  it("fills missing map keys from fallback", () => {
    expect(normalizeDefaultSession({ A: "A-20264" })).toEqual({
      A: "A-20264",
      B: FALLBACK_DEFAULT_SESSION_MAP.B,
    });
  });

  it("normalizes group-scoped string to map", () => {
    expect(normalizeDefaultSession("A-20264")).toEqual({
      A: "A-20264",
      B: FALLBACK_DEFAULT_SESSION_MAP.B,
    });
    expect(normalizeDefaultSession("B-20264")).toEqual({
      A: FALLBACK_DEFAULT_SESSION_MAP.A,
      B: "B-20264",
    });
  });

  it("falls back for invalid input", () => {
    expect(normalizeDefaultSession(null)).toEqual(FALLBACK_DEFAULT_SESSION_MAP);
    expect(normalizeDefaultSession("invalid")).toEqual(FALLBACK_DEFAULT_SESSION_MAP);
  });
});
