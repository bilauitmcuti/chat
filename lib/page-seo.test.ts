import { describe, expect, it } from "vitest";
import {
  buildSiteNavigationSchemaElements,
  CHAT_SEO_DESCRIPTION,
  CHAT_SEO_TITLE,
  SITE_ORIGIN,
} from "./page-seo";

describe("buildSiteNavigationSchemaElements", () => {
  it("includes the chat home page", () => {
    const parts = buildSiteNavigationSchemaElements();
    expect(parts).toHaveLength(1);
    expect(parts[0]?.url).toBe(SITE_ORIGIN);
    expect(parts[0]?.name).toBe(CHAT_SEO_TITLE);
    expect(parts[0]?.description).toBe(CHAT_SEO_DESCRIPTION);
  });
});
