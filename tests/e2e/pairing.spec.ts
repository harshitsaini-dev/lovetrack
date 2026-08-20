import { test, expect, type Page } from "./fixtures";

/**
 * Phase 3: the full consent cycle, driven through the UI by two real
 * accounts in separate browser contexts — request, accept, share, stop,
 * unpair.
 *
 * Runs serially: each test builds on the pairing state the previous one
 * left behind, and two workers racing the same two accounts would fight.
 */

const USER_EMAIL = process.env.E2E_TEST_EMAIL;
const USER_PASSWORD = process.env.E2E_TEST_PASSWORD;
const PARTNER_EMAIL = process.env.E2E_PARTNER_EMAIL;
const PARTNER_PASSWORD = process.env.E2E_PARTNER_PASSWORD;

test.describe.configure({ mode: "serial" });

test.skip(
  !USER_EMAIL || !USER_PASSWORD || !PARTNER_EMAIL || !PARTNER_PASSWORD,
  "Needs both E2E accounts — run scripts/seed-e2e-user.mjs and scripts/seed-e2e-partner.mjs",
);

// Note: the desktop project skips this file entirely (see testIgnore in
// playwright.config.ts). These tests mutate shared server-side state on two
// real accounts, so running them once per project would have the two runs
// fighting over the same pairing.

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

/** Leaves both accounts with no pairing, whatever state they were in. */
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

test.beforeAll(async ({ browser }) => {
  for (const [email, password] of [
    [USER_EMAIL!, USER_PASSWORD!],
    [PARTNER_EMAIL!, PARTNER_PASSWORD!],
  ]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, email, password);
    await clearPairings(page);
    await ctx.close();
  }
});

test("a pairing request must be accepted before anything is shared", async ({
  browser,
}) => {
  const userCtx = await browser.newContext();
  const partnerCtx = await browser.newContext();
  const user = await userCtx.newPage();
  const partner = await partnerCtx.newPage();

  await login(user, USER_EMAIL!, USER_PASSWORD!);
  await login(partner, PARTNER_EMAIL!, PARTNER_PASSWORD!);

  // --- send the request
  await user.goto("/app/partner");
  await user.getByLabel(/unka email/i).fill(PARTNER_EMAIL!);
  await user.getByRole("button", { name: /request bhejein/i }).click();
  await expect(user.getByTestId("form-message")).toContainText(/request bhej/i);

  // The requester sees it as pending, with no sharing controls yet.
  await expect(user.getByText(/inke accept karne ka intezaar/i)).toBeVisible();
  await expect(
    user.getByRole("button", { name: /sab sharing band karein/i }),
  ).toHaveCount(0);

  // --- the partner sees it and accepts
  await partner.goto("/app/partner");
  await expect(
    partner.getByText(/inhone aapko pair karne ki request bheji hai/i),
  ).toBeVisible();

  await partner.getByRole("button", { name: /^accept$/i }).click();

  // Assert the outcome, not the confirmation message: accepting swaps the
  // request card for the sharing controls, so the message it rendered is
  // gone by the time the refreshed tree paints.
  await expect(
    partner.getByRole("button", { name: /sab sharing band karein/i }),
  ).toBeVisible();
  await expect(
    partner.getByText(/inhone aapko pair karne ki request bheji hai/i),
  ).toHaveCount(0);

  await userCtx.close();
  await partnerCtx.close();
});

test("sharing starts on, and each side controls only its own switches", async ({
  browser,
}) => {
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await login(user, USER_EMAIL!, USER_PASSWORD!);
  await user.goto("/app/partner");

  const attendance = user.locator('[id$="-share_attendance"]');
  const location = user.locator('[id$="-share_location"]');

  // Every switch starts on. People pair on purpose and expect to see each
  // other's day; what has to keep working is turning one off, below.
  await expect(attendance).toHaveAttribute("data-state", "checked");
  await expect(location).toHaveAttribute("data-state", "checked");

  // The partner's choices are shown but not editable from this side.
  await expect(user.getByText(/wo aapke saath kya share karte hain/i)).toBeVisible();

  await location.click();
  await expect(location).toHaveAttribute("data-state", "unchecked");

  // The change must survive a reload — i.e. it actually reached the database.
  await user.reload();
  await expect(user.locator('[id$="-share_location"]')).toHaveAttribute(
    "data-state",
    "unchecked",
  );

  // Put it back, so the next spec starts from the shipped default.
  await user.locator('[id$="-share_location"]').click();
  await expect(user.locator('[id$="-share_location"]')).toHaveAttribute(
    "data-state",
    "checked",
  );

  await userCtx.close();
});

test("stop sharing turns every switch off at once", async ({ browser }) => {
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await login(user, USER_EMAIL!, USER_PASSWORD!);
  await user.goto("/app/partner");

  await user.getByRole("button", { name: /sab sharing band karein/i }).click();
  await expect(user.getByTestId("form-message")).toContainText(
    /sab sharing band/i,
  );

  for (const key of [
    "share_attendance",
    "share_location",
    "share_lunch_proof",
    "share_leave",
  ]) {
    await expect(user.locator(`[id$="-${key}"]`)).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  }

  // With nothing shared the button has nothing left to do, and says so.
  await expect(
    user.getByRole("button", { name: /kuch share nahi ho raha/i }),
  ).toBeDisabled();

  await userCtx.close();
});

test("either side can unpair, and it takes effect for both", async ({
  browser,
}) => {
  const userCtx = await browser.newContext();
  const partnerCtx = await browser.newContext();
  const user = await userCtx.newPage();
  const partner = await partnerCtx.newPage();

  await login(user, USER_EMAIL!, USER_PASSWORD!);
  await login(partner, PARTNER_EMAIL!, PARTNER_PASSWORD!);

  await user.goto("/app/partner");
  await user.getByRole("button", { name: /pairing hatayein/i }).click();

  // Unpairing is destructive, so it asks first.
  await expect(user.getByText(/pakka\?/i)).toBeVisible();
  await user.getByRole("button", { name: /haan, unpair karein/i }).click();

  await expect(user.getByText(/abhi koi pairing nahi hai/i)).toBeVisible();

  // The other side loses the pairing too, without having done anything.
  await partner.goto("/app/partner");
  await expect(partner.getByText(/abhi koi pairing nahi hai/i)).toBeVisible();

  await userCtx.close();
  await partnerCtx.close();
});

test("you cannot pair with yourself", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USER_EMAIL!, USER_PASSWORD!);

  await page.goto("/app/partner");
  await page.getByLabel(/unka email/i).fill(USER_EMAIL!);
  await page.getByRole("button", { name: /request bhejein/i }).click();

  await expect(page.getByTestId("form-message")).toContainText(
    /khud ke saath pair nahi/i,
  );

  await ctx.close();
});

test("an unknown email gives the same answer as a real one", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USER_EMAIL!, USER_PASSWORD!);

  await page.goto("/app/partner");
  await page.getByLabel(/unka email/i).fill("definitely-nobody@lovetrack.dev");
  await page.getByRole("button", { name: /request bhejein/i }).click();

  // Anything more specific would let someone test which emails are registered.
  await expect(page.getByTestId("form-message")).toContainText(
    /agar ye email lovetrack par registered hai/i,
  );

  await ctx.close();
});
