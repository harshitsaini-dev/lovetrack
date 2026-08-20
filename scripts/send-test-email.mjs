/**
 * Sends one test email through the real Resend pipeline.
 *
 *   node scripts/send-test-email.mjs you@example.com
 *
 * Only ever send this to an address you control. The seeded E2E accounts
 * use a domain nobody owns, and mailing those would generate bounces that
 * damage the sending domain's reputation.
 */

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const to = process.argv[2];

if (!to) {
  console.error("usage: node scripts/send-test-email.mjs <your-address>");
  process.exit(1);
}

if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
  console.error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set in .env.local");
  process.exit(1);
}

const BRAND = "#E11D48";
const INK = "#3B1220";
const MUTED = "#6B4453";
const BG = "#FFF8FB";

// Table-based layout with inline styles, because email clients are not
// browsers: no stylesheets, no reliable flexbox, no custom properties.
const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;">
    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0;font-size:17px;font-weight:600;color:${INK};">
        Love<span style="color:${BRAND};">Track</span>
      </p>
    </td></tr>

    <tr><td style="padding:22px 28px 0;">
      <h1 style="margin:0;font-size:20px;line-height:1.35;font-weight:600;color:${INK};">
        Email setup kaam kar raha hai
      </h1>
    </td></tr>

    <tr><td style="padding:12px 28px 0;">
      <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
        Ye email <strong style="color:${INK};">send.harshitsaini.in</strong> se bheji gayi hai.
        Agar ye seedhe inbox me aayi hai (spam me nahi), to DKIM aur SPF dono theek lage hain.
      </p>
    </td></tr>

    <tr><td style="padding:22px 28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${INK};">Ab tak kya chalu hai</p>
          <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
            &bull; Check-in / check-out — live camera + location<br>
            &bull; Lunch proof video<br>
            &bull; Leave — sirf jaankari, approval nahi<br>
            &bull; Daily reminder — aapke apne time par
          </p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 28px 0;">
      <a href="https://lovetrack.harshitsaini.in"
         style="display:inline-block;padding:12px 22px;border-radius:9px;background:${BRAND};color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;">
        LoveTrack kholein
      </a>
    </td></tr>

    <tr><td style="padding:26px 28px 28px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9B7183;">
        Ye ek setup test email hai. Asli notifications aapki Settings ke hisaab se aayengi,
        aur wahan se kabhi bhi band ki ja sakti hain.
      </p>
    </td></tr>
  </table>
</body></html>`;

const text = `LoveTrack — email setup kaam kar raha hai

Ye email send.harshitsaini.in se bheji gayi hai. Agar ye seedhe inbox me aayi
hai (spam me nahi), to DKIM aur SPF dono theek lage hain.

Ab tak kya chalu hai:
- Check-in / check-out — live camera + location
- Lunch proof video
- Leave — sirf jaankari, approval nahi
- Daily reminder — aapke apne time par

https://lovetrack.harshitsaini.in

Ye ek setup test email hai.`;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject: "LoveTrack — email setup test",
    html,
    text,
  }),
});

const body = await res.text();

console.log(`status: ${res.status}`);
console.log(body);
console.log(
  res.ok
    ? `\nBhej diya gaya -> ${to}\nInbox check karein (spam folder bhi).`
    : "\nBhejne me dikkat aayi.",
);
