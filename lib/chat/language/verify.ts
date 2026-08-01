import { detectHeuristicLanguage } from "@/lib/chat/language/detect";
import type { LanguageProfile, LanguageVerifyResult } from "@/lib/chat/language/types";

/** Indonesian markers that should not appear in ms-MY / mixed BM portions. */
const INDONESIAN_MARKER_RE =
  /\b(nggak|gak|enggak|banget|dong|kok|nih|sih|mahasiswa|jadwal|libur|gimana|kalo|ngga)\b/i;

const INDONESIAN_MONTH_RE =
  /\b(Januari|Februari|Maret|Agustus|Oktober|Desember)\b/;

/** Official / shared terms that must not trigger Indonesian or language flips. */
const ALLOWED_PROPER_RE =
  /\b(UiTM|Cuti\s+Semester|Cuti\s+Pertengahan|Kuliah|Pendaftaran|Peperiksaan|SuFO|RPGT|MDS|KKT)\b/gi;

function stripAllowedProper(text: string): string {
  return text.replace(ALLOWED_PROPER_RE, " ");
}

function malayParticleDensity(text: string): number {
  const hits = text.match(/\b(tak|dah|je|lah|yang|untuk|dengan|bila|adalah|ialah|tidak|bukan)\b/gi);
  return hits?.length ?? 0;
}

function englishFunctionDensity(text: string): number {
  const hits = text.match(
    /\b(the|is|are|was|were|and|for|with|from|this|that|when|what|your|you|will|can)\b/gi
  );
  return hits?.length ?? 0;
}

/**
 * Verify reply matches expected language profile.
 * Conservative: only fail on clear mismatches to avoid wasteful retries.
 */
export function verifyReplyLanguage(
  reply: string,
  profile: LanguageProfile
): LanguageVerifyResult {
  const trimmed = reply.trim();
  if (!trimmed || trimmed.length < 24) return { ok: true };

  const sample = stripAllowedProper(trimmed.slice(0, 1500));

  if (INDONESIAN_MARKER_RE.test(sample) || INDONESIAN_MONTH_RE.test(sample)) {
    if (profile.replyLanguage === "ms-MY" || profile.replyLanguage === "mixed") {
      return { ok: false, reason: "indonesian_markers" };
    }
  }

  const msParticles = malayParticleDensity(sample);
  const enFuncs = englishFunctionDensity(sample);
  const detected = detectHeuristicLanguage(sample.slice(0, 400));

  if (profile.replyLanguage === "en") {
    // Fail when reply is clearly Malay-dominant.
    if (msParticles >= 4 && enFuncs <= 2) {
      return { ok: false, reason: "expected_en_got_ms" };
    }
    if (
      detected.replyLanguage === "ms-MY" &&
      detected.confidence >= 0.65 &&
      msParticles >= 3
    ) {
      return { ok: false, reason: "expected_en_got_ms" };
    }
    return { ok: true };
  }

  if (profile.replyLanguage === "ms-MY") {
    // Fail when reply is clearly English-only for a long answer.
    if (enFuncs >= 8 && msParticles <= 1 && detected.replyLanguage === "en") {
      return { ok: false, reason: "expected_ms_got_en" };
    }
    return { ok: true };
  }

  // mixed: only fail hard Indonesian already handled; allow mono if short
  return { ok: true };
}
