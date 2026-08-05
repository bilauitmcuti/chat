import type { LanguageProfile } from "@/lib/chat/language/types";

const BM_LOCALE_BRIEF = `Malaysian Malay only (ms-MY) — not Bahasa Indonesia: pelajar not mahasiswa, jadual not jadwal, cuti not libur, maklumat not informasi; particles tak/dah/je/lah — never nggak/gak/kok/dong/banget. Months: Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogos, Sep, Okt, Nov, Dis. Never Indonesian month names.`;

/**
 * Short trailing LANGUAGE LOCK for scoped prompts (Workers AI user role).
 * Keep brief — full BM rules stay in system RESPONSE FORMAT.
 */
export function buildLanguageLockMessage(profile: LanguageProfile): string {
  const lines = ["LANGUAGE LOCK (highest priority for this reply):"];

  if (profile.replyLanguage === "en") {
    lines.push(
      "- Reply entirely in English.",
      "- Official Malay calendar names may appear once, then explain in English.",
      "- Use English headers (e.g. Group B), not Kumpulan.",
      "- Ignore the language of earlier assistant replies if they were not English."
    );
  } else if (profile.replyLanguage === "ms-MY") {
    lines.push(
      "- Reply entirely in Bahasa Melayu (Malaysia / ms-MY).",
      "- Do not reply in English-only or Bahasa Indonesia — use Malaysian Malay only.",
      `- ${BM_LOCALE_BRIEF}`,
      "- Use Malay headers (e.g. Kumpulan B)."
    );
  } else {
    lines.push(
      "- Mirror the user's Malay-English mix (natural code-switch).",
      "- Do not force the whole reply into only English or only Malay.",
      "- For any Bahasa Melayu portion, use Malaysian Malay only — never Bahasa Indonesia.",
      `- ${BM_LOCALE_BRIEF}`
    );
  }

  if (profile.explicitOverride) {
    lines.push("- User explicitly requested this response language — follow it strictly.");
  }

  return lines.join("\n");
}

/** Legacy long system-prompt directive (kept for tests / fallback). Prefer lock message. */
export function getLanguageTurnDirectiveFromProfile(profile: LanguageProfile): string {
  return "\n\n" + buildLanguageLockMessage(profile);
}
