import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import {
  changePasswordSchema,
  checkboxToBoolean,
  profileSettingsSchema,
  toTimeInputValue,
} from "@/lib/validation/profile";

describe("loginSchema", () => {
  /**
   * Login deliberately does NOT apply the strength rules. Someone whose
   * password predates a policy change must still be able to sign in — and
   * rejecting it on the login form would also advertise what the policy is.
   */
  it("accepts a weak password", () => {
    const result = loginSchema.safeParse({
      email: "someone@example.com",
      password: "short",
    });

    expect(result.success).toBe(true);
  });

  it("normalises the email", () => {
    const result = loginSchema.parse({
      email: "  SomeOne@Example.COM  ",
      password: "whatever",
    });

    expect(result.email).toBe("someone@example.com");
  });

  it("still requires something in the password field", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Harshit Saini",
    email: "harshit@example.com",
    password: "GoodPass123",
    confirmPassword: "GoodPass123",
  };

  it("accepts a sound registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["too short", "Ab1"],
    ["no uppercase", "lowercase123"],
    ["no lowercase", "UPPERCASE123"],
    ["no digit", "NoDigitsHere"],
  ])("rejects a password that is %s", (_label, password) => {
    const result = registerSchema.safeParse({
      ...valid,
      password,
      confirmPassword: password,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a mismatch, and points at the confirm field", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "DifferentPass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });

  it("caps the password at bcrypt's limit", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: `A1${"a".repeat(80)}`,
      confirmPassword: `A1${"a".repeat(80)}`,
    });

    // Beyond 72 bytes bcrypt silently ignores the rest, so a longer
    // password is not the stronger one the user thinks it is.
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("refuses a new password identical to the current one", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "SamePass123",
      password: "SamePass123",
      confirmPassword: "SamePass123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a genuine change", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "OldPass123",
        password: "NewPass456",
        confirmPassword: "NewPass456",
      }).success,
    ).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("applies the same strength rules as registration", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "weak",
        confirmPassword: "weak",
      }).success,
    ).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects something that is not an address", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });
});

describe("profileSettingsSchema", () => {
  const valid = {
    fullName: "Harshit",
    timezone: "Asia/Kolkata" as const,
    reminderTime: "20:30",
    notifyCheckIn: true,
    notifyLunch: false,
    notifyCheckOut: true,
    notifyLeave: true,
    notifyReminder: true,
  };

  it("accepts sound settings", () => {
    expect(profileSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["25:00", "20:60", "8:30", "2030", ""])(
    "rejects %s as a time",
    (reminderTime) => {
      expect(
        profileSettingsSchema.safeParse({ ...valid, reminderTime }).success,
      ).toBe(false);
    },
  );

  it("rejects a timezone that is not on the list", () => {
    expect(
      profileSettingsSchema.safeParse({ ...valid, timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
  });

  it("accepts the boundaries of the day", () => {
    for (const reminderTime of ["00:00", "23:59"]) {
      expect(
        profileSettingsSchema.safeParse({ ...valid, reminderTime }).success,
      ).toBe(true);
    }
  });
});

describe("checkboxToBoolean", () => {
  /** An unticked checkbox is absent from FormData, not false. */
  it("treats absence as false", () => {
    expect(checkboxToBoolean(null)).toBe(false);
  });

  it("treats the browser's 'on' as true", () => {
    expect(checkboxToBoolean("on")).toBe(true);
    expect(checkboxToBoolean("true")).toBe(true);
  });
});

describe("toTimeInputValue", () => {
  it("drops the seconds Postgres adds", () => {
    expect(toTimeInputValue("20:30:00")).toBe("20:30");
  });
});
