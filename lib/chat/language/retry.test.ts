import { describe, expect, it } from "vitest";
import { buildLanguageRetryNudge, LANGUAGE_RETRY_REASON } from "@/lib/chat/language/retry";
import type { LanguageProfile } from "@/lib/chat/language/types";

describe("buildLanguageRetryNudge", () => {
  it("asks for English rewrite without mentioning detection to the end user in the nudge purpose", () => {
    const profile: LanguageProfile = {
      replyLanguage: "en",
      locale: "en",
      codeSwitch: false,
      confidence: 0.9,
      stickyFromHistory: false,
      explicitOverride: null,
      usedLlmClassify: false,
    };
    const nudge = buildLanguageRetryNudge(profile, {
      ok: false,
      reason: "expected_en_got_ms",
    });
    expect(LANGUAGE_RETRY_REASON).toBe("language");
    expect(nudge).toContain("CRITICAL LANGUAGE REWRITE");
    expect(nudge).toContain("English only");
    expect(nudge).toContain("Do not explain that you are fixing language");
  });
});
