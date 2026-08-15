import { describe, expect, it } from "vitest";
import {
  APEX_ORIGIN,
  buildSiteNavigationSchemaElements,
  CHAT_OG_IMAGE_URL,
  CHAT_SEO_DESCRIPTION,
  CHAT_SEO_TITLE,
  CHAT_SHARE_URL,
  resolveSeoTargets,
  SITE_ORIGIN,
} from "./page-seo";

describe("buildSiteNavigationSchemaElements", () => {
  it("includes the chat home page", () => {
    const parts = buildSiteNavigationSchemaElements();
    expect(parts).toHaveLength(1);
    expect(parts[0]?.url).toBe(`${APEX_ORIGIN}/chat`);
    expect(parts[0]?.name).toBe(CHAT_SEO_TITLE);
    expect(parts[0]?.description).toBe(CHAT_SEO_DESCRIPTION);
  });
});

describe("apex crawl URLs", () => {
  it("points share and OG image at bilauitmcuti.com, not the chat subdomain", () => {
    expect(CHAT_SHARE_URL).toBe("https://bilauitmcuti.com/chat");
    expect(CHAT_OG_IMAGE_URL).toBe("https://bilauitmcuti.com/chat.png");
  });
});

describe("resolveSeoTargets", () => {
  it("uses the subdomain origin and root share url by default", () => {
    expect(resolveSeoTargets("chat.bilauitmcuti.com")).toEqual({
      origin: SITE_ORIGIN,
      shareUrl: SITE_ORIGIN,
    });
  });

  it("resolves the apex host to a self-referential /chat share url", () => {
    expect(resolveSeoTargets("bilauitmcuti.com")).toEqual({
      origin: APEX_ORIGIN,
      shareUrl: `${APEX_ORIGIN}/chat`,
    });
  });

  it("treats the www apex host like the apex", () => {
    expect(resolveSeoTargets("www.bilauitmcuti.com")).toEqual({
      origin: APEX_ORIGIN,
      shareUrl: `${APEX_ORIGIN}/chat`,
    });
  });

  it("ignores port and casing, and falls back to the subdomain when host is missing", () => {
    expect(resolveSeoTargets("BILAUITMCUTI.COM:443").origin).toBe(APEX_ORIGIN);
    expect(resolveSeoTargets(null)).toEqual({
      origin: SITE_ORIGIN,
      shareUrl: SITE_ORIGIN,
    });
  });
});
