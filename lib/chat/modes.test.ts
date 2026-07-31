import { describe, expect, it } from "vitest";
import { resolveChatMode, resolveModeFromMessage, getModeSystemDirective } from "@/lib/chat/modes";

describe("modes", () => {
  it("defaults to ask", () => {
    expect(resolveChatMode(undefined)).toBe("ask");
    expect(resolveChatMode("nope")).toBe("ask");
    expect(resolveChatMode("plan")).toBe("plan");
  });

  it("includes plan directive for plan mode", () => {
    expect(getModeSystemDirective("plan")).toContain("PLAN MY SEMESTER");
    expect(getModeSystemDirective("ask")).toBe("");
  });

  it("detects mode from user message", () => {
    expect(resolveModeFromMessage("Translate this to English")).toBe("translate");
    expect(resolveModeFromMessage("Betulkan grammar ayat ini")).toBe("rewrite");
    expect(resolveModeFromMessage("Ringkaskan nota kuliah saya")).toBe("summarize");
    expect(resolveModeFromMessage("Bantu saya plan semester ini")).toBe("plan");
    expect(resolveModeFromMessage("Kenapa minggu ulangkaji penting?")).toBe("explain");
    expect(resolveModeFromMessage("Bila cuti semester?")).toBe("ask");
  });
});
