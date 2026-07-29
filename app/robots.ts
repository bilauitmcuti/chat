import type { MetadataRoute } from "next";

const baseUrl = "https://chat.bilauitmcuti.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/chat/api", "/chat/feedback/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
