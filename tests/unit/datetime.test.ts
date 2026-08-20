import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatShortDate,
  formatTime,
  getHour,
  getTodayInTimezone,
} from "@/lib/format/datetime";

/**
 * Timezone handling is where this app is easiest to get quietly wrong: the
 * bug does not throw, it just puts an event on the wrong day for somebody
 * in another country.
 */

describe("formatTime", () => {
  it("uses a 12-hour clock with am/pm", () => {
    // 09:12 UTC is 14:42 in Kolkata.
    expect(formatTime("2026-08-20T09:12:00Z", "Asia/Kolkata")).toBe("02:42 pm");
  });

  it("renders midnight and noon the way people say them", () => {
    expect(formatTime("2026-08-20T18:30:00Z", "Asia/Kolkata")).toBe("12:00 am");
    expect(formatTime("2026-08-20T06:30:00Z", "Asia/Kolkata")).toBe("12:00 pm");
  });

  it("shows the same instant differently in different zones", () => {
    const instant = "2026-08-20T09:12:00Z";

    expect(formatTime(instant, "Asia/Kolkata")).toBe("02:42 pm");
    expect(formatTime(instant, "Europe/London")).toBe("10:12 am");
    expect(formatTime(instant, "America/New_York")).toBe("05:12 am");
  });

  it("returns null rather than a placeholder for missing values", () => {
    expect(formatTime(null)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
  });
});

describe("formatCalendarDate", () => {
  /**
   * attendance_date is a plain date, not an instant. Reading it in a
   * timezone shifts it: "2026-08-20" becomes the 19th west of UTC and the
   * 21st far enough east. It has to be read as UTC.
   */
  it("does not shift the day", () => {
    expect(formatCalendarDate("2026-08-20")).toContain("20 Aug");
    expect(formatCalendarDate("2026-01-01")).toContain("1 Jan");
    expect(formatCalendarDate("2026-12-31")).toContain("31 Dec");
  });
});

describe("getTodayInTimezone", () => {
  it("gives an ISO-shaped date", () => {
    expect(getTodayInTimezone("Asia/Kolkata")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("can land on different days for the same instant", () => {
    // 20:00 UTC is already the 21st in Kolkata and still the 20th in New York.
    const instant = new Date("2026-08-20T20:00:00Z");

    expect(getTodayInTimezone("Asia/Kolkata", instant)).toBe("2026-08-21");
    expect(getTodayInTimezone("America/New_York", instant)).toBe("2026-08-20");
  });
});

describe("getHour", () => {
  it("reads the hour in the given zone", () => {
    const instant = new Date("2026-08-20T09:12:00Z");

    expect(getHour("Asia/Kolkata", instant)).toBe(14);
    expect(getHour("Europe/London", instant)).toBe(10);
  });

  it("returns 0 rather than 24 at midnight", () => {
    // en-GB with hour12:false renders midnight as "24" in some runtimes;
    // a greeting keyed on that would say "good evening" at 00:30.
    const midnight = new Date("2026-08-20T18:30:00Z"); // 00:00 IST
    expect(getHour("Asia/Kolkata", midnight)).toBeLessThan(24);
  });
});

describe("formatShortDate", () => {
  it("puts the day before the month", () => {
    const result = formatShortDate(new Date("2026-08-20T12:00:00Z"), "Asia/Kolkata");

    expect(result).toMatch(/\d{1,2} [A-Z][a-z]{2}/);
    expect(result).toContain("20 Aug");
  });
});
