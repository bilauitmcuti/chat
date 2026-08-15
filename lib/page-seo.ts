/** Chat Worker custom domain — favicons and Worker-only assets. */
export const SITE_ORIGIN = "https://chat.bilauitmcuti.com";

/** Apex origin serving the chat UI under the /chat path route. */
export const APEX_ORIGIN = "https://bilauitmcuti.com";

/** Path the chat UI is served under on the apex host. */
export const CHAT_PATH = "/chat";

/** Public crawl/share URL — OG, canonical, and JSON-LD consolidate here (not the subdomain). */
export const CHAT_SHARE_URL = `${APEX_ORIGIN}${CHAT_PATH}`;

/** OG image on apex; `bilauitmcuti.com/chat*` already routes `/chat.png` to this Worker. */
export const CHAT_OG_IMAGE_URL = `${APEX_ORIGIN}/chat.png`;

export interface SeoTargets {
  /** metadataBase — relative OG/twitter images resolve same-origin as the served host. */
  origin: string;
  /** Self-referential public URL of the page (og:url). */
  shareUrl: string;
}

function normalizeSeoHost(host?: string | null): string {
  return (host ?? "").replace(/^www\./, "").split(":")[0].toLowerCase();
}

/**
 * Per-host asset origin vs share URL. Crawl tags should use CHAT_SHARE_URL (apex /chat),
 * not the subdomain. This helper remains for host-specific asset resolution.
 */
export function resolveSeoTargets(host?: string | null): SeoTargets {
  const normalized = normalizeSeoHost(host);
  if (normalized === "bilauitmcuti.com") {
    return { origin: APEX_ORIGIN, shareUrl: `${APEX_ORIGIN}${CHAT_PATH}` };
  }
  return { origin: SITE_ORIGIN, shareUrl: SITE_ORIGIN };
}

export const CHAT_SEO_TITLE = "Chat - Bila UiTM Cuti";
export const CHAT_SEO_DESCRIPTION =
  "Tanya soalan kalendar akademik UiTM dengan pembantu AI. Semak tarikh cuti, pendaftaran, kuliah, dan peperiksaan.";

export function buildSiteNavigationSchemaElements() {
  return [
    {
      "@type": "WebPage" as const,
      name: CHAT_SEO_TITLE,
      url: CHAT_SHARE_URL,
      description: CHAT_SEO_DESCRIPTION,
    },
  ];
}
