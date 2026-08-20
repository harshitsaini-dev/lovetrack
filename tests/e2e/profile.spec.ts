import { test, expect, type Page } from "@playwright/test";

/**
 * Profile management, "remember me", and Indian time formatting.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

async function login(page: Page, remember = true) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);

  const box = page.getByLabel(/mujhe yaad rakhein/i);
  if (!remember) await box.uncheck();

  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

test.describe("remember me", () => {
  test("is offered and ticked by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/mujhe yaad rakhein/i)).toBeChecked();
  });

  test("ticked leaves a persistent auth cookie", async ({ page, context }) => {
    await login(page, true);

    const cookies = await context.cookies();
    const auth = cookies.filter((c) => c.name.startsWith("sb-"));

    expect(auth.length).toBeGreaterThan(0);
    // -1 is Playwright's marker for a session cookie; a real expiry means
    // it survives the browser closing.
    expect(auth.every((c) => c.expires > 0)).toBe(true);
  });

  test("unticked leaves only session cookies", async ({ page, context }) => {
    await login(page, false);

    const cookies = await context.cookies();
    const auth = cookies.filter((c) => c.name.startsWith("sb-"));

    expect(auth.length).toBeGreaterThan(0);
    // The whole point: the browser drops these on close, so a borrowed
    // device does not stay signed in.
    expect(auth.every((c) => c.expires === -1)).toBe(true);
  });
});

test.describe("profile management", () => {
  test("settings offers photo, name and password", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");

    await expect(
      page.getByRole("heading", { name: /profile photo/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Poora naam")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /password badlein/i }),
    ).toBeVisible();
  });

  test("the name can be changed and sticks", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");

    const field = page.getByLabel("Poora naam");
    const original = await field.inputValue();
    const changed = `${original} Ji`;

    await field.fill(changed);
    await page.getByRole("button", { name: /settings save karein/i }).click();
    await expect(page.getByTestId("form-message")).toContainText(/save ho gay/i);

    await page.reload();
    await expect(page.getByLabel("Poora naam")).toHaveValue(changed);

    // Put it back so later runs start from the same place.
    await page.getByLabel("Poora naam").fill(original);
    await page.getByRole("button", { name: /settings save karein/i }).click();
    await expect(page.getByTestId("form-message")).toContainText(/save ho gay/i);
  });

  test("a wrong current password is refused", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");

    await page.getByLabel("Current password").fill("DefinitelyWrong123");
    await page.getByLabel("Naya password", { exact: true }).fill("BrandNewPass123");
    await page.getByLabel("Naya password dobara").fill("BrandNewPass123");
    await page.getByRole("button", { name: /password update karein/i }).click();

    await expect(page.getByTestId("form-message")).toContainText(
      /current password galat/i,
    );
  });

  test("a weak new password is refused", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");

    await page.getByLabel("Current password").fill(PASSWORD!);
    await page.getByLabel("Naya password", { exact: true }).fill("alllowercase");
    await page.getByLabel("Naya password dobara").fill("alllowercase");
    await page.getByRole("button", { name: /password update karein/i }).click();

    await expect(page.getByTestId("form-message")).toBeVisible();
  });

  test("the avatar picker accepts a file", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");

    // A 1x1 PNG is enough to exercise upload, storage policy and the
    // profile write without shipping a fixture image.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    await page.getByLabel(/profile photo chunein/i).setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: png,
    });

    await expect(page.getByRole("button", { name: /hatayein/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /hatayein/i }).click();
    await expect(
      page.getByRole("button", { name: /photo chunein/i }),
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Indian time formatting", () => {
  test("times read as 12-hour with am/pm", async ({ page }) => {
    await login(page);
    await page.goto("/app/dashboard");

    // The date line uses Indian short-date order: "Thu, 20 Aug".
    await expect(
      page.getByText(/^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2}$/),
    ).toBeVisible();

    // Any time shown must carry am/pm rather than being bare 24-hour.
    const times = page.getByText(/^\d{1,2}:\d{2}\s?(am|pm)$/i);
    const bare = page.getByText(/^([01]\d|2[0-3]):[0-5]\d$/);

    if ((await times.count()) > 0) {
      await expect(times.first()).toBeVisible();
    }
    expect(await bare.count()).toBe(0);
  });
});
