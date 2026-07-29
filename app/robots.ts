import type { MetadataRoute } from "next";

/** Site is temporarily noindex — reopen indexing later via layout metadata + allow rules. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
