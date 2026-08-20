import { test, expect, type Page } from "./fixtures";

import { resetAttendanceState } from "./helpers/reset";

/**
 * Phase 5: the lunch sequence — start, end, then the proof clip — driven
 * through a real browser with a fake camera and microphone.
 *
 * The recording is genuine: MediaRecorder encodes Chromium's synthetic
 * video track, the resulting blob is uploaded to private storage, and the
 * database links it to the day. Only what the lens sees is fake.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

const COORDS = { latitude: 28.6205, longitude: 77.0521 };

test.describe.configure({ mode: "serial" });

test.skip(!EMAIL || !PASSWORD, "Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.use({
  permissions: ["camera", "microphone", "geolocation"],
  geolocation: COORDS,
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-capture",
    ],
  },
});

// This file and attendance.spec.ts both walk the same account through a
// day, so neither may assume it ran first.
test.beforeAll(resetAttendanceState);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

/** Runs one camera + location capture to completion. */
async function capture(page: Page, action: RegExp) {
  const shutter = page.getByRole("button", { name: /photo capture karein/i });
  await expect(shutter).toBeEnabled({ timeout: 20_000 });
  await shutter.click();

  await expect(page.getByText(/location mil gayi|nawada|delhi/i).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: action }).click();
}

test("lunch cannot be started before checking in", async ({ page }) => {
  await login(page);

  await page.goto("/app/lunch");
  await expect(page).toHaveURL(/\/app\/dashboard/);
});

test("the day walks check-in, lunch start, lunch end, then proof", async ({
  page,
}) => {
  await login(page);

  // --- check in
  await page.goto("/app/check-in");
  await capture(page, /verify & check-in/i);
  await expect(
    page.getByRole("heading", { name: /check-in (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  // The dashboard offers lunch as a secondary action, not a funnel.
  await page.goto("/app/dashboard");
  await expect(page.getByRole("link", { name: /lunch start/i })).toBeVisible();

  // --- lunch start
  await page.goto("/app/lunch");
  await expect(page.getByRole("heading", { name: "Lunch start" })).toBeVisible();
  await capture(page, /verify & lunch start/i);
  await expect(
    page.getByRole("heading", { name: /lunch start (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  // --- lunch end
  await page.goto("/app/lunch");
  await expect(page.getByRole("heading", { name: "Lunch end" })).toBeVisible();
  await capture(page, /verify & lunch end/i);
  await expect(
    page.getByRole("heading", { name: /lunch end (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  // --- the proof clip
  await page.goto("/app/lunch");
  await expect(page.getByRole("heading", { name: "Lunch proof" })).toBeVisible();

  // The instruction says to record while eating, and asks for the phrase.
  await expect(page.getByText(/khana khate hue video banayein/i)).toBeVisible();
  await expect(page.getByText(/khana khalo/i).first()).toBeVisible();

  // No file picker here either — the clip must come from a live stream.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);

  const start = page.getByRole("button", { name: /recording shuru karein/i });
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();

  // Below the minimum the stop button says how much longer to hold.
  await expect(page.getByRole("button", { name: /s aur…/i })).toBeDisabled();

  const stop = page.getByRole("button", { name: /recording rokein/i });
  await expect(stop).toBeEnabled({ timeout: 15_000 });
  await stop.click();

  await expect(page.getByRole("button", { name: /proof submit karein/i })).toBeVisible(
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: /proof submit karein/i }).click();

  await expect(
    page.getByRole("heading", { name: /lunch proof save ho gaya/i }),
  ).toBeVisible({ timeout: 40_000 });
});

test("a second proof for the same day is not offered", async ({ page }) => {
  await login(page);

  await page.goto("/app/lunch");
  await expect(page).toHaveURL(/\/app\/dashboard/);
});

test("check-out closes the day after lunch", async ({ page }) => {
  await login(page);

  await page.goto("/app/check-out");
  await capture(page, /verify & check-out/i);

  await expect(
    page.getByRole("heading", { name: /check-out (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  await page.goto("/app/dashboard");
  await expect(page.getByText(/aaj ka din complete/i)).toBeVisible();
});
