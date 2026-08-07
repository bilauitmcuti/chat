export const WALKTHROUGH_SEEN_STORAGE_KEY = "buc-chat-walkthrough-seen";

export function readWalkthroughSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(WALKTHROUGH_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeWalkthroughSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WALKTHROUGH_SEEN_STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
