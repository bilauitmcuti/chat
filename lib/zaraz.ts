/** Configure in Cloudflare dashboard → Zaraz → Google Analytics 4. */
export const GA_MEASUREMENT_ID = "G-D94Q17TQ22";

/** Event names sent via zaraz.track() → GA4 (enable Events automatic action). */
export const ZARAZ_EVENTS = {
  pageview: "Pageview",
  chatMessageSent: "chat_message_sent",
  chatFeedback: "chat_feedback",
  engagementPromptShown: "engagement_prompt_shown",
  engagementRating: "engagement_rating",
  engagementShare: "engagement_share",
  engagementFeedbackClick: "engagement_feedback_click",
} as const;

type ZarazEventName = (typeof ZARAZ_EVENTS)[keyof typeof ZARAZ_EVENTS];
type ZarazEventValue = string | number | boolean | null | undefined;
type ZarazEventProperties = Record<string, ZarazEventValue>;

function getZaraz(): ZarazClient | undefined {
  if (typeof window === "undefined") return undefined;
  return window.zaraz;
}

export function isZarazAvailable(): boolean {
  return typeof getZaraz()?.track === "function";
}

export function trackZarazEvent(
  eventName: ZarazEventName | (string & {}),
  properties?: ZarazEventProperties
): void {
  const zaraz = getZaraz();
  if (!zaraz?.track) return;

  const payload = properties
    ? Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined)
      )
    : undefined;

  void zaraz.track(eventName, payload);
}

/** Virtual pageview for Next.js client navigations (initial load uses Zaraz automatic Pageviews). */
export function trackZarazPageView(path: string): void {
  trackZarazEvent(ZARAZ_EVENTS.pageview, { path });
}
