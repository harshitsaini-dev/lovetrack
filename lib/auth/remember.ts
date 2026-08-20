/**
 * "Remember me" support.
 *
 * Supabase issues persistent auth cookies by default, so staying signed in
 * is the built-in behaviour. What this adds is the opposite: when the box
 * is unticked, the auth cookies are written WITHOUT `maxAge`/`expires`,
 * which makes them session cookies that the browser drops when it closes.
 *
 * That matters on a shared or borrowed device, where "stay signed in" is
 * exactly what someone does not want.
 */

export const REMEMBER_COOKIE = "lt-remember";

/** A year. Long enough to feel permanent, short enough to eventually expire. */
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365;

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  [key: string]: unknown;
};

/**
 * Adjusts Supabase's cookie options to honour the user's choice.
 *
 * Called from every place that writes auth cookies — the server client and
 * the proxy — because a refresh must not silently upgrade a session cookie
 * into a persistent one.
 */
export function applyRememberPreference<T extends CookieOptions | undefined>(
  options: T,
  remember: boolean,
): T {
  if (remember) return options;

  const next = { ...(options ?? {}) } as CookieOptions;

  // Removing both is what turns it into a session cookie; leaving either
  // one behind would keep it on disk.
  delete next.maxAge;
  delete next.expires;

  return next as T;
}

export function rememberCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  };
}

/** Absent means "remembered", so existing sessions are unaffected. */
export function parseRemember(value: string | undefined): boolean {
  return value !== "0";
}
