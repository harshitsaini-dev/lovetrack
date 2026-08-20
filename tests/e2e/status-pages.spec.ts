import { test, expect, type Page } from "@playwright/test";

/**
 * The pages that appear when something is wrong or missing, plus the SEO
 * surface — which for this app is mostly about what must NOT be indexed.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
}

test.describe("status pages", () => {
  test("an unknown URL gets a real 404 page, not a blank one", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page-anywhere");

    expect(response?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /page nahi mila/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });

  test("access denied explains itself and offers a way out", async ({
    page,
  }) => {
    await page.goto("/forbidden");

    await expect(page.getByText("403")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /access nahi hai/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /dashboard par jaayein/i }),
    ).toBeVisible();
  });

  test("the offline page reflects the connection state", async ({ page }) => {
    await page.goto("/offline");

    // Online in the test browser, so it should say so rather than
    // insisting the user is offline.
    await expect(
      page.getByRole("heading", { name: /connection wapas aa gaya/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reload karein/i }),
    ).toBeVisible();
  });

  test("status pages do not scroll sideways on a phone", async ({ page }) => {
    for (const path of ["/no-such-page", "/forbidden", "/offline"]) {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${path} overflows`).toBe(false);
    }
  });
});

test.describe("admin access", () => {
  test.skip(!EMAIL || !PASSWORD, "Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

  test("an ordinary user is sent to the access-denied page", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/admin/storage");

    // A bounce to the dashboard with no explanation reads like a bug; this
    // is a boundary, and says so.
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(
      page.getByRole("heading", { name: /access nahi hai/i }),
    ).toBeVisible();
  });
});

test.describe("SEO", () => {
  test("robots.txt keeps crawlers out of everything private", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();

    // The public surface.
    expect(body).toContain("Allow: /login");

    // Everything that holds somebody's data, plus the routes that carry
    // one-time auth tokens.
    for (const path of ["/app/", "/admin/", "/auth/", "/api/"]) {
      expect(body, `${path} should be disallowed`).toContain(
        `Disallow: ${path}`,
      );
    }

    expect(body).toContain("Sitemap:");
  });

  test("the sitemap lists only public pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();

    expect(body).toContain("/login");
    expect(body).toContain("/register");
    // Listing a private route would hand crawlers a map of it.
    expect(body).not.toContain("/app/");
    expect(body).not.toContain("/admin");
  });

  test("signed-in pages are marked noindex", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "Needs the E2E account");

    await login(page);

    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");

    expect(robots).toContain("noindex");
  });

  test("the landing page carries link-preview metadata", async ({ page }) => {
    await page.goto("/");

    for (const property of ["og:title", "og:description", "og:image"]) {
      await expect(
        page.locator(`meta[property="${property}"]`),
      ).toHaveCount(1);
    }

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });
});
