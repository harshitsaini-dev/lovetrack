import type { NextRequest } from "next/server";

import { securityHeaders } from "@/lib/security/headers";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`.
 *
 * Two jobs: keep the Supabase session cookie fresh and gate protected
 * routes, then attach the security headers. The headers are set here
 * rather than in next.config so the CSP can carry a per-request nonce —
 * a static CSP would need `unsafe-inline`, which makes it close to
 * decorative.
 */
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // Next reads this header to stamp the nonce onto the scripts it injects.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);

  for (const [key, value] of Object.entries(securityHeaders(nonce, isDev))) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files, so the auth cookie
     * stays fresh without burning work on asset requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|ico)$).*)",
  ],
};
