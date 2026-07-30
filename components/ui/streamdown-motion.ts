/** Word-by-word blur while the assistant reply streams in. */
export const CHAT_STREAM_ANIMATION = {
  animation: "blurIn",
  duration: 80,
  easing: "ease-out",
  sep: "word",
} as const;

/** Faster blurIn for Copy / thumbs after the answer stream completes. */
export const CHAT_ACTION_APPEAR = {
  durationMs: 150,
  staggerMs: 30,
} as const;
