/** User-agent patterns for link-preview fetchers (OG/Twitter cards). Not general SEO bots. */
const SOCIAL_PREVIEW_CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "whatsapp",
  "linkedinbot",
  "discordbot",
  "slackbot",
  "telegrambot",
  "pinterest",
  "embedly",
  "quora link preview",
  "vkshare",
  "redditbot",
  "iframely",
  "skypeuripreview",
];

export function isSocialPreviewCrawler(userAgent: string): boolean {
  const lower = userAgent.toLowerCase();
  return SOCIAL_PREVIEW_CRAWLER_PATTERNS.some((pattern) => lower.includes(pattern));
}
