export const SITE_ORIGIN = "https://chat.bilauitmcuti.com";

export const CHAT_SEO_TITLE = "Chat — Bila UiTM Cuti";
export const CHAT_SEO_DESCRIPTION =
  "Tanya soalan kalendar akademik UiTM dengan pembantu AI. Semak tarikh cuti, pendaftaran, kuliah, dan peperiksaan.";

/** Kept for any leftover imports; chat-only site has a single page. */
export const HOMEPAGE_SEO_TITLE = CHAT_SEO_TITLE;
export const HOMEPAGE_SEO_DESCRIPTION = CHAT_SEO_DESCRIPTION;

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
