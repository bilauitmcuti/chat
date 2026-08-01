import type { ChatMessage } from "@/lib/ai";
import type {
  ExplicitLanguageOverride,
  HeuristicDetectResult,
  ReplyLanguage,
  UserLanguageMode,
} from "@/lib/chat/language/types";
import { modeToReplyLanguage, replyLanguageToMode } from "@/lib/chat/language/types";

/** UiTM / calendar loanwords that appear in English questions without implying BM reply. */
const LOANWORD_RE =
  /\b(cuti|sesi|minggu|kuliah|peperiksaan|pendaftaran|kalendar|jadual|negeri|kumpulan|pelajar|semester)\b/gi;

const MALAY_WORD_RE =
  /\b(yang|dan|atau|untuk|dengan|tanpa|tidak|bukan|bila|bilakah|apa|bagaimana|berapa|saja|saya|awak|anda|kami|kita|dia|mereka|ini|itu|sini|sana|daripada|kepada|ialah|adalah|dapat|boleh|akan|telah|sudah|belum|kerana|juga|serta|pula|lagi|nak|dah|tak|takde|je|lah|kah|pun|ke|macam|lepas|tu|ni|hah|eh)\b/gi;

const ENGLISH_WORD_RE =
  /\b(the|a|an|is|are|was|were|am|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|my|your|our|their|this|that|these|those|what|when|where|which|why|who|how|please|tell|show|list|next|last|current|today|tomorrow|yesterday|about|for|from|with|without|between|during|before|after|calendar|registration|session|exam|break|lecture|schedule|student|university|campus|program|course|date|dates|week|weeks|day|days|start|starts|end|ends|more|okay|ok|yes|no|thanks|thank)\b/gi;

const ENGLISH_QUESTION_START_RE =
  /^(when|what|where|which|why|who|how|is|are|was|were|do|does|did|can|could|will|would|should|am)\b/i;

const MALAY_QUESTION_START_RE =
  /^(bila|bilakah|apa|berapa|bagaimana|kenapa|mengapa|siapa|adakah|bolehkah|boleh|nak)\b/i;

const SHORT_FOLLOW_UP_RE =
  /^(next|why|more|okay|ok|yes|no|thanks|thank you|lepas tu|lepas ni|tu|ni|hah|eh|ye|ya|tak|dah|lagi|macam mana|kenapa|bila|apa)\??\.?!*$/i;

const EXPLICIT_EN_RE =
  /\b(reply\s+in\s+english|answer\s+in\s+english|jawab\s+dalam\s+english|jawab\s+dalam\s+bahasa\s+inggeris|in\s+english\s+please|please\s+reply\s+in\s+english)\b/i;

const EXPLICIT_MS_RE =
  /\b(reply\s+in\s+(malay|bm|bahasa\s+melayu)|answer\s+in\s+(malay|bm)|jawab\s+dalam\s+(bm|bahasa\s+melayu|melayu)|in\s+malay\s+please)\b/i;

const EXPLICIT_MIXED_RE =
  /\b(mix(ed)?\s+(malay|bm)?\s*(and|&|\/)\s*english|campur\s+(bm|bahasa)?|rojak|code[\s-]?switch)\b/i;

const INDONESIAN_INPUT_RE =
  /\b(nggak|gak|banget|dong|nih|kok|mahasiswa|jadwal|libur|kuliahnya|gimana|enggak|sih)\b/i;

const HIGH_CONFIDENCE = 0.85;
const MED_CONFIDENCE = 0.65;
const LOW_CONFIDENCE = 0.4;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function hasMalayParticles(text: string): boolean {
  return (
    /\b(tak|takde|dah|je|lah|kah|pun|ke)\b/i.test(text) ||
    /(lah|kah|pun|je|tak)$/i.test(text.trim())
  );
}

function hasEnglishQuestionShape(text: string): boolean {
  const t = text.trim();
  if (ENGLISH_QUESTION_START_RE.test(t)) return true;
  if (/\b(how many|how long|how much)\b/i.test(t)) return true;
  if (/\b(is|are|was|were)\s+(the|there|my|our|this|that|it)\b/i.test(t)) return true;
  if (/\b(the|a|an)\s+\w+/i.test(t) && /\?/.test(t)) return true;
  return false;
}

function hasMalayQuestionShape(text: string): boolean {
  const t = text.trim();
  return MALAY_QUESTION_START_RE.test(t) || /\b(berapa lama|berapa hari|bila nak)\b/i.test(t);
}

/** Content words excluding shared calendar loanwords (for EN-vs-BM scoring). */
function contentMalayScore(text: string): number {
  return countMatches(text, MALAY_WORD_RE);
}

function contentEnglishScore(text: string): number {
  return countMatches(text, ENGLISH_WORD_RE);
}

function loanwordScore(text: string): number {
  return countMatches(text, LOANWORD_RE);
}

export function detectExplicitLanguageOverride(message: string): ExplicitLanguageOverride {
  const s = message.trim();
  if (!s) return null;
  if (EXPLICIT_EN_RE.test(s)) return "en";
  if (EXPLICIT_MS_RE.test(s)) return "ms-MY";
  if (EXPLICIT_MIXED_RE.test(s)) return "mixed";
  return null;
}

export function isShortFollowUpMessage(message: string): boolean {
  const s = message.trim();
  if (!s) return true;
  if (s.length > 48) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && SHORT_FOLLOW_UP_RE.test(s)) return true;
  if (words.length <= 2) return true;
  return false;
}

export function detectHeuristicLanguage(message: string): HeuristicDetectResult {
  const s = message.trim();
  const explicitOverride = detectExplicitLanguageOverride(s);
  if (explicitOverride) {
    return {
      replyLanguage: explicitOverride,
      confidence: 0.98,
      codeSwitch: explicitOverride === "mixed",
      explicitOverride,
      isShortFollowUp: isShortFollowUpMessage(s),
      isAmbiguous: false,
    };
  }

  if (!s) {
    return {
      replyLanguage: "mixed",
      confidence: LOW_CONFIDENCE,
      codeSwitch: true,
      explicitOverride: null,
      isShortFollowUp: true,
      isAmbiguous: true,
    };
  }

  const shortFollowUp = isShortFollowUpMessage(s);
  if (shortFollowUp && s.length <= 48) {
    return {
      replyLanguage: "mixed",
      confidence: LOW_CONFIDENCE,
      codeSwitch: true,
      explicitOverride: null,
      isShortFollowUp: true,
      isAmbiguous: true,
    };
  }

  // Indonesian-flavoured input → answer in Malaysian Malay
  if (INDONESIAN_INPUT_RE.test(s) && !hasEnglishQuestionShape(s)) {
    return {
      replyLanguage: "ms-MY",
      confidence: HIGH_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  const malayScore = contentMalayScore(s);
  const englishScore = contentEnglishScore(s);
  const loans = loanwordScore(s);
  const englishShape = hasEnglishQuestionShape(s);
  const malayShape = hasMalayQuestionShape(s);
  const malayParticles = hasMalayParticles(s);

  // English question shape wins over BM loanwords (cuti/sesi/semester).
  if (englishShape && !malayShape && !malayParticles) {
    return {
      replyLanguage: "en",
      confidence: loans > 0 || englishScore >= 1 ? HIGH_CONFIDENCE : MED_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  if (malayShape && !englishShape) {
    const mixed = englishScore >= 2;
    return {
      replyLanguage: mixed ? "mixed" : "ms-MY",
      confidence: mixed ? MED_CONFIDENCE : HIGH_CONFIDENCE,
      codeSwitch: mixed,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: mixed,
    };
  }

  if (malayParticles && englishScore <= 1) {
    return {
      replyLanguage: "ms-MY",
      confidence: HIGH_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  if (englishScore >= 2 && malayScore === 0) {
    return {
      replyLanguage: "en",
      confidence: HIGH_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  if (malayScore >= 2 && englishScore === 0) {
    return {
      replyLanguage: "ms-MY",
      confidence: HIGH_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  if (englishShape && malayScore <= englishScore) {
    return {
      replyLanguage: "en",
      confidence: MED_CONFIDENCE,
      codeSwitch: malayScore > 0,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: malayScore > 0,
    };
  }

  if (malayShape && englishScore <= malayScore) {
    return {
      replyLanguage: englishScore > 0 ? "mixed" : "ms-MY",
      confidence: MED_CONFIDENCE,
      codeSwitch: englishScore > 0,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: englishScore > 0,
    };
  }

  if (englishScore > malayScore + 1) {
    return {
      replyLanguage: "en",
      confidence: MED_CONFIDENCE,
      codeSwitch: malayScore > 0,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: malayScore > 0,
    };
  }

  if (malayScore > englishScore + 1) {
    return {
      replyLanguage: "ms-MY",
      confidence: MED_CONFIDENCE,
      codeSwitch: englishScore > 0,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: englishScore > 0,
    };
  }

  if (englishScore >= 1 && malayScore >= 1) {
    return {
      replyLanguage: "mixed",
      confidence: MED_CONFIDENCE,
      codeSwitch: true,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: true,
    };
  }

  if (englishScore >= 1) {
    return {
      replyLanguage: "en",
      confidence: MED_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: false,
    };
  }

  if (malayScore >= 1 || loans >= 1) {
    // Loanwords alone (cuti/sesi) without English shape → treat as BM, not English.
    return {
      replyLanguage: "ms-MY",
      confidence: malayScore >= 1 ? MED_CONFIDENCE : LOW_CONFIDENCE,
      codeSwitch: false,
      explicitOverride: null,
      isShortFollowUp: false,
      isAmbiguous: malayScore === 0 && loans >= 1,
    };
  }

  // Empty / unclear: do not default to Malay — low-confidence mixed for sticky resolve.
  return {
    replyLanguage: "mixed",
    confidence: LOW_CONFIDENCE,
    codeSwitch: true,
    explicitOverride: null,
    isShortFollowUp: shortFollowUp,
    isAmbiguous: true,
  };
}

/** Legacy API: map heuristic result to english/malay/mixed. */
export function detectUserLanguage(message: string): UserLanguageMode {
  return replyLanguageToMode(detectHeuristicLanguage(message).replyLanguage);
}

export function getLastUserMessage(history?: ChatMessage[]): string {
  if (!history?.length) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && history[i].content.trim()) {
      return history[i].content.trim();
    }
  }
  return "";
}

/** Infer sticky language from prior user turns (and assistant as weak signal). */
export function inferStickyLanguageFromHistory(
  history?: ChatMessage[]
): ReplyLanguage | null {
  if (!history?.length) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user" || !msg.content.trim()) continue;
    if (isShortFollowUpMessage(msg.content)) continue;
    const h = detectHeuristicLanguage(msg.content);
    if (h.explicitOverride) return h.explicitOverride;
    // Accept ambiguous mixed/ms/en when confidence is usable — sticky needs a prior voice.
    if (h.confidence >= MED_CONFIDENCE) return h.replyLanguage;
    if (h.confidence >= LOW_CONFIDENCE && h.replyLanguage !== "mixed") {
      return h.replyLanguage;
    }
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "assistant" || !msg.content.trim()) continue;
    const sample = msg.content.slice(0, 400);
    const h = detectHeuristicLanguage(sample);
    if (h.confidence >= MED_CONFIDENCE) return h.replyLanguage;
  }

  return null;
}

export { modeToReplyLanguage, HIGH_CONFIDENCE, MED_CONFIDENCE, LOW_CONFIDENCE };
