/**
 * One place for every time and date the app renders.
 *
 * Indian conventions throughout: 12-hour clock with am/pm rather than the
 * 24-hour form, and day-month-year dates. "09:12 am" is how someone here
 * would say it; "09:12" is not wrong so much as foreign.
 *
 * Every function takes the timezone explicitly, from the user's profile.
 * Nothing here reads the machine's clock settings — a server in another
 * region must render exactly what the user would see on their own phone.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

/** "09:12 am" */
export function formatTime(
  iso: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!iso) return null;

  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  })
    .format(new Date(iso))
    // Intl gives "AM"/"PM"; lowercase reads better at small sizes and is
    // the common Indian written form.
    .replace(/\s?(AM|PM)$/i, (_, meridiem: string) => ` ${meridiem.toLowerCase()}`);
}

/** "Thu, 20 Aug" */
export function formatShortDate(
  value: string | Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** "20 Aug 2026" */
export function formatFullDate(
  value: string | Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Formats a plain calendar date column such as attendance_date.
 *
 * These are dates, not instants: shifting "2026-08-20" into a timezone can
 * move it to the 19th or the 21st, so it is read back as UTC.
 */
export function formatCalendarDate(dateOnly: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

/** The hour of day, for greetings. */
export function getHour(
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now),
  );
}

/** Today as YYYY-MM-DD in the given timezone, matching a date column. */
export function getTodayInTimezone(
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): string {
  // en-CA is the shortest way to get ISO-shaped output from Intl.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}
