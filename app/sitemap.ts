import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/supabase/env";

/**
 * Generated at /sitemap.xml.
 *
 * Only the public pages. Listing anything behind sign-in would invite
 * crawlers to try URLs that hold other people's records — pointless, since
 * they would be redirected, and a map of the private surface either way.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const lastModified = new Date();

  return [
    {
      url: base,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/register`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
