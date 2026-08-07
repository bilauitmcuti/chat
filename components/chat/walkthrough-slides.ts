export type WalkthroughPreviewKind =
  | "chat"
  | "suggestions"
  | "composer"
  | "models";

export interface WalkthroughSlide {
  title: string;
  description: string;
  preview: WalkthroughPreviewKind;
}

export const WALKTHROUGH_SLIDES: readonly WalkthroughSlide[] = [
  {
    title: "Ask Bila about your calendar",
    description:
      "UiTM academic dates and Malaysia public holidays — ask in plain language.",
    preview: "chat",
  },
  {
    title: "What Bila can answer",
    description:
      "Lecture weeks, exams, semester breaks, deadlines, and state public holidays. Tap a suggestion to try.",
    preview: "suggestions",
  },
  {
    title: "Pick your programme",
    description:
      "Choose programme and session in the composer. Type @ to mention another session calendar.",
    preview: "composer",
  },
  {
    title: "Choose an AI model",
    description:
      "Pick a model in the composer. Gemma 4 is best for calendars, Llama/Mistral are faster, Nemotron is stronger at reasoning.",
    preview: "models",
  },
] as const;

export const WALKTHROUGH_LABEL_SKIP = "Skip";
export const WALKTHROUGH_LABEL_NEXT = "Next";
export const WALKTHROUGH_LABEL_FINISH = "Ask Bila";
