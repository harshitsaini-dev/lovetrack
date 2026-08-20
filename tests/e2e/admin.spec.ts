import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 8: the admin panel.
 *
 * The partner account is promoted for the duration and demoted afterwards,
 * so the main test account stays an ordinary user and keeps proving that
 * ordinary users are kept out.
 */

const ADMIN_EMAIL = process.env.E2E_PARTNER_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_PARTNER_PASSWORD;
const USER_EMAIL = process.env.E2E_TEST_EMAIL;
const USER_PASSWORD = process.env.E2E_TEST_PASSWORD;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: "serial" });

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASSWORD || !USER_EMAIL || !USER_PASSWORD,
  "Needs both E2E accounts",
);

async function patchProfile(email: string, body: Record<string, string>) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

test.beforeAll(async () => {
  await patchProfile(ADMIN_EMAIL!, { role: "admin" });
  await patchProfile(USER_EMAIL!, { status: "active" });
});

/**
 * Cleanup lives here rather than at the end of the tests that made the mess.
 *
 * These tests suspend the shared account on purpose. If one of them fails
 * partway, an inline restore never runs — and every later spec in the suite
 * then fails to log in, for a reason that has nothing to do with what it
 * was testing. That happened; this is the fix.
 */
test.afterAll(async () => {
  await patchProfile(ADMIN_EMAIL!, { role: "user" });
  await patchProfile(USER_EMAIL!, { status: "active" });
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

test("an ordinary user is refused every admin route", async ({ page }) => {
  await login(page, USER_EMAIL!, USER_PASSWORD!);

  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/review",
    "/admin/audit",
    "/admin/emails",
    "/admin/settings",
    "/admin/storage",
  ]) {
    await page.goto(path);
    await expect(page, `${path} should be refused`).toHaveURL(/\/forbidden/);
  }
});

test("the admin sees the dashboard and its sections", async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText(/audit log me jaata hai/i)).toBeVisible();

  for (const section of [
    "Users",
    "Review",
    "Storage",
    "Risk settings",
    "Email log",
    "Audit log",
  ]) {
    await expect(page.getByRole("link", { name: new RegExp(section, "i") })).toBeVisible();
  }
});

test("the user list searches, and refuses to suspend an admin", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/users");

  await expect(page.getByText(USER_EMAIL!)).toBeVisible();

  // Narrow to the admin's own row rather than guessing at DOM structure.
  await page.goto(`/admin/users?q=${encodeURIComponent(ADMIN_EMAIL!)}`);
  await expect(page.getByText(ADMIN_EMAIL!)).toBeVisible();

  // An admin cannot be suspended, and the button says so rather than
  // failing on submit.
  await expect(
    page.getByRole("button", { name: /admin suspend nahi hote/i }),
  ).toBeDisabled();

  await page.goto(`/admin/users?q=${encodeURIComponent(USER_EMAIL!)}`);
  await expect(page.getByText(USER_EMAIL!)).toBeVisible();
  await expect(page.getByText(ADMIN_EMAIL!)).toHaveCount(0);
});

test("suspending and restoring a user is recorded with its reason", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto(`/admin/users?q=${encodeURIComponent(USER_EMAIL!)}`);

  // Unique per run: the audit log is append-only and keeps every previous
  // run's entry, so a fixed string would match all of them and prove
  // nothing about this one.
  const reason = `E2E suspension ${Date.now()}`;

  await page.getByRole("button", { name: /^suspend karein$/i }).click();
  await page.getByLabel(/wajah/i).fill(reason);
  await page.getByRole("button", { name: /^suspend karein$/i }).click();

  await expect(page.getByText("suspended").first()).toBeVisible({
    timeout: 15_000,
  });

  // The audit log is the point of the whole exercise.
  await page.goto("/admin/audit");
  await expect(page.getByText(/user suspend kiya/i).first()).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();

  // Put the account back, or every later run starts locked out.
  await page.goto(`/admin/users?q=${encodeURIComponent(USER_EMAIL!)}`);
  await page.getByRole("button", { name: /wapas active karein/i }).click();
  await expect(
    page.getByRole("button", { name: /^suspend karein$/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test("a suspended account cannot use the app", async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const userCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const userPage = await userCtx.newPage();

  await login(adminPage, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(USER_EMAIL!)}`);
  await adminPage.getByRole("button", { name: /^suspend karein$/i }).click();
  await adminPage.getByRole("button", { name: /^suspend karein$/i }).click();
  await expect(adminPage.getByText("suspended").first()).toBeVisible({
    timeout: 15_000,
  });

  await login(userPage, USER_EMAIL!, USER_PASSWORD!).catch(() => {});
  await userPage.goto("/app/dashboard");
  await expect(userPage).toHaveURL(/\/suspended/);
  await expect(
    userPage.getByRole("heading", { name: /account suspend hai/i }),
  ).toBeVisible();

  await adminPage.goto(`/admin/users?q=${encodeURIComponent(USER_EMAIL!)}`);
  await adminPage.getByRole("button", { name: /wapas active karein/i }).click();
  await expect(
    adminPage.getByRole("button", { name: /^suspend karein$/i }),
  ).toBeVisible({ timeout: 15_000 });

  await adminCtx.close();
  await userCtx.close();
});

test("risk settings reject a nonsensical combination", async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto("/admin/settings");

  // A warning threshold above the rejection threshold means the milder
  // rule can never fire.
  await page.getByLabel(/warning accuracy/i).fill("500");
  await page.getByRole("button", { name: /settings save karein/i }).click();

  await expect(page.getByTestId("form-message")).toContainText(
    /kam honi chahiye/i,
  );
});
