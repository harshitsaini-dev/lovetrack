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

  /*
   * One worker, always.
   *
   * The suite drives shared server-side state through a small number of
   * real accounts: one E2E user, one partner, one attendance day, one
   * pairing. profile.spec changes that user's name and password while
   * other specs are signing in as them, and attendance/lunch/leave each
   * walk the same account through the same day.
   *
   * Headed runs and CI were already serial; only a local headless run was
   * not, and it failed in a thoroughly misleading way — logins that
   * silently produced no session, which reads as broken auth rather than
   * as two tests fighting over one account. Parallelism here would need
   * an account per worker, not a bigger timeout.
   */
  fullyParallel: false,
  workers: 1,

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

  /*
   * Playwright's default expect timeout is 5s, which was left below
   * actionTimeout by oversight. It only bites in a parallel run against the
   * dev server, where a route is compiled on first request and a navigation
   * assertion can legitimately outlast five seconds — producing failures
   * that look like broken auth and disappear at --workers=1.
   */
  expect: { timeout: headed ? 15_000 : 10_000 },

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
      testIgnore:
        /(pairing|attendance|lunch|leave|partner-activity|admin)\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
