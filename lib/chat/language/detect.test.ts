import { describe, expect, it } from "vitest";
import {
  detectExplicitLanguageOverride,
  detectHeuristicLanguage,
  detectUserLanguage,
  inferStickyLanguageFromHistory,
  isShortFollowUpMessage,
} from "@/lib/chat/language/detect";
import type { ChatMessage } from "@/lib/ai";

describe("detectHeuristicLanguage", () => {
  it("detects pure English", () => {
    const h = detectHeuristicLanguage("When does the semester start for diploma?");
    expect(h.replyLanguage).toBe("en");
    expect(h.confidence).toBeGreaterThanOrEqual(0.65);
    expect(h.isAmbiguous).toBe(false);
  });

  it("detects Malaysian Malay", () => {
    const h = detectHeuristicLanguage("Bila cuti semester untuk diploma?");
    expect(h.replyLanguage).toBe("ms-MY");
    expect(h.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("detects mixed code-switch", () => {
    const h = detectHeuristicLanguage("Bila start semester ni week berapa?");
    expect(h.replyLanguage).toBe("mixed");
    expect(h.codeSwitch).toBe(true);
  });

  it("English shape wins over BM loanwords", () => {
    const h = detectHeuristicLanguage("When is cuti semester?");
    expect(h.replyLanguage).toBe("en");
    expect(h.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("maps Indonesian-flavoured input to ms-MY", () => {
    const h = detectHeuristicLanguage("Kapan libur semester banget nih?");
    expect(h.replyLanguage).toBe("ms-MY");
  });

  it("does not default empty message to malay", () => {
    const h = detectHeuristicLanguage("");
    expect(h.replyLanguage).toBe("mixed");
    expect(h.isAmbiguous).toBe(true);
    expect(h.confidence).toBeLessThan(0.5);
  });

  it("honours explicit English override", () => {
    const h = detectHeuristicLanguage("Bila cuti? Reply in English please");
    expect(h.explicitOverride).toBe("en");
    expect(h.replyLanguage).toBe("en");
  });

  it("honours explicit Malay override", () => {
    expect(detectExplicitLanguageOverride("Please jawab dalam BM")).toBe("ms-MY");
  });
});

describe("detectUserLanguage (legacy)", () => {
  it("maps en/ms-MY/mixed to english/malay/mixed", () => {
    expect(detectUserLanguage("When is registration?")).toBe("english");
    expect(detectUserLanguage("Bila pendaftaran dibuka?")).toBe("malay");
    expect(detectUserLanguage("Bila start semester ni week berapa?")).toBe("mixed");
  });
});

describe("short follow-up + sticky history", () => {
  it("flags short follow-ups", () => {
    expect(isShortFollowUpMessage("Next")).toBe(true);
    expect(isShortFollowUpMessage("Why?")).toBe(true);
    expect(isShortFollowUpMessage("Okay")).toBe(true);
    expect(isShortFollowUpMessage("Lepas tu")).toBe(true);
    expect(isShortFollowUpMessage("When is cuti semester for Group B diploma students?")).toBe(
      false
    );
  });

  it("infers sticky ms-MY from prior Malay user turns", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Bila cuti semester diploma?" },
      { role: "assistant", content: "Cuti semester bermula pada 15 Mac 2026." },
    ];
    expect(inferStickyLanguageFromHistory(history)).toBe("ms-MY");
  });

  it("infers sticky en from prior English user turns", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "When does the semester start?" },
      { role: "assistant", content: "It starts on 15 Mar 2026." },
    ];
    expect(inferStickyLanguageFromHistory(history)).toBe("en");
  });
});
