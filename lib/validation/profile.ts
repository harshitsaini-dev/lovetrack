import { z } from "zod";

/** IANA timezone names the settings UI offers. */
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;

/** Postgres `time` accepts HH:MM; inputs give us exactly that. */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Sahi time chunein (HH:MM)");

export const profileSettingsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Naam kam se kam 2 characters ka ho")
    .max(80, "Naam bahut lamba hai"),
  timezone: z.enum(TIMEZONES),
  checkInReminderTime: timeOfDay,
  checkOutReminderTime: timeOfDay,
  notifyCheckIn: z.boolean(),
  notifyLunch: z.boolean(),
  notifyCheckOut: z.boolean(),
  notifyLeave: z.boolean(),
  notifyReminder: z.boolean(),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

/** Same strength rules as registration — one definition, one behaviour. */
const strongPassword = z
  .string()
  .min(8, "Password kam se kam 8 characters ka ho")
  .max(72, "Password 72 characters se lamba nahi ho sakta")
  .regex(/[a-z]/, "Ek lowercase letter zaroori hai")
  .regex(/[A-Z]/, "Ek uppercase letter zaroori hai")
  .regex(/[0-9]/, "Ek number zaroori hai");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password daalein"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Dono passwords match nahi kar rahe",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Naya password purane se alag hona chahiye",
    path: ["password"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** `checkbox` inputs are absent from FormData when unticked. */
export function checkboxToBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

/** Postgres returns "20:30:00"; `<input type="time">` wants "20:30". */
export function toTimeInputValue(dbTime: string): string {
  return dbTime.slice(0, 5);
}
