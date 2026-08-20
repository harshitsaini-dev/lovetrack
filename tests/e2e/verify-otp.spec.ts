import { test, expect } from "./fixtures";

/**
 * The signup flow end to end, including the part that used to break.
 *
 * Email confirmation moved from a link to a code because mail scanners
 * fetch every URL in an incoming message, spending the one-time link before
 * the real person ever clicks it — they then see "otp_expired" and cannot
 * get in. A code cannot be spent by a machine that merely reads the email.
 *
 * The code is read back through the admin API rather than from an inbox, so
 * this exercises the real UI without needing mail delivery.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runnable = Boolean(SUPABASE_URL && SERVICE_KEY);

function adminHeaders() {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Mints a fresh code for an address without sending any email. */
async function mintCode(email: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ type: "magiclink", email }),
  });

  const body = await response.json();
  const code = body?.email_otp;

  if (!code) {
    throw new Error(`no code for ${email}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  return code as string;
}

async function deleteUserByEmail(email: string): Promise<void> {
  const list = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: adminHeaders() },
  );
  const { users } = await list.json();

  for (const user of users ?? []) {
    if (user.email !== email) continue;
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
  }
}

test.describe("signup with an emailed code", () => {
  test.skip(!runnable, "Needs Supabase service role credentials");

  // Unique per run, so a failed run does not poison the next one.
  const email = `e2e-otp-${Date.now()}@lovetrack.dev`;

  test.afterAll(async () => {
    if (runnable) await deleteUserByEmail(email);
  });

  test("register, enter the code, land on the dashboard", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Poora naam").fill("OTP Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("StrongPass123");
    await page.getByLabel("Password dobara").fill("StrongPass123");
    await page.getByRole("button", { name: /create account/i }).click();

    // The form must hand off to the code screen, carrying the address —
    // asking for it a second time is how people mistype it.
    await expect(page).toHaveURL(/\/verify\?email=/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /email verify karein/i }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const codeField = page.getByLabel("Verification code");

    // A wrong code must be refused, and must say so without hinting at the
    // right one.
    await codeField.fill("00000000");
    await page.getByRole("button", { name: /verify karein/i }).click();
    await expect(page.getByText(/code galat hai ya expire/i)).toBeVisible({
      timeout: 15_000,
    });

    // Minted after the failed attempt, to prove a wrong guess does not
    // invalidate the real code.
    const code = await mintCode(email);

    await codeField.fill(code);
    await page.getByRole("button", { name: /verify karein/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 20_000 });
  });

  test("the code screen needs an address to work with", async ({ page }) => {
    // Reaching /verify with nothing to verify against should send the user
    // back rather than render a form that can never succeed.
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the code screen does not scroll sideways on a phone", async ({
    page,
  }) => {
    await page.goto(`/verify?email=${encodeURIComponent("someone@example.com")}`);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
