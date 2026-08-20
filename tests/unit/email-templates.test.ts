import { describe, expect, it } from "vitest";

import {
  passwordResetCodeEmail,
  verificationCodeEmail,
} from "@/lib/email/templates";

const CODE = "84725941";

describe("code emails", () => {
  /**
   * The one that matters most.
   *
   * `sendEmail` writes every subject line to `email_logs`, and admins can
   * read that table from `/admin/emails`. A code in the subject would let
   * any admin read a password-reset code and take over the account — a
   * silent privilege escalation that leaves the victim no trace beyond a
   * password that stopped working. The body is never stored, so the code
   * belongs there and nowhere else.
   */
  it.each([
    ["verification", verificationCodeEmail(null, CODE, 60)],
    ["password reset", passwordResetCodeEmail(null, CODE, 60)],
  ])("keeps the %s code out of the subject", (_label, email) => {
    expect(email.subject).not.toContain(CODE);
    expect(email.subject).not.toMatch(/\d{4,}/);
  });

  it.each([
    ["verification", verificationCodeEmail("Harshit Saini", CODE, 60)],
    ["password reset", passwordResetCodeEmail("Harshit Saini", CODE, 60)],
  ])("puts the %s code in both HTML and text parts", (_label, email) => {
    // A meaningful share of readers see the text alternative only.
    expect(email.html).toContain(CODE);
    expect(email.text).toContain(CODE);
  });

  it("greets by first name only", () => {
    const email = verificationCodeEmail("Harshit Saini", CODE, 60);

    expect(email.html).toContain("Harshit");
    expect(email.html).not.toContain("Harshit Saini");
  });

  it("still reads properly with no name on file", () => {
    const email = verificationCodeEmail(null, CODE, 60);

    expect(email.html).not.toContain("null");
    expect(email.text).not.toContain("null");
  });

  it("states how long the code lasts", () => {
    expect(verificationCodeEmail(null, CODE, 60).text).toContain("60 minute");
  });

  it("tells an unexpecting recipient they can ignore it", () => {
    // Anyone can type someone else's address into the reset form, so this
    // email reaches people who did not ask for it. It has to say that
    // nothing happens if they do nothing.
    const reset = passwordResetCodeEmail(null, CODE, 60);

    expect(reset.html).toMatch(/ignore/i);
    expect(reset.html).toMatch(/password waisa hi rahega/i);
  });

  it("does not carry a clickable action link", () => {
    // The whole point of moving to codes: no URL for a mail scanner to
    // fetch and consume before the reader gets there.
    const email = verificationCodeEmail(null, CODE, 60);

    expect(email.html).not.toMatch(/<a[^>]+href/i);
  });
});
