import { describe, expect, it } from "vitest";
import { verifyReplyLanguage } from "@/lib/chat/language/verify";
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

describe("verifyReplyLanguage", () => {
  it("fails when English expected but reply is Malay-dominant", () => {
    const reply =
      "Cuti semester untuk diploma adalah dari 15 Mac 2026 hingga 20 April 2026. Anda boleh semak jadual yang rasmi untuk kumpulan anda.";
    const result = verifyReplyLanguage(reply, profile("en"));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expected_en_got_ms");
  });

  it("fails on Indonesian markers for ms-MY", () => {
    const reply =
      "Libur semester buat mahasiswa mulai Maret sampai Agustus, nggak ada kuliah banget.";
    const result = verifyReplyLanguage(reply, profile("ms-MY"));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("indonesian_markers");
  });

  it("passes English reply for en profile", () => {
    const reply =
      "Semester break for diploma runs from 15 Mar 2026 to 20 Apr 2026. Check your official calendar for Group B.";
    expect(verifyReplyLanguage(reply, profile("en")).ok).toBe(true);
  });

  it("passes Malaysian Malay reply for ms-MY profile", () => {
    const reply =
      "Cuti semester untuk diploma bermula 15 Mac 2026 hingga 20 April 2026. Semak kalendar rasmi kumpulan anda.";
    expect(verifyReplyLanguage(reply, profile("ms-MY")).ok).toBe(true);
  });

  it("allows short replies without failing", () => {
    expect(verifyReplyLanguage("Yes.", profile("en")).ok).toBe(true);
  });
});
