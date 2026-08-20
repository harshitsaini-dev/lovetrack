import "server-only";

/**
 * Email templates.
 *
 * Plain inline-styled HTML with a text alternative, because email clients
 * are not browsers: no stylesheets, no flexbox worth relying on, and a
 * meaningful share of readers see the text part only.
 *
 * These say what happened and nothing more. An attendance notification that
 * quotes a location into an inbox has taken data out of the app's
 * permission model and put it somewhere neither person controls.
 */

const BRAND = "#E11D48";
const INK = "#3B1220";
const MUTED = "#6B4453";
const BG = "#FFF8FB";

type Layout = {
  heading: string;
  body: string;
  cta?: { href: string; label: string };
  footnote?: string;
};

function wrap({ heading, body, cta, footnote }: Layout): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0;font-size:17px;font-weight:600;color:${INK};">
        Love<span style="color:${BRAND};">Track</span>
      </p>
    </td></tr>
    <tr><td style="padding:20px 28px 0;">
      <h1 style="margin:0;font-size:19px;line-height:1.4;font-weight:600;color:${INK};">${heading}</h1>
    </td></tr>
    <tr><td style="padding:12px 28px 0;">
      <div style="font-size:15px;line-height:1.6;color:${MUTED};">${body}</div>
    </td></tr>
    ${
      cta
        ? `<tr><td style="padding:24px 28px 0;">
             <a href="${cta.href}" style="display:inline-block;padding:12px 22px;border-radius:9px;background:${BRAND};color:#fff;font-size:15px;font-weight:500;text-decoration:none;">${cta.label}</a>
           </td></tr>`
        : ""
    }
    <tr><td style="padding:28px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9B7183;">
        ${footnote ?? "Ye email aapko isliye mili kyunki aapne LoveTrack me ye notification on kar rakhi hai. Settings me kabhi bhi band kar sakte hain."}
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export type EmailContent = { subject: string; html: string; text: string };

export function welcomeEmail(name: string | null, appUrl: string): EmailContent {
  const who = name?.split(" ")[0] ?? "there";

  return {
    subject: "LoveTrack me aapka swagat hai",
    html: wrap({
      heading: `Welcome, ${who}`,
      body: `<p style="margin:0 0 12px;">LoveTrack taiyaar hai. Pehla check-in karne ke liye app kholein.</p>
             <p style="margin:0;">Yaad rahe: kuch bhi share tab tak nahi hota jab tak aap khud kisi ko pair aur permission na dein.</p>`,
      cta: { href: `${appUrl}/app/dashboard`, label: "Dashboard kholein" },
      footnote: "Ye ek welcome email hai, ise band nahi kiya ja sakta.",
    }),
    text: `Welcome, ${who}\n\nLoveTrack taiyaar hai. Pehla check-in karne ke liye app kholein: ${appUrl}/app/dashboard\n\nKuch bhi share tab tak nahi hota jab tak aap khud kisi ko pair aur permission na dein.`,
  };
}

/**
 * Daily nudge when the day is unfinished.
 *
 * Deliberately does not say where anyone was or attach a photo — just that
 * something is outstanding.
 */
export function reminderEmail(
  name: string | null,
  pending: string[],
  appUrl: string,
): EmailContent {
  const who = name?.split(" ")[0] ?? "there";
  const list = pending.map((item) => `<li>${item}</li>`).join("");

  return {
    subject: "Aaj ki activity abhi adhoori hai",
    html: wrap({
      heading: `${who}, aaj ka din abhi complete nahi hua`,
      body: `<p style="margin:0 0 12px;">Ye baaki hai:</p>
             <ul style="margin:0 0 12px;padding-left:20px;">${list}</ul>
             <p style="margin:0;">Agar aaj chhutti thi, to app me leave mark kar dein — phir ye reminder nahi aayega.</p>`,
      cta: { href: `${appUrl}/app/dashboard`, label: "Ab complete karein" },
    }),
    text: `${who}, aaj ka din abhi complete nahi hua.\n\nBaaki hai:\n${pending
      .map((item) => `- ${item}`)
      .join("\n")}\n\nComplete karein: ${appUrl}/app/dashboard\n\nAgar aaj chhutti thi to leave mark kar dein.`,
  };
}

/**
 * Confirmation that a leave day was recorded.
 *
 * Nothing is pending and nobody is reviewing it — leave is a statement, not
 * a request — so this just confirms what the app now knows.
 */
export function leaveRecordedEmail(
  leaveDate: string,
  appUrl: string,
): EmailContent {
  return {
    subject: `Leave record ho gayi — ${leaveDate}`,
    html: wrap({
      heading: `${leaveDate} ki leave record ho gayi`,
      body: `<p style="margin:0;">Us din ke liye koi reminder nahi bhejenge. Galti se add ho gayi ho to app se hata sakte hain.</p>`,
      cta: { href: `${appUrl}/app/leave`, label: "Leave dekhein" },
    }),
    text: `${leaveDate} ki leave record ho gayi.\n\nUs din koi reminder nahi aayega. Galti se add hui ho to app se hata sakte hain: ${appUrl}/app/leave`,
  };
}
