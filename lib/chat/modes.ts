export const DEFAULT_CHAT_MODE = "ask" as const;

export const CHAT_MODES = [
  {
    id: "ask",
    name: "Ask",
    description: "Calendar, holidays, and UiTM questions",
  },
  {
    id: "plan",
    name: "Plan My Semester",
    description: "Study, revision, and break plans",
  },
  {
    id: "summarize",
    name: "Summarize",
    description: "Turn long text into shorter notes",
  },
  {
    id: "rewrite",
    name: "Rewrite",
    description: "Improve grammar, clarity, and tone",
  },
  {
    id: "translate",
    name: "Translate",
    description: "Malay ↔ English, natural wording",
  },
  {
    id: "explain",
    name: "Explain",
    description: "Simple steps and examples",
  },
] as const;

export type ChatModeId = (typeof CHAT_MODES)[number]["id"];

const ALLOWED_MODES = new Set<string>(CHAT_MODES.map((m) => m.id));

/** Long paste threshold for summarize detection. */
const SUMMARIZE_LONG_CHARS = 280;

const TRANSLATE_RE =
  /\b(translate|terjemah|terjemahan|alih\s*bahasa|bm\s*(↔|<|>|->|to|ke)\s*en|en\s*(↔|<|>|->|to|ke)\s*bm|bahasa\s+inggeris|to\s+english|to\s+malay|ke\s+bahasa\s+melayu|ke\s+english)\b/i;

const REWRITE_RE =
  /\b(rewrite|tulis\s*semula|betulkan|grammar|tatabahasa|tone|nada|make\s+professional|academic\s+tone|speaker\s*notes|skrip\s*(presentation|pembentangan)|presentation\s*script|fix\s+grammar|improve\s+(clarity|writing)|make\s+shorter)\b/i;

const SUMMARIZE_RE =
  /\b(summarize|summarise|summary|ringkas(kan)?|ringkasan|buat\s+nota\s+pendek|tl;?dr)\b/i;

const PLAN_RE =
  /\b(plan\s+(my\s+)?semester|plan\s+around|jadual\s+belajar|rancang(kan)?|pelan\s+(belajar|ulangkaji|semester)|study\s+plan|revision\s+plan|plan\s+belajar)\b/i;

const EXPLAIN_RE =
  /\b(explain|terangkan|jelaskan|kenapa|mengapa|how\s+does|bagaimana|apa\s+maksud|what\s+does\s+.+\s+mean|maksudnya\s+apa)\b/i;

export function isChatModeId(value: string): value is ChatModeId {
  return ALLOWED_MODES.has(value);
}

/** @deprecated Prefer resolveModeFromMessage for turns; kept for allowlist checks. */
export function resolveChatMode(mode?: string | null): ChatModeId {
  const trimmed = mode?.trim().toLowerCase();
  if (trimmed && isChatModeId(trimmed)) return trimmed;
  return DEFAULT_CHAT_MODE;
}

export function getChatMode(modeId: string): (typeof CHAT_MODES)[number] | undefined {
  return CHAT_MODES.find((m) => m.id === modeId);
}

/**
 * Infer internal task mode from the user message (no client mode picker).
 * Priority: translate → rewrite → summarize → plan → explain → ask.
 */
export function resolveModeFromMessage(message: string): ChatModeId {
  const text = message.trim();
  if (!text) return DEFAULT_CHAT_MODE;

  if (TRANSLATE_RE.test(text)) return "translate";
  if (REWRITE_RE.test(text)) return "rewrite";
  if (SUMMARIZE_RE.test(text) && text.length >= SUMMARIZE_LONG_CHARS) return "summarize";
  if (SUMMARIZE_RE.test(text)) return "summarize";
  if (PLAN_RE.test(text)) return "plan";
  if (EXPLAIN_RE.test(text)) return "explain";
  return DEFAULT_CHAT_MODE;
}

/** Extra system directives per mode (appended to agent / compact prompts). */
export function getModeSystemDirective(mode: ChatModeId): string {
  switch (mode) {
    case "plan":
      return `TASK MODE — PLAN MY SEMESTER:
- Build a practical student plan (study, revision, assignments, breaks) using calendar and lecture-week tool data when available.
- Anchor milestones to official activity dates; never invent dates.
- Prefer a clear week-by-week or phase structure with short actionable bullets.
- If a phase needs a label, use a short ## heading above the bullets — never a bullet that is only a title ending with ":".
- If calendar data is partial, say what is missing and still give a useful outline.`;
    case "summarize":
      return `TASK MODE — SUMMARIZE:
- Summarize the user's text into shorter, clear notes.
- Keep key facts, dates, and names; drop filler.
- Use short paragraphs or bullets; do not add unrelated calendar dumps unless the text is about the calendar.
- If the user pasted nothing to summarize, ask them to paste the text.`;
    case "rewrite":
      return `TASK MODE — REWRITE:
- Improve grammar, clarity, tone, and structure of the user's text.
- Preserve meaning; do not invent facts or calendar dates.
- Default to clear academic/professional student English or BM Malaysia matching the user's language.
- If they ask for a presentation script or speaker notes, format accordingly.
- If no text was provided, ask them to paste what to rewrite.`;
    case "translate":
      return `TASK MODE — TRANSLATE:
- Translate naturally between Bahasa Melayu (BM Malaysia, not Indonesian) and English.
- Preserve meaning, names, and official activity titles when present.
- Prefer fluent student-friendly wording over word-for-word calques.
- If direction is unclear, infer from the input language.`;
    case "explain":
      return `TASK MODE — EXPLAIN:
- Explain the topic in simple steps with short examples suited to UiTM students.
- Separate confirmed calendar facts (from tools) from general guidance.
- Avoid jargon; use short paragraphs or numbered steps.
- Mark uncertainty when official data is missing.`;
    case "ask":
    default:
      return "";
  }
}

/** Modes that normally do not need calendar/holiday tools. */
export function modeDisablesTools(mode: ChatModeId): boolean {
  return mode === "rewrite" || mode === "translate";
}

export function modePrefersNoCalendarTools(mode: ChatModeId): boolean {
  return mode === "summarize" || modeDisablesTools(mode);
}
