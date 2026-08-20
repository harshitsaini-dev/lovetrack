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

/**
 * The code block used by both verification emails.
 *
 * Rendered as text, not an image — an image would be blocked by default in
 * most inboxes, and a code nobody can read is a code nobody can use.
 * `letter-spacing` is what makes 8 digits readable at a glance.
 */
function codeBlock(code: string): string {
  return `<div style="margin:22px 0;padding:16px;border-radius:10px;background:${BG};text-align:center;">
    <span style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:30px;font-weight:600;letter-spacing:6px;color:${INK};">${code}</span>
  </div>`;
}

/**
 * Signup verification.
 *
 * A code rather than a link, deliberately. Corporate mail scanners and link
 * previewers fetch every URL in an incoming message, and a one-time
 * confirmation link is consumed by that fetch — the real person then clicks
 * it and is told it already expired. A code cannot be spent by a machine
 * that merely reads the email.
 */
export function verificationCodeEmail(
  name: string | null,
  code: string,
  minutes: number,
): EmailContent {
  const who = name?.split(" ")[0] ?? "there";

  return {
    // The code is deliberately NOT in the subject, tempting as that is for
    // the notification preview. `sendEmail` writes every subject to
    // `email_logs`, which admins can read — putting it there would let any
    // admin read a code and take over the account. Only the body carries
    // it, and the body is never stored.
    subject: "LoveTrack verification code",
    html: wrap({
      heading: `${who}, ye raha aapka code`,
      body: `<p style="margin:0;">App me ye code daal dein — account verify ho jayega.</p>
             ${codeBlock(code)}
             <p style="margin:0;">Code ${minutes} minute me expire ho jaata hai.</p>`,
      footnote:
        "Agar aapne LoveTrack par account nahi banaya, to is email ko ignore kar dein — code ke bina kuch nahi hota.",
    }),
    text: `${who}, ye raha aapka code: ${code}\n\nApp me ye code daal dein. ${minutes} minute me expire ho jaata hai.\n\nAgar aapne account nahi banaya to ise ignore kar dein.`,
  };
}

/**
 * Password reset code.
 *
 * Says nothing about whether the account exists beyond the fact that the
 * mail arrived — someone who did not request this learns only that somebody
 * typed their address in, which they can safely ignore.
 */
export function passwordResetCodeEmail(
  name: string | null,
  code: string,
  minutes: number,
): EmailContent {
  const who = name?.split(" ")[0] ?? "there";

  return {
    // Same reasoning as above — the code stays out of the logged subject.
    subject: "LoveTrack password reset code",
    html: wrap({
      heading: `${who}, password reset ka code`,
      body: `<p style="margin:0;">Naya password set karne ke liye ye code daalein.</p>
             ${codeBlock(code)}
             <p style="margin:0;">Code ${minutes} minute me expire ho jaata hai.</p>`,
      footnote:
        "Agar aapne password reset request nahi kiya, to is email ko ignore kar dein — aapka password waisa hi rahega.",
    }),
    text: `${who}, password reset ka code: ${code}\n\n${minutes} minute me expire ho jaata hai.\n\nAgar aapne reset request nahi kiya to ise ignore kar dein — password waisa hi rahega.`,
  };
}

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
 * The daily nudge.
 *
 * Two kinds, because they are due at different moments and are about
 * different things: one chases a day that never started, the other a day
 * that never closed. A single "something is outstanding" mail had to wait
 * until after check-out time to be accurate, by which point a missed
 * check-in has already cost the morning.
 *
 * Deliberately says nothing about where anyone was and carries no photo --
 * just that something is outstanding.
 */
export function reminderEmail(
  name: string | null,
  kind: "check_in" | "check_out",
  appUrl: string,
): EmailContent {
  const who = name?.split(" ")[0] ?? "there";

  if (kind === "check_in") {
    return {
      subject: "Aaj ka check-in abhi baaki hai",
      html: wrap({
        heading: `${who}, aaj check-in nahi hua`,
        body: `<p style="margin:0 0 12px;">Aapne aaj abhi tak check-in nahi kiya hai.</p>
               <p style="margin:0;">Agar aaj chhutti hai, to app me leave mark kar dein — phir ye reminder nahi aayega.</p>`,
        cta: { href: `${appUrl}/app/check-in`, label: "Ab check-in karein" },
      }),
      text: `${who}, aaj check-in nahi hua.\n\nCheck-in karein: ${appUrl}/app/check-in\n\nAgar aaj chhutti hai to leave mark kar dein.`,
    };
  }

  return {
    subject: "Aaj ka din abhi band nahi hua",
    html: wrap({
      heading: `${who}, check-out baaki hai`,
      body: `<p style="margin:0 0 12px;">Aapka aaj ka din abhi complete nahi hua — check-out reh gaya hai.</p>
             <p style="margin:0;">Ek minute lagega.</p>`,
      cta: { href: `${appUrl}/app/check-out`, label: "Ab check-out karein" },
    }),
    text: `${who}, aaj ka check-out baaki hai.\n\nComplete karein: ${appUrl}/app/check-out`,
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

export type PartnerEventKind =
  | "check_in"
  | "lunch_start"
  | "lunch_end"
  | "check_out"
  | "leave";

const KIND_LINES: Record<PartnerEventKind, { heading: string; line: string }> = {
  check_in: { heading: "ne check-in kar liya", line: "unka din shuru ho gaya hai" },
  lunch_start: { heading: "lunch par gaye", line: "unka lunch break shuru hua" },
  lunch_end: { heading: "lunch se wapas aa gaye", line: "unka lunch break khatam" },
  check_out: { heading: "ne check-out kar liya", line: "unka din complete ho gaya" },
  leave: { heading: "aaj chhutti par hain", line: "unhone leave record ki hai" },
};

/**
 * "Your friend just checked in."
 *
 * Deliberately carries no location, no photo and no map link — only that
 * something happened. Quoting a place into an inbox takes it out of the
 * app's permission model and puts it somewhere neither person controls:
 * inbox search, a phone's lock screen, whatever forwards it next. Anyone
 * entitled to the place can open the app and see it there, where the
 * sharing switches still apply.
 *
 * No time either. It would have to be rendered in someone's timezone, and
 * the two people are not necessarily in the same one.
 */
export function partnerActivityEmail({
  actorName,
  recipientName,
  kind,
  detail,
  appUrl,
}: {
  actorName: string | null;
  recipientName: string | null;
  kind: PartnerEventKind;
  detail?: string | null;
  appUrl: string;
}): EmailContent {
  const who = actorName?.split(" ")[0] ?? "Aapke partner";
  const you = recipientName?.split(" ")[0];
  const { heading, line } = KIND_LINES[kind];

  return {
    subject: `${who} ${heading}`,
    html: wrap({
      heading: `${who} ${heading}`,
      body: `<p style="margin:0 0 12px;">${you ? `${you}, ` : ""}${who} — ${line}.</p>
             ${detail ? `<p style="margin:0 0 12px;">${detail}</p>` : ""}
             <p style="margin:0;">Poora record app me hai.</p>`,
      cta: { href: `${appUrl}/app/partner`, label: "Activity dekhein" },
    }),
    text: `${who} ${heading}.${detail ? `\n\n${detail}` : ""}\n\nPoora record: ${appUrl}/app/partner`,
  };
}
