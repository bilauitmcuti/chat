import { describe, expect, it } from "vitest";
import { buildLanguageLockMessage } from "@/lib/chat/language/lock";
import { applyLanguageToTurn } from "@/lib/chat/language";
import type { LanguageProfile } from "@/lib/chat/language/types";

function profile(replyLanguage: LanguageProfile["replyLanguage"]): LanguageProfile {
  return {
    replyLanguage,
    locale: replyLanguage === "en" ? "en" : "ms-MY",
    codeSwitch: replyLanguage === "mixed",
    confidence: 0.9,
    stickyFromHistory: false,
    explicitOverride: null,
    usedLlmClassify: false,
  };
}

describe("buildLanguageLockMessage", () => {
  it("locks English replies", () => {
    const lock = buildLanguageLockMessage(profile("en"));
    expect(lock).toContain("LANGUAGE LOCK");
    expect(lock).toContain("English");
    expect(lock).toContain("Ignore the language of earlier assistant");
  });

  it("locks Malaysian Malay and bans Indonesian", () => {
    const lock = buildLanguageLockMessage(profile("ms-MY"));
    expect(lock).toContain("not Bahasa Indonesia");
    expect(lock).toContain("Mac, Apr, Mei");
    expect(lock).toContain("Never Indonesian month names");
  });

  it("locks mixed code-switch", () => {
    const lock = buildLanguageLockMessage(profile("mixed"));
    expect(lock).toContain("code-switch");
    expect(lock).toContain("Malaysian Malay only");
  });
});

describe("applyLanguageToTurn", () => {
  it("returns profile, adapted history, and lock for any model id", async () => {
    const turn = await applyLanguageToTurn({
      message: "When is cuti semester?",
      history: [
        { role: "user", content: "Bila cuti?" },
        {
          role: "assistant",
          content:
            "Cuti semester untuk diploma bermula pada 15 Mac 2026 hingga 20 April 2026 untuk pelajar.",
        },
      ],
      modelId: "@cf/google/gemma-4-26b-a4b-it",
      skipLlm: true,
    });
    expect(turn.profile.replyLanguage).toBe("en");
    expect(turn.languageLockMessage).toContain("LANGUAGE LOCK");
    expect(turn.history[1]!.content).toContain("Prior assistant reply was in Malay");
  });
});
