/** Reply language for the language-control pipeline (locale-aware). */
export type ReplyLanguage = "en" | "ms-MY" | "mixed";

/** Legacy mode used by reasoning UI / older helpers. */
export type UserLanguageMode = "english" | "malay" | "mixed";

export type ExplicitLanguageOverride = ReplyLanguage | null;

export interface LanguageProfile {
  replyLanguage: ReplyLanguage;
  /** Always ms-MY when any Malay is involved; en otherwise. */
  locale: "en" | "ms-MY";
  codeSwitch: boolean;
  confidence: number;
  stickyFromHistory: boolean;
  explicitOverride: ExplicitLanguageOverride;
  /** True when soft-JSON classify was used for this turn. */
  usedLlmClassify: boolean;
}

export interface HeuristicDetectResult {
  replyLanguage: ReplyLanguage;
  confidence: number;
  codeSwitch: boolean;
  explicitOverride: ExplicitLanguageOverride;
  isShortFollowUp: boolean;
  isAmbiguous: boolean;
}

export interface LanguageVerifyResult {
  ok: boolean;
  reason?:
    | "expected_en_got_ms"
    | "expected_ms_got_en"
    | "indonesian_markers"
    | "expected_mixed_got_mono";
}

export function replyLanguageToMode(lang: ReplyLanguage): UserLanguageMode {
  if (lang === "en") return "english";
  if (lang === "ms-MY") return "malay";
  return "mixed";
}

export function modeToReplyLanguage(mode: UserLanguageMode): ReplyLanguage {
  if (mode === "english") return "en";
  if (mode === "malay") return "ms-MY";
  return "mixed";
}
