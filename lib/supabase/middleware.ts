import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  applyRememberPreference,
  parseRemember,
  REMEMBER_COOKIE,
} from "@/lib/auth/remember";

import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/app", "/admin"];

/** Auth routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * route-level auth. Admin *authorization* is enforced separately in the
 * admin layout and by RLS — middleware only checks authentication.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  // Forwarding the headers lets the proxy pass a CSP nonce through to the
  // render, so Next can stamp it onto the scripts it injects.
  const init = requestHeaders
    ? { request: { headers: requestHeaders } }
    : { request };

  let response = NextResponse.next(init);

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Honour "remember me" here too: this runs on every request, so
          // a refresh must not turn a session cookie into a persistent one.
          const remember = parseRemember(
            request.cookies.get(REMEMBER_COOKIE)?.value,
          );

          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next(init);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(
              name,
              value,
              applyRememberPreference(options, remember),
            );
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase. Do NOT use getSession()
  // here — it trusts the cookie without verifying it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/app/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
