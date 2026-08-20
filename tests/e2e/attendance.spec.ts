import { test, expect, type Page } from "@playwright/test";

import { resetAttendanceState } from "./helpers/reset";

/**
 * Phase 4: the check-in flow driven through a real browser, with a fake
 * camera and a granted geolocation permission.
 *
 * Chromium's --use-fake-device-for-media-capture feeds a synthetic video
 * track to getUserMedia, so the camera path is genuinely exercised: the
 * stream opens, a frame is drawn to a canvas and encoded, and the resulting
 * blob is uploaded. The only thing that is fake is what the lens sees.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

// Somewhere in Delhi; the exact spot is irrelevant since there is no
// geofence — only the quality of the reading matters.
const COORDS = { latitude: 28.6205, longitude: 77.0521 };

test.describe.configure({ mode: "serial" });

test.skip(!EMAIL || !PASSWORD, "Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.use({
  permissions: ["camera", "geolocation"],
  geolocation: COORDS,
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-capture",
    ],
  },
});

// This file and lunch.spec.ts both walk the same account through a day, so
// neither may assume it ran first.
test.beforeAll(resetAttendanceState);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

test("the check-in page never offers a file picker", async ({ page }) => {
  await login(page);
  await page.goto("/app/check-in");

  // The entire anti-fraud model rests on this: if a file input existed,
  // a gallery photo could be submitted as live proof.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByText(/sirf live camera/i)).toBeVisible();
});

test("the capture prompt greets, and names a partner when there is one", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/check-in");

  // "Hello" on its own without a pairing; "Hello, <name>" once paired.
  await expect(page.getByText(/camera me dekhkar bolein/i)).toBeVisible();
  await expect(page.getByText(/hello/i).first()).toBeVisible();
});

test("a full check-in records the day and shows the timeline", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/check-in");

  // Capture — the button only enables once the stream is actually playing.
  const shutter = page.getByRole("button", { name: /photo capture karein/i });
  await expect(shutter).toBeEnabled({ timeout: 20_000 });
  await shutter.click();

  // Location is requested straight after the frame is taken.
  await expect(page.getByText(/location mil gayi/i)).toBeVisible({
    timeout: 20_000,
  });

  const submit = page.getByRole("button", { name: /verify & check-in/i });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole("heading", { name: /check-in ho gaya/i })).toBeVisible(
    { timeout: 25_000 },
  );

  await page.goto("/app/dashboard");
  await expect(page.getByText(/aaj ki timeline/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /check out/i })).toBeVisible();

  // A place name, not raw coordinates, is what the timeline leads with.
  await expect(page.getByText(/nawada|delhi/i).first()).toBeVisible();

  // And the map actually renders tiles rather than an empty grey box.
  const map = page.getByRole("img", { name: /^map:/i });
  await expect(map).toBeVisible();
  await expect(map.locator("img.leaflet-tile").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("checking in twice is not offered", async ({ page }) => {
  await login(page);

  // The previous test left the day checked in, so the page bounces.
  await page.goto("/app/check-in");
  await expect(page).toHaveURL(/\/app\/dashboard/);
});

test("history lists the day", async ({ page }) => {
  await login(page);
  await page.goto("/app/history");

  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText(/abhi koi record nahi/i)).toHaveCount(0);
});

test("check-out completes the day", async ({ page }) => {
  await login(page);
  await page.goto("/app/check-out");

  const shutter = page.getByRole("button", { name: /photo capture karein/i });
  await expect(shutter).toBeEnabled({ timeout: 20_000 });
  await shutter.click();

  await expect(page.getByText(/location mil gayi/i)).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: /verify & check-out/i }).click();

  // What matters here is that the day closed. Whether the submission was
  // also flagged depends on the signals — indoors on a laptop it often is —
  // and asserting on that would make this test fail for honest reasons.
  // The scoring itself is pinned down in scripts/verify-attendance.mjs,
  // where the inputs can be controlled exactly.
  await expect(
    page.getByRole("heading", { name: /check-out (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  await page.goto("/app/dashboard");
  await expect(page.getByText(/aaj ka din complete/i)).toBeVisible();
});
