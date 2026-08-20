import { test, expect, type Page } from "./fixtures";

import { resetAttendanceState } from "./helpers/reset";

/**
 * Phase 6: leave, which is information rather than a request — the user
 * states they are off and that is the whole transaction. Nothing is
 * pending, nobody approves it.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe.configure({ mode: "serial" });

test.skip(!EMAIL || !PASSWORD, "Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.beforeAll(resetAttendanceState);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

/** A date in the allowed backdating window, unique per run. */
function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

test("the page presents leave as information, not a request", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/leave");

  // exact, because "Leave mark karein" would otherwise match too — the
  // name option is a substring match by default.
  await expect(
    page.getByRole("heading", { name: "Leave", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText(/kisi ki approval nahi chahiye/i)).toBeVisible();

  // Nothing anywhere should imply a queue or a reviewer.
  await expect(page.getByText(/pending|approve|reject/i)).toHaveCount(0);
});

test("a reason is required", async ({ page }) => {
  await login(page);
  await page.goto("/app/leave");

  await page.getByLabel("Kis din ki").fill(recentDate(3));
  await page.getByLabel("Reason").fill("  ");
  await page.getByRole("button", { name: /leave mark karein/i }).click();

  await expect(page.getByTestId("form-message")).toContainText(/reason/i);
});

test("marking leave records it and it can be withdrawn", async ({ page }) => {
  await login(page);
  await page.goto("/app/leave");

  const day = recentDate(2);

  await page.getByLabel("Kis din ki").fill(day);
  await page.getByLabel("Reason").fill("Cousin ki shaadi");
  await page.getByRole("button", { name: /leave mark karein/i }).click();

  await expect(page.getByTestId("form-message")).toContainText(
    /record ho gayi/i,
  );

  const entry = page.getByText("Cousin ki shaadi");
  await expect(entry).toBeVisible();

  // The same day cannot be recorded twice while it stands.
  await page.getByLabel("Kis din ki").fill(day);
  await page.getByLabel("Reason").fill("Trying the same day again");
  await page.getByRole("button", { name: /leave mark karein/i }).click();
  await expect(page.getByTestId("form-message")).toContainText(
    /pehle se maujood/i,
  );

  // Withdraw it.
  await page.getByRole("button", { name: /hatayein/i }).first().click();
  await expect(page.getByText(/hata di gayi/i).first()).toBeVisible();
});

test("a day that was worked cannot be marked as leave", async ({ page }) => {
  await login(page);

  // Check in today, which makes today a worked day.
  await page.goto("/app/check-in");
  const shutter = page.getByRole("button", { name: /photo capture karein/i });
  await expect(shutter).toBeEnabled({ timeout: 20_000 });
  await shutter.click();
  await expect(
    page.getByText(/location mil gayi|nawada|delhi/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /verify & check-in/i }).click();
  await expect(
    page.getByRole("heading", { name: /check-in (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  await page.goto("/app/leave");
  await page.getByLabel("Kis din ki").fill(recentDate(0));
  await page.getByLabel("Reason").fill("But I already worked today");
  await page.getByRole("button", { name: /leave mark karein/i }).click();

  await expect(page.getByTestId("form-message")).toContainText(
    /kaam kar chuke hain/i,
  );
});

test.use({
  permissions: ["camera", "geolocation"],
  geolocation: { latitude: 28.6205, longitude: 77.0521 },
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-capture",
    ],
  },
});
