import { describe, expect, it } from "vitest";
import { shouldScheduleAutoCollapse } from "@/lib/chat/reasoning-collapse";

describe("shouldScheduleAutoCollapse", () => {
  const base = {
    collapsible: true,
    collapseWhen: true,
    prevCollapseWhen: false,
    isOpen: true,
    hasCollapsedAfterAnswer: false,
    userOpenedManually: false,
  };

  it("schedules on rising edge when open and not manual", () => {
    expect(shouldScheduleAutoCollapse(base)).toBe(true);
  });

  it("does not schedule when collapseWhen stays true (no rising edge)", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        prevCollapseWhen: true,
      })
    ).toBe(false);
  });

  it("does not schedule when user opened manually", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        userOpenedManually: true,
      })
    ).toBe(false);
  });

  it("does not schedule when already collapsed after answer", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        hasCollapsedAfterAnswer: true,
      })
    ).toBe(false);
  });

  it("does not schedule when panel is closed", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        isOpen: false,
      })
    ).toBe(false);
  });

  it("does not schedule when not collapsible", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        collapsible: false,
      })
    ).toBe(false);
  });

  it("does not schedule when collapseWhen is false", () => {
    expect(
      shouldScheduleAutoCollapse({
        ...base,
        collapseWhen: false,
      })
    ).toBe(false);
  });
});
