import { describe, expect, it } from "vitest";

import { resendCodeSchema, verifyCodeSchema } from "@/lib/validation/auth";

describe("verifyCodeSchema", () => {
  const base = { email: "someone@example.com", mode: "signup" as const };

  it("accepts the 8-digit code this project issues", () => {
    expect(verifyCodeSchema.safeParse({ ...base, code: "84725941" }).success).toBe(
      true,
    );
  });

  /**
   * Supabase's OTP length is a project setting. This one issues 8 digits,
   * not the more common 6 — a schema pinned to 6 would reject every real
   * code, and the failure would look like "the code is wrong" rather than
   * "the app is wrong".
   */
  it("accepts other lengths a project might be configured for", () => {
    for (const code of ["123456", "1234567", "1234567890"]) {
      expect(verifyCodeSchema.safeParse({ ...base, code }).success).toBe(true);
    }
  });

  it("strips spaces people paste in", () => {
    const result = verifyCodeSchema.parse({ ...base, code: " 8472 5941 " });
    expect(result.code).toBe("84725941");
  });

  it.each([
    ["too short", "12345"],
    ["too long", "12345678901"],
    ["letters", "8472594a"],
    ["empty", ""],
  ])("rejects a code that is %s", (_label, code) => {
    expect(verifyCodeSchema.safeParse({ ...base, code }).success).toBe(false);
  });

  it("normalises the email like every other auth form", () => {
    const result = verifyCodeSchema.parse({
      email: "  SomeOne@Example.COM ",
      code: "84725941",
      mode: "signup",
    });

    expect(result.email).toBe("someone@example.com");
  });

  it("defaults to signup when no mode is given", () => {
    const result = verifyCodeSchema.parse({
      email: "a@b.com",
      code: "84725941",
    });

    expect(result.mode).toBe("signup");
  });

  it("rejects a mode it does not know", () => {
    // mode decides where the user lands afterwards. An unknown value must
    // fail rather than fall through to a default that sends them somewhere
    // they did not ask to go.
    expect(
      verifyCodeSchema.safeParse({ ...base, code: "84725941", mode: "admin" })
        .success,
    ).toBe(false);
  });
});

describe("resendCodeSchema", () => {
  it("needs a valid address", () => {
    expect(resendCodeSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("accepts both modes", () => {
    for (const mode of ["signup", "recovery"]) {
      expect(
        resendCodeSchema.safeParse({ email: "a@b.com", mode }).success,
      ).toBe(true);
    }
  });
});
