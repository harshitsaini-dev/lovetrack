import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`.
 * Runs on every request to keep the Supabase session cookie fresh and to
 * gate protected routes.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files, so the auth cookie
     * stays fresh without burning work on asset requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|ico)$).*)",
  ],
};
