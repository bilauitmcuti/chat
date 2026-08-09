/** Canonical origin — SEO consolidates here (subdomain), even for apex /chat. */
export const SITE_ORIGIN = "https://chat.bilauitmcuti.com";

/** Apex origin serving the chat UI under the /chat path route. */
export const APEX_ORIGIN = "https://bilauitmcuti.com";

/** Path the chat UI is served under on the apex host. */
export const CHAT_PATH = "/chat";

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
 * Per-host OG targets. Apex serves the UI at /chat, subdomain at root. Keeps social
 * previews self-referential (same-origin image, matching og:url) so link unfurls work
 * on both hosts. Canonical stays on SITE_ORIGIN regardless (see alternates.canonical).
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
      url: SITE_ORIGIN,
      description: CHAT_SEO_DESCRIPTION,
    },
  ];
}
