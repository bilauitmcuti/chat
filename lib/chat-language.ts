import type { ChatMessage } from "@/lib/ai";
import { CHAT_BM_MALAYSIA_LOCALE_RULES } from "@/lib/chat/response-format";

export type UserLanguageMode = "english" | "malay" | "mixed";

const MALAY_WORD_RE =
  /\b(yang|dan|atau|untuk|dengan|tanpa|tidak|bukan|bila|bilakah|apa|bagaimana|berapa|saja|saya|awak|anda|kami|kita|dia|mereka|ini|itu|sini|sana|cuti|sesi|minggu|hari|bulan|tahun|daripada|kepada|ialah|adalah|dapat|boleh|akan|telah|sudah|belum|kerana|juga|serta|pula|lagi|nak|dah|tak|takde|je|lah|kah|pun|ke|semester|peperiksaan|kuliah|pendaftaran|pelajar|kalendar|jadual|negeri|kumpulan)\b/gi;

const ENGLISH_WORD_RE =
  /\b(the|a|an|is|are|was|were|am|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|my|your|our|their|this|that|these|those|what|when|where|which|why|who|how|please|tell|show|list|next|last|current|today|tomorrow|yesterday|about|for|from|with|without|between|during|before|after|calendar|registration|session|exam|break|lecture|schedule|semester|student|university|campus|program|course|date|dates|week|weeks|day|days)\b/gi;

const ENGLISH_QUESTION_START_RE =
  /^(when|what|where|which|why|who|how|is|are|was|were|do|does|did|can|could|will|would|should|am)\b/i;

const MALAY_QUESTION_START_RE =
  /^(bila|bilakah|apa|berapa|bagaimana|kenapa|mengapa|siapa|adakah|bolehkah|boleh|nak)\b/i;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/** Malay particles / suffixes strongly indicate BM even in short messages. */
function hasMalayParticles(text: string): boolean {
  return /\b(tak|takde|dah|je|lah|kah|pun|ke)\b/i.test(text) || /(lah|kah|pun|je|tak)$/i.test(text.trim());
}

/** English question shape even with some Malay loanwords (e.g. "When is cuti semester?"). */
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

export function detectUserLanguage(message: string): UserLanguageMode {
  const s = message.trim();
  if (!s) return "malay";

  const malayScore = countMatches(s, MALAY_WORD_RE);
  const englishScore = countMatches(s, ENGLISH_WORD_RE);
  const englishShape = hasEnglishQuestionShape(s);
  const malayShape = hasMalayQuestionShape(s);
  const malayParticles = hasMalayParticles(s);

  if (englishShape && !malayShape && !malayParticles) return "english";
  if (malayShape && !englishShape) return "malay";
  if (malayParticles && englishScore <= 1) return "malay";

  if (englishScore >= 2 && malayScore === 0) return "english";
  if (malayScore >= 2 && englishScore === 0) return "malay";

  if (englishShape && malayScore <= englishScore) return "english";
  if (malayShape && englishScore <= malayScore) return "malay";

  if (englishScore > malayScore + 1) return "english";
  if (malayScore > englishScore + 1) return "malay";

  if (englishScore >= 1 && malayScore >= 1) return "mixed";
  if (englishScore >= 1) return "english";
  if (malayScore >= 1) return "malay";

  return englishShape ? "english" : "malay";
}

function getLastUserMessage(history?: ChatMessage[]): string {
  if (!history?.length) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && history[i].content.trim()) {
      return history[i].content.trim();
    }
  }
  return "";
}

export function getLanguageTurnDirective(
  message: string,
  history?: ChatMessage[]
): string {
  const primary = message.trim() || getLastUserMessage(history);
  if (!primary) return "";

  const mode = detectUserLanguage(primary);

  if (mode === "english") {
    return [
      "",
      "LANGUAGE DIRECTIVE (highest priority for this reply):",
      "- The user's latest message is in ENGLISH. Write your ENTIRE answer in English only.",
      "- Do NOT reply in Bahasa Melayu unless quoting a fixed proper noun or official Malay term once (e.g. Cuti Pertengahan Semester) with English explanation nearby.",
      "- Use English headers (e.g. \"Group B (Diploma):\"), not \"Kumpulan\".",
      "- If calendar context below uses Malay labels, translate or explain them in English for the user.",
    ].join("\n");
  }

  if (mode === "malay") {
    return [
      "",
      "LANGUAGE DIRECTIVE (highest priority for this reply):",
      "- The user's latest message is in BAHASA MELAYU. Write your ENTIRE answer in Bahasa Melayu standard (Malaysia).",
      "- Do NOT switch to English-only replies.",
      "- Do NOT reply in Bahasa Indonesia — use Malaysian Malay only.",
      "- Keep proper nouns and usual abbreviations (UiTM, GT, RPGT, kod kursus).",
      "- Use Malay headers (e.g. \"Kumpulan B (Diploma):\"), not \"Group\" alone.",
      CHAT_BM_MALAYSIA_LOCALE_RULES,
    ].join("\n");
  }

  return [
    "",
    "LANGUAGE DIRECTIVE (highest priority for this reply):",
    "- The user mixed Malay and English. Mirror the same blend in your answer (code-switch naturally).",
    "- Do not translate the whole reply into only English or only Malay unless they asked for translation.",
    "- Match the proportion: mostly English words in their message → mostly English reply; mostly Malay → mostly Malay.",
    "- For any Bahasa Melayu portion, use Malaysian Malay only — never Bahasa Indonesia.",
    CHAT_BM_MALAYSIA_LOCALE_RULES,
  ].join("\n");
}
