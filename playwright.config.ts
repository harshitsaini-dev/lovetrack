import { defineConfig, devices } from "@playwright/test";

// Playwright does not read .env.local the way Next.js does, so the signed-in
// tests would silently skip without this. Missing file is fine — those tests
// skip themselves and the rest of the suite still runs.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local present
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Headed by default on a developer machine so the run is actually watchable —
 * a real browser window, moving at a speed a human can follow. CI overrides
 * this to headless. Force either mode with HEADED=1 or HEADED=0.
 */
const isCI = !!process.env.CI;
const headed =
  process.env.HEADED === "1" ? true : process.env.HEADED === "0" ? false : !isCI;

/**
 * LoveTrack is a mobile-first PWA, so the phone viewport is the default
 * project and desktop is the secondary check — not the other way round.
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // When watching, run one test at a time so windows don't fight for focus.
  fullyParallel: !headed,
  workers: headed ? 1 : isCI ? 1 : undefined,

  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    headless: !headed,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: headed ? "off" : "retain-on-failure",

    // Slow the actions down enough to follow along by eye.
    launchOptions: { slowMo: headed ? 350 : 0 },

    // Give a watched run room to breathe before failing an assertion.
    actionTimeout: headed ? 15_000 : 10_000,
  },

  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        // A phone-sized window is easy to miss on a big monitor.
        viewport: { width: 412, height: 900 },
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      // These suites drive shared accounts through real server-side state:
      // one pairing, one attendance day. Running them again here would have
      // the two projects fighting over the same records — the second run
      // finds the day already checked in. The mobile project, the primary
      // target, owns them; everything else still runs on both.
      testIgnore: /(pairing|attendance)\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
