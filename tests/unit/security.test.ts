import { describe, expect, it } from "vitest";

import { buildCsp, securityHeaders } from "@/lib/security/headers";
import { getChallenge, getLunchVideoChallenge } from "@/lib/attendance/challenge";

describe("buildCsp", () => {
  const nonce = "abc123def456";

  it("carries the nonce", () => {
    expect(buildCsp(nonce, false)).toContain(`'nonce-${nonce}'`);
  });

  /**
   * The single most important assertion here. A CSP that allows inline
   * script blocks almost nothing an attacker who can inject markup wants
   * to do — it looks like protection while providing very little.
   */
  it("never allows unsafe-inline in script-src", () => {
    for (const isDev of [true, false]) {
      const scriptSrc = buildCsp(nonce, isDev).match(/script-src[^;]*/)?.[0];
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  });

  it("allows unsafe-eval only in development", () => {
    expect(buildCsp(nonce, true)).toContain("'unsafe-eval'");
    expect(buildCsp(nonce, false)).not.toContain("'unsafe-eval'");
  });

  it("refuses framing and plugins outright", () => {
    const csp = buildCsp(nonce, false);

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Without this, injected markup could post a password field elsewhere.
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("permits the sources the app actually uses", () => {
    const csp = buildCsp(nonce, false);

    // Camera frames and recorded clips are object URLs before upload.
    expect(csp).toMatch(/img-src[^;]*blob:/);
    expect(csp).toMatch(/media-src[^;]*blob:/);
    // Map tiles.
    expect(csp).toContain("https://tile.openstreetmap.org");
  });

  it("upgrades insecure requests only in production", () => {
    expect(buildCsp(nonce, false)).toContain("upgrade-insecure-requests");
    expect(buildCsp(nonce, true)).not.toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  it("allows the three sensors the app uses and no others", () => {
    const perms = securityHeaders("n", false)["Permissions-Policy"];

    for (const allowed of ["camera=(self)", "microphone=(self)", "geolocation=(self)"]) {
      expect(perms).toContain(allowed);
    }

    // A compromised dependency should not be able to reach for a sensor
    // the product never asks for.
    for (const denied of ["accelerometer=()", "usb=()", "payment=()", "display-capture=()"]) {
      expect(perms).toContain(denied);
    }
  });

  it("sends HSTS in production only", () => {
    expect(securityHeaders("n", false)["Strict-Transport-Security"]).toBeDefined();
    expect(securityHeaders("n", true)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("never sends a full URL as a referrer to another site", () => {
    // A LoveTrack path can contain a partner's id.
    expect(securityHeaders("n", false)["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});

describe("getChallenge", () => {
  it("greets the partner by name", () => {
    const challenge = getChallenge("check_in", "Priya Sharma");

    expect(challenge.overlay).toBe("Hello, Priya");
    expect(challenge.instruction).toContain("Hello, Priya");
  });

  it("uses only the first name", () => {
    expect(getChallenge("check_in", "Priya Sharma Verma").overlay).toBe(
      "Hello, Priya",
    );
  });

  it("still works with nobody to greet", () => {
    // Before a pairing exists, the prompt must not read "Hello, null".
    for (const name of [null, "", "   "]) {
      expect(getChallenge("check_in", name).overlay).toBe("Hello");
    }
  });

  /**
   * Lunch in and lunch out take no photo — the clip recorded between them
   * is the proof for that stretch — so there is no camera to speak into
   * and the prompt must not ask for a phrase that cannot be said.
   */
  it.each(["lunch_start", "lunch_end"] as const)(
    "asks %s for location only, not a spoken phrase",
    (eventType) => {
      const challenge = getChallenge(eventType, "Priya");

      expect(challenge.instruction).toMatch(/photo nahi/i);
      expect(challenge.instruction).not.toMatch(/bolein/i);
      expect(challenge.overlay).not.toContain("Priya");
    },
  );

  it("still asks for food on the lunch video", () => {
    expect(getLunchVideoChallenge("Priya").overlay).toContain("Khana khalo, Priya");
  });

  it("tells the user to record while eating", () => {
    expect(getLunchVideoChallenge("Priya").instruction).toContain(
      "Khana khate hue video banayein",
    );
  });
});
