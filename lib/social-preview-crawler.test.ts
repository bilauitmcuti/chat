import { describe, expect, it } from "vitest";
import { isSocialPreviewCrawler } from "./social-preview-crawler";

describe("isSocialPreviewCrawler", () => {
  it("detects common link-preview fetchers", () => {
    expect(isSocialPreviewCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isSocialPreviewCrawler("Twitterbot/1.0")).toBe(true);
    expect(isSocialPreviewCrawler("WhatsApp/2.23.20.8")).toBe(true);
    expect(isSocialPreviewCrawler("Discordbot/2.0")).toBe(true);
  });

  it("does not treat normal browsers as preview crawlers", () => {
    expect(
      isSocialPreviewCrawler(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });
});
