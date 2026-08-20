import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/supabase/env";

/**
 * Generated at /robots.txt.
 *
 * The important part here is what is DISALLOWED. LoveTrack is a private
 * app: everything behind sign-in is somebody's attendance, location and
 * photographs. None of it should ever reach a search index, and the auth
 * callback routes carry one-time tokens that must not be crawled at all.
 *
 * Only the pages that exist to explain the product are open — the landing
 * page and the two ways in.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/forgot-password"],
        disallow: [
          "/app/", // every signed-in page
          "/admin/", // the admin panel
          "/auth/", // profile-repair route
          "/verify", // carries an email address in the query string
          "/reset-password",
          "/suspended",
          "/forbidden",
          "/offline",
          "/api/",
        ],
      },
      {
        // Training crawlers get nothing. There is no upside for the people
        // whose data this app holds.
        userAgent: ["GPTBot", "CCBot", "ClaudeBot", "Google-Extended"],
        disallow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
