import type { LanguageProfile } from "@/lib/chat/language/types";
import type { LanguageVerifyResult } from "@/lib/chat/language/types";

/** Nudge appended for a single language regenerate (like date/incomplete retries). */
export function buildLanguageRetryNudge(
  profile: LanguageProfile,
  verify: LanguageVerifyResult
): string {
  const reason = verify.reason ?? "language_mismatch";
  const lines = [
    "",
    "CRITICAL LANGUAGE REWRITE:",
    `- Previous reply failed language check (${reason}).`,
    "- Re-answer the user's question with the SAME facts and formatting (lists, headings, markdown).",
    "- Do not explain that you are fixing language.",
  ];

  if (profile.replyLanguage === "en") {
    lines.push("- Write the ENTIRE answer in English only (official Malay names once is OK).");
  } else if (profile.replyLanguage === "ms-MY") {
    lines.push(
      "- Write the ENTIRE answer in Bahasa Melayu Malaysia (ms-MY).",
      "- Never use Bahasa Indonesia wording (nggak, mahasiswa, jadwal, libur, Maret, Agustus, …)."
    );
  } else {
    lines.push("- Mirror the user's Malay-English mix; BM portions must be Malaysian Malay only.");
  }

  return lines.join("\n");
}

export const LANGUAGE_RETRY_REASON = "language" as const;
