import { test as base } from "@playwright/test";

import { clearRateLimits } from "./helpers/reset";

/**
 * The `test` every spec should import.
 *
 * It clears the rate-limit counters before each test. The suite signs in
 * as the same account from the same address far faster than any person
 * would, which is precisely what the login limit is there to refuse — so
 * without this, a working rate limiter looks like a broken test suite.
 *
 * Doing it here rather than per-file means a new spec cannot forget.
 */
export const test = base.extend<{ freshLimits: void }>({
  freshLimits: [
    async ({}, use) => {
      await clearRateLimits();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
export type { Page, BrowserContext } from "@playwright/test";
