import { describe, expect, it } from "vitest";
import { adaptHistoryForLanguage } from "@/lib/chat/language/history";
import type { LanguageProfile } from "@/lib/chat/language/types";
import type { ChatMessage } from "@/lib/ai";

const enProfile: LanguageProfile = {
  replyLanguage: "en",
  locale: "en",
  codeSwitch: false,
  confidence: 0.9,
  stickyFromHistory: false,
  explicitOverride: null,
  usedLlmClassify: false,
};

describe("adaptHistoryForLanguage", () => {
  it("annotates Malay assistant turns when targeting English", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Bila cuti semester?" },
      {
        role: "assistant",
        content:
          "Cuti semester untuk diploma bermula pada 15 Mac 2026 hingga 20 April 2026 untuk pelajar yang berkenaan.",
      },
    ];
    const adapted = adaptHistoryForLanguage(history, enProfile);
    expect(adapted[1]!.content).toContain("Prior assistant reply was in Malay");
    expect(adapted[1]!.content).toContain("Cuti semester");
  });

  it("leaves history unchanged for ms-MY profile", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Bila cuti?" },
      { role: "assistant", content: "Cuti semester bermula 15 Mac 2026." },
    ];
    const msProfile: LanguageProfile = { ...enProfile, replyLanguage: "ms-MY", locale: "ms-MY" };
    const adapted = adaptHistoryForLanguage(history, msProfile);
    expect(adapted[1]!.content).toBe(history[1]!.content);
  });
});
