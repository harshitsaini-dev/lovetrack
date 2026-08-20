import { z } from "zod";

/**
 * Auth input schemas. These run on BOTH the client (instant feedback) and
 * the server (the only place validation actually counts).
 */

const email = z
  .string()
  .trim()
  .min(1, "Email daalna zaroori hai")
  .email("Sahi email address daalein")
  .max(254, "Email bahut lamba hai")
  .toLowerCase();

const password = z
  .string()
  .min(8, "Password kam se kam 8 characters ka ho")
  .max(72, "Password 72 characters se lamba nahi ho sakta") // bcrypt limit
  .regex(/[a-z]/, "Ek lowercase letter zaroori hai")
  .regex(/[A-Z]/, "Ek uppercase letter zaroori hai")
  .regex(/[0-9]/, "Ek number zaroori hai");

export const loginSchema = z.object({
  email,
  // Login must not re-apply strength rules — an old weak password
  // should still be able to sign in (and reveal nothing about policy).
  password: z.string().min(1, "Password daalna zaroori hai"),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Naam kam se kam 2 characters ka ho")
      .max(80, "Naam bahut lamba hai"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Dono passwords match nahi kar rahe",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

/**
 * The emailed verification code.
 *
 * Length is not pinned to a number here on purpose — Supabase's OTP length
 * is a project setting, and this one issues 8 digits rather than the more
 * common 6. Hardcoding 6 would reject every real code.
 */
export const verifyCodeSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    // People paste codes with a stray space in the middle.
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d{6,10}$/, "Code sirf 6-10 digits ka hota hai"),
    ),
  /** Signup confirmation, or a password reset. */
  mode: z.enum(["signup", "recovery"]).default("signup"),
});

export const resendCodeSchema = z.object({
  email,
  mode: z.enum(["signup", "recovery"]).default("signup"),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Dono passwords match nahi kar rahe",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type ResendCodeInput = z.infer<typeof resendCodeSchema>;
