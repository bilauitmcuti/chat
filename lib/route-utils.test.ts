import { describe, expect, it } from "vitest";
import { getProgramFromRoute, isProgramValue } from "@/lib/route-utils";

describe("route-utils", () => {
  it("maps route slugs to program values", () => {
    expect(getProgramFromRoute("diploma")).toBe("Diploma");
    expect(getProgramFromRoute("foundation-professional")).toBe("Foundation/Professional");
    expect(getProgramFromRoute(null)).toBe("All");
  });

  it("validates program values", () => {
    expect(isProgramValue("Diploma")).toBe(true);
    expect(isProgramValue("NotAProgram")).toBe(false);
  });
});
