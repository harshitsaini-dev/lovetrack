import { test, expect, type Page, type BrowserContext } from "./fixtures";

import { resetAttendanceState } from "./helpers/reset";

/**
 * Phase 7: what one partner actually sees of the other.
 *
 * Driven by two real accounts, because the whole feature is about the
 * relationship between them — a single-account test could not tell the
 * difference between "hidden" and "absent".
 */

const USER_EMAIL = process.env.E2E_TEST_EMAIL;
const USER_PASSWORD = process.env.E2E_TEST_PASSWORD;
const PARTNER_EMAIL = process.env.E2E_PARTNER_EMAIL;
const PARTNER_PASSWORD = process.env.E2E_PARTNER_PASSWORD;

test.describe.configure({ mode: "serial" });

test.skip(
  !USER_EMAIL || !USER_PASSWORD || !PARTNER_EMAIL || !PARTNER_PASSWORD,
  "Needs both E2E accounts",
);

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

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

async function clearPairings(page: Page) {
  await page.goto("/app/partner");

  for (let i = 0; i < 4; i++) {
    const unpair = page.getByRole("button", { name: /pairing hatayein/i });
    const withdraw = page.getByRole("button", { name: /request wapas lein/i });
    const decline = page.getByRole("button", { name: /decline/i });

    if (await unpair.count()) {
      await unpair.first().click();
      await page.getByRole("button", { name: /haan, unpair karein/i }).click();
    } else if (await withdraw.count()) {
      await withdraw.first().click();
    } else if (await decline.count()) {
      await decline.first().click();
    } else {
      return;
    }
    await page.waitForTimeout(600);
  }
}

let userCtx: BrowserContext;
let partnerCtx: BrowserContext;
let user: Page;
let partner: Page;

test.beforeAll(async ({ browser }) => {
  await resetAttendanceState();

  userCtx = await browser.newContext({
    permissions: ["camera", "geolocation"],
    geolocation: { latitude: 28.6205, longitude: 77.0521 },
  });
  partnerCtx = await browser.newContext({
    permissions: ["camera", "geolocation"],
    geolocation: { latitude: 28.6205, longitude: 77.0521 },
  });

  user = await userCtx.newPage();
  partner = await partnerCtx.newPage();

  await login(user, USER_EMAIL!, USER_PASSWORD!);
  await login(partner, PARTNER_EMAIL!, PARTNER_PASSWORD!);

  await clearPairings(user);
  await clearPairings(partner);

  // The user checks in, so there is something to look at.
  await user.goto("/app/check-in");
  const shutter = user.getByRole("button", { name: /photo capture karein/i });
  await expect(shutter).toBeEnabled({ timeout: 20_000 });
  await shutter.click();
  await expect(
    user.getByText(/location mil gayi|nawada|delhi/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  await user.getByRole("button", { name: /verify & check-in/i }).click();
  await expect(
    user.getByRole("heading", { name: /check-in (ho gaya|record ho gaya)/i }),
  ).toBeVisible({ timeout: 25_000 });

  // Pair them.
  await user.goto("/app/partner");
  await user.getByLabel(/unka email/i).fill(PARTNER_EMAIL!);
  await user.getByRole("button", { name: /request bhejein/i }).click();
  await expect(user.getByTestId("form-message")).toBeVisible();

  await partner.goto("/app/partner");
  await partner.getByRole("button", { name: /^accept$/i }).click();
  await expect(
    partner.getByRole("button", { name: /sab sharing band karein/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test.afterAll(async () => {
  await userCtx?.close();
  await partnerCtx?.close();
});

test("attendance is visible, but location is not by default", async () => {
  await partner.goto("/app/partner");

  await expect(partner.getByText(/aaj ki activity/i)).toBeVisible();
  await expect(partner.getByText(/checked in/i).first()).toBeVisible();

  // Location sharing is opt-in, so the place must not be here yet — and the
  // page has to say why, rather than looking like nothing happened.
  await expect(
    partner.getByText(/location share nahi ki gayi/i),
  ).toBeVisible();
  await expect(partner.getByText(/nawada|janakpuri/i)).toHaveCount(0);
});

test("turning location on reveals the place", async () => {
  await user.goto("/app/partner");
  await user.locator('[id$="-share_location"]').click();
  await expect(user.locator('[id$="-share_location"]')).toHaveAttribute(
    "data-state",
    "checked",
  );

  await partner.goto("/app/partner");

  await expect(
    partner.getByText(/location share nahi ki gayi/i),
  ).toHaveCount(0);
  // A place name, and a map of where the capture happened.
  await expect(partner.getByRole("img", { name: /^map:/i })).toBeVisible();
});

/** Captured while sharing is on, so the next test can go straight there. */
let historyUrl = "";

test("the history page shows the shared days", async () => {
  await partner.goto("/app/partner");
  await partner.getByRole("link", { name: /poori history/i }).click();

  await expect(partner).toHaveURL(/\/app\/partner\/[0-9a-f-]{36}/);
  historyUrl = new URL(partner.url()).pathname;

  await expect(
    partner.getByRole("heading", { name: "History" }),
  ).toBeVisible();
  await expect(partner.getByText(/checked in|din complete/i).first()).toBeVisible();
});

test("turning attendance off hides everything, and explains itself", async () => {
  await user.goto("/app/partner");
  await user.getByRole("button", { name: /sab sharing band karein/i }).click();
  await expect(user.getByTestId("form-message")).toContainText(/band/i);

  await partner.goto("/app/partner");

  await expect(
    partner.getByText(/apni activity abhi share nahi kar rahe/i),
  ).toBeVisible();
  await expect(partner.getByText(/checked in/i)).toHaveCount(0);

  // The history page has to hold the same line — the link is gone from the
  // card, but the URL is still guessable by anyone who saw it once.
  await partner.goto(historyUrl);
  await expect(
    partner.getByText(/apni activity share nahi kar rahe/i),
  ).toBeVisible();
});

test("a stranger's id is a 404, not an empty page", async () => {
  // A random uuid is nobody this account is paired with.
  await partner.goto("/app/partner/00000000-0000-0000-0000-000000000000");

  await expect(partner.getByText("404")).toBeVisible();
});
