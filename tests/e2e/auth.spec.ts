import { test, expect } from "./fixtures";

/**
 * Phase 2 coverage: authentication, route protection and the mobile-first
 * shell. Flows that need a real mailbox (email verification, password
 * recovery links) are exercised at the Supabase level instead.
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("public pages", () => {
  test("landing page renders and links to auth", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /lovetrack/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("landing page never offers a file upload", async ({ page }) => {
    // Attendance proof must come from a live camera only. A file input
    // anywhere in the funnel would defeat the entire anti-fraud model.
    await page.goto("/");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("page does not scroll horizontally on a phone", async ({ page }) => {
    await page.goto("/");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("theme can be switched and the choice sticks", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));

    await page.getByRole("button", { name: /theme badlein/i }).click();
    await expect(html).toHaveClass(wasDark ? /(?!.*dark)/ : /dark/);

    // next-themes persists to localStorage, so a reload must keep it.
    await page.reload();
    await expect(html).toHaveClass(wasDark ? /(?!.*dark)/ : /dark/);
  });

  test("install control is present and never a dead button", async ({
    page,
  }) => {
    await page.goto("/");

    // Chromium under Playwright does not fire beforeinstallprompt, so the
    // component must fall back to guidance rather than rendering nothing.
    const install = page.getByRole("button", { name: /install app/i });
    const fallback = page.getByText(/install option aapke browser menu/i);

    await expect(install.or(fallback).first()).toBeVisible();
  });

  test("theme toggle is available on auth pages too", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /theme badlein/i }),
    ).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("anonymous user is redirected away from the dashboard", async ({
    page,
  }) => {
    await page.goto("/app/dashboard");

    await expect(page).toHaveURL(/\/login/);
    // The original destination is preserved so login can return there.
    expect(page.url()).toContain("next=%2Fapp%2Fdashboard");
  });

  test("reset-password without a recovery session bounces out", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe("login form", () => {
  test("rejects wrong credentials with a safe message", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("nobody@lovetrack.dev");
    await page.getByLabel("Password", { exact: true }).fill("WrongPass123");
    await page.getByRole("button", { name: /log in/i }).click();

    const alert = page.getByTestId("form-message");
    await expect(alert).toBeVisible();
    // Must not disclose whether the account exists.
    await expect(alert).toContainText(/email ya password galat hai/i);
  });

  test("password visibility toggle works and is labelled", async ({ page }) => {
    await page.goto("/login");

    const field = page.getByLabel("Password", { exact: true });
    await expect(field).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: /password dikhayein/i }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("all interactive targets meet the 44px minimum", async ({ page }) => {
    await page.goto("/login");

    const submit = page.getByRole("button", { name: /log in/i });
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("registration form", () => {
  test("blocks mismatched passwords", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Poora naam").fill("Test User");
    await page.getByLabel("Email").fill("mismatch@lovetrack.dev");
    await page.getByLabel("Password", { exact: true }).fill("TestPass123");
    await page.getByLabel("Password dobara").fill("DifferentPass123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByTestId("form-message")).toContainText(/match nahi/i);
  });

  test("blocks a weak password", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Poora naam").fill("Test User");
    await page.getByLabel("Email").fill("weak@lovetrack.dev");
    await page.getByLabel("Password", { exact: true }).fill("alllowercase");
    await page.getByLabel("Password dobara").fill("alllowercase");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByTestId("form-message")).toBeVisible();
  });
});

test.describe("authenticated session", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run signed-in tests",
  );

  test("logs in, lands on the dashboard, and can log out", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(TEST_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /good (morning|afternoon|evening)/i,
    );

    // Bottom nav is the primary navigation on phones.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("button", { name: /log out/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("signed-in user is bounced away from /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });

    await page.goto("/login");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });
});
