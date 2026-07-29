import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isZarazAvailable,
  trackZarazEvent,
  trackZarazPageView,
  ZARAZ_EVENTS,
} from "@/lib/zaraz";

describe("zaraz", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { zaraz: undefined });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops when zaraz is unavailable", () => {
    expect(isZarazAvailable()).toBe(false);
    expect(() => trackZarazEvent("test_event")).not.toThrow();
  });

  it("forwards events to window.zaraz.track", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    window.zaraz = { track };

    trackZarazEvent(ZARAZ_EVENTS.chatMessageSent, {
      program: "All",
      sessionCount: 2,
    });

    expect(track).toHaveBeenCalledWith("chat_message_sent", {
      program: "All",
      sessionCount: 2,
    });
  });

  it("drops undefined properties", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    window.zaraz = { track };

    trackZarazEvent(ZARAZ_EVENTS.chatFeedback, {
      rating: "up",
      correlationId: undefined,
    });

    expect(track).toHaveBeenCalledWith("chat_feedback", { rating: "up" });
  });

  it("tracks virtual pageviews for client navigations", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    window.zaraz = { track };

    trackZarazPageView("/chat");

    expect(track).toHaveBeenCalledWith("Pageview", { path: "/chat" });
  });
});
