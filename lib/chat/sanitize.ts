export function sanitizeMessage(message: string): string {
  return message
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "")
    .replace(/ignore\s+(all\s+)?above\s+instructions/gi, "")
    .replace(/disregard\s+(all\s+)?previous/gi, "")
    .replace(/you\s+are\s+now\s+/gi, "")
    .replace(/new\s+instructions?\s*:/gi, "")
    .replace(/system\s*:/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<\|im_start\|>/gi, "")
    .replace(/<\|im_end\|>/gi, "")
    .trim();
}

const PLANNING_LINE =
  /^(User Question|Language|Context|Selected Session|Today'?s Date|Header|Content|Format|Answer format|Peperiksaan\/Penilaian|Reasoning|Mode|FACT|EXPLAIN|OPINION|OPNION|SUGGESTION|CADANGAN):/i;

/** Internal answer-mode tags models sometimes echo from the system prompt. */
const INTERNAL_MODE_TAG =
  /\((?:FACT|EXPLAIN|OPINION|OPNION|SUGGESTION|CADANGAN|REASONING|GUIDANCE)\)\s*/gi;

/** Pull user-visible answer when Gemma/reasoning models leak planning text. */
export function extractFinalAnswerFromPlanning(raw: string): string | null {
  const answerMatch = /\b(?:Answer|Jawapan):\s*([\s\S]+?)(?=\n(?:Language|Header|Context|User Question|\- No )|$)/i.exec(
    raw
  );
  if (answerMatch?.[1]) {
    const tail = answerMatch[1]
      .trim()
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^(Yes|No)\.?\s*$/gim, "")
      .trim();
    if (tail.length >= 8) return tail;
  }

  const groupBlock = /Group [AB][^\n]*:\s*\n+([^\n]+(?:\n(?!Language:|Header:|Context:|User Question:)[^\n]+)*)/i.exec(
    raw
  );
  if (groupBlock?.[1]) {
    const body = groupBlock[1].trim();
    if (body.length >= 8 && !PLANNING_LINE.test(body.split("\n")[0] ?? "")) {
      return body;
    }
  }

  return null;
}

const LATEX_SYMBOLS: Record<string, string> = {
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  to: "→",
  gets: "←",
  cdots: "…",
  ldots: "…",
  times: "×",
  pm: "±",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  approx: "≈",
};

/** Models sometimes emit LaTeX ($\\rightarrow$, etc.) despite plain-text prompts. */
export function normalizeLatexArtifacts(text: string): string {
  let out = text;
  for (const [cmd, symbol] of Object.entries(LATEX_SYMBOLS)) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`\\$\\s*\\\\?${escaped}\\s*\\$`, "gi"),
      symbol
    );
    out = out.replace(new RegExp(`\\\\${escaped}(?![a-zA-Z])`, "g"), symbol);
  }
  out = out.replace(/\$([^$\n]+)\$/g, (_, inner: string) => {
    const trimmed = inner.trim();
    const cmdMatch = /^\\+([a-zA-Z]+)/.exec(trimmed);
    if (cmdMatch) {
      const mapped = LATEX_SYMBOLS[cmdMatch[1]!];
      if (mapped) return mapped;
      return cmdMatch[1]!;
    }
    return trimmed.replace(/[{}]/g, "");
  });
  return out.replace(/\\text\{([^}]*)\}/g, "$1");
}

export function cleanAiReply(rawReply: string): string {
  const fromPlanning = extractFinalAnswerFromPlanning(rawReply);
  const source = fromPlanning ?? rawReply;

  const internalFields = [
    "type",
    "startDate",
    "endDate",
    "programType",
    "programTypes",
    "group",
    "details",
    "duration",
    "allStudents",
    "regionalStartDate",
    "regionalEndDate",
  ].join("|");

  const withoutPlanningLines = source
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (PLANNING_LINE.test(t)) return false;
      if (/^(Yes|No)\.?\s*$/i.test(t)) return false;
      if (/^- No "/i.test(t)) return false;
      return true;
    })
    .join("\n");

  const cleaned = normalizeLatexArtifacts(withoutPlanningLines)
    .replace(INTERNAL_MODE_TAG, "")
    .replace(/\((?:PAST|NOW|UPCOMING)\)\s*/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[\s]*\*\s/gm, "- ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~/g, "")
    .replace(new RegExp(`\\|\\s*(?:${internalFields})\\s*:\\s*[^|\\n]+`, "gi"), "")
    .replace(new RegExp(`["'](?:${internalFields})["']\\s*:\\s*["'][^"']+["']`, "gi"), "")
    .replace(/[ \t]*[,;][ \t]*(?=\n|$)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}
