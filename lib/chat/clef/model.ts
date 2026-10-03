/** Decision helper — not a composer picker model. */
export const CHAT_MODEL_CLEF = "@cf/cloudflare/clef" as const;
export const CLEF_MODEL_SELECTOR = "clef" as const;

export const CLEF_TOPIC_CONFIDENCE = 0.55;
export const CLEF_INTENT_CONFIDENCE = 0.6;
export const CLEF_NOUL_THRESHOLD = 0.55;
export const CLEF_LANGUAGE_CONFIDENCE = 0.55;
export const CLEF_TIMEOUT_MS = 2500;

/** On by default. Set `CHAT_USE_CLEF=0` or `false` to skip the decision call. */
export function isClefUnderstandingEnabled(): boolean {
  const raw = process.env.CHAT_USE_CLEF?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}
