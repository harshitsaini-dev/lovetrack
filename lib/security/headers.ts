/**
 * Security headers.
 *
 * Built per-request so the Content-Security-Policy can carry a fresh
 * nonce. A CSP with `script-src 'unsafe-inline'` is close to decorative —
 * it blocks almost nothing an attacker who can inject markup would want to
 * do — so the nonce is the part that makes this worth having.
 *
 * Every source list below is there for a specific reason, noted inline.
 * A CSP nobody can explain is one that gets widened at the first bug
 * report until it permits everything.
 */

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Next.js hydration needs this for inline bootstrap scripts that
      // carry the nonce; browsers that honour the nonce ignore it.
      "'strict-dynamic'",
      // Turbopack's dev runtime compiles on the fly.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // Tailwind emits a style element, and Leaflet sets inline styles on
    // every tile and marker it positions. There is no nonce path for the
    // latter, and inline styles are a far smaller risk than inline script.
    "style-src": ["'self'", "'unsafe-inline'"],

    "img-src": [
      "'self'",
      // Camera frames are object URLs; avatars come back as data URLs
      // while they upload.
      "blob:",
      "data:",
      // OpenStreetMap tiles.
      "https://tile.openstreetmap.org",
      // Supabase Storage serves avatars and signed media.
      SUPABASE_ORIGIN,
    ].filter(Boolean),

    // Recorded lunch clips are played back from a blob before upload.
    "media-src": ["'self'", "blob:", SUPABASE_ORIGIN].filter(Boolean),

    "connect-src": [
      "'self'",
      SUPABASE_ORIGIN,
      // Supabase realtime, if it is ever switched on.
      SUPABASE_ORIGIN.replace("https://", "wss://"),
      ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
    ].filter(Boolean),

    "font-src": ["'self'", "data:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],

    // Nothing here is meant to be embedded, and nothing embeds anything.
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Forms post back to us. Without this, injected markup could post a
    // password field somewhere else entirely.
    "form-action": ["'self'"],
  };

  const csp = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  // Only meaningful over HTTPS, and it would break the dev server.
  return isDev ? csp : `${csp}; upgrade-insecure-requests`;
}

export function securityHeaders(nonce: string, isDev: boolean) {
  return {
    "Content-Security-Policy": buildCsp(nonce, isDev),

    /*
     * The one that matters most for this app. LoveTrack asks for camera,
     * microphone and location; everything else is switched off outright,
     * so a compromised dependency cannot quietly reach for a sensor the
     * product never uses.
     */
    "Permissions-Policy": [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=(self)",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "midi=()",
      "serial=()",
      "hid=()",
      "display-capture=()",
      "screen-wake-lock=()",
      "idle-detection=()",
      "local-fonts=()",
      "interest-cohort=()",
    ].join(", "),

    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",

    // Send the origin to other sites, never the path. A LoveTrack URL can
    // contain a partner's id.
    "Referrer-Policy": "strict-origin-when-cross-origin",

    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",

    ...(isDev
      ? {}
      : {
          "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        }),
  };
}
