import type { MetadataRoute } from "next";

/** Block crawlers from API and chat endpoints; page indexing is controlled via layout metadata. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/chat/api",
        "/chat/feedback/",
      ],
    },
  };
}
