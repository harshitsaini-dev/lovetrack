# ❤️ LoveTrack

**See when your friends start work, break for lunch, and head home.**

You and a friend pair with each other. From then on, each of you marks your own
day — check in when you reach work, mark lunch in and out, check out when you
leave — and the other can see it. Every entry is made with a live photo and the
location it was made from, so what you are looking at actually happened.

LoveTrack is not a tracker. Nobody appears in your app until you have both
agreed to pair. Nothing is recorded unless the person marks it themselves.
Between entries the app does not know or care where anyone is, and either side
can stop sharing at any moment.

Live at **[lovetrack.harshitsaini.in](https://lovetrack.harshitsaini.in)**.

> **On verification, plainly:** LoveTrack does not claim spoof-proof
> verification. It uses server-authoritative timestamps, fresh camera capture,
> single-use nonces, location plausibility checks and audit logging to make a
> faked entry substantially harder to produce and easy to spot. That is a
> different and more honest promise than "impossible to fake".

## What a day looks like

| Step | What happens |
|---|---|
| **Check-in** | Live photo + the location right then. The prompt greets your partner by name, so it reads like a message rather than a serial number. |
| **Lunch in** | Location only. No photo — the clip below covers this stretch. |
| **Lunch verify** | A 5–20 second clip, recorded *during* the meal. Lunch cannot be ended until it exists. |
| **Lunch out** | Location only. |
| **Check-out** | Live photo + location. |
| **Leave** | Information, not a request. You are telling your friend you are off today; nobody approves it, and you can withdraw it. |

The lunch clip sits in the middle on purpose. Recorded after the meal was
already marked complete — as it was originally — it proved nothing about the
stretch it was meant to cover, and a day could be marked "lunch complete" with
no clip at all.

## Features

- **Their working day, honestly timed** — the timestamp is the database's
  `now()`, so changing a phone's clock or timezone changes nothing
- **Lunch in and lunch out are separate**, so the length of the break is
  visible rather than hidden behind a single "Lunch" column
- **Live camera proof** — `getUserMedia()` only, no gallery upload
- **Location from anywhere** — no geofence, no fixed office. What is checked is
  whether the reading is genuine and accurate, not where it is
- **One-time capture** — location is read at the moment you mark something and
  never again. There is no "where are they now"
- **Tap a location to open it in Maps** — the installed app on Android and iOS,
  the web map everywhere else
- **Photos and clips, viewable any time** — from history, by a paired friend or
  an admin, as often as needed; nothing is a one-time look
- **Granular sharing** — attendance, location, lunch clip, leave and photos are
  five separate switches, each revocable, plus one-tap "stop all sharing"
- **Automatic reminders** — a daily nudge when the day is unfinished, at a time
  each person picks in their own timezone
- **Admin panel** — users, flagged captures, evidence media, audit log, data
  retention, and every tunable setting without a redeploy
- **Installable PWA** — mobile-first, safe-area aware, `prefers-reduced-motion`
  respected, custom offline / 404 / 500 / access-denied screens

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animation | Framer Motion |
| Auth + DB | Supabase (Auth, PostgreSQL, RLS) |
| Media | Supabase Storage (private buckets, signed URLs) |
| Email | Resend |
| Maps | Leaflet + OpenStreetMap |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Testing | Vitest (unit) + Playwright (E2E) + SQL-level verify scripts |
| Hosting | Vercel |
| Scheduled jobs | GitHub Actions cron → `/api/cron/reminders` |
| DNS | Cloudflare (`lovetrack.harshitsaini.in`) |

**Why not Cloudflare Workers:** Next.js 16 renamed `middleware.ts` to
`proxy.ts` and made it **Node-runtime only** — Next itself refuses to run it on
the edge. `@opennextjs/cloudflare` does not support Node middleware, so the two
block each other. Dropping `proxy.ts` was not an option: it carries the
per-request CSP nonce, and without it the CSP needs `unsafe-inline`, which
makes it close to decorative. The app runs on Vercel; the domain and DNS stay
on Cloudflare.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Open http://localhost:3000

**Windows shortcuts** — double-click, or from a terminal:

```bat
start.bat     :: start the dev server (port 3000)
stop.bat      :: stop whatever is on that port
restart.bat   :: stop + start
```

For another port: `set PORT=4000 && start.bat`

### Scripts

```bash
npm run dev              # dev server (Turbopack)
npm run build            # production build
npm run start            # serve the production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Vitest — pure logic (time, validation, CSP, prompts)
npm run check            # typecheck + lint + unit tests + build, in order
npm run verify:all       # 208 adversarial checks against the real database
npm run test:e2e         # Playwright — opens a real browser you can watch
npm run test:e2e:mobile  # phone viewport only
npm run test:e2e:ui      # Playwright's interactive UI mode
npm run test:e2e:headless # no browser window
npm run test:e2e:report  # open the last HTML report
```

E2E runs are **headed by default** on a developer machine — a real browser
window opens and the actions are slowed down so the run can be followed by eye.
CI runs headless. Force either mode with `HEADED=1` / `HEADED=0`.

The signed-in tests need a test account:

```bash
node scripts/seed-e2e-user.mjs   # creates it, prints the credentials
```

Put the printed `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` into `.env.local`.
Without them those tests skip themselves rather than fail.

### The three-layer test model

Every feature is verified in three places, because each layer catches a
different kind of bug:

| Layer | What it checks | What it catches |
|---|---|---|
| **Vitest** (`tests/unit/`) | Pure logic — timezone formatting, Zod schemas, the CSP builder, camera prompts | A wrong answer that does not depend on a database or a browser |
| **Verify scripts** (`scripts/verify-*.mjs`) | Supabase directly, adversarially — "can a partner read someone else's data?" | RLS holes, `SECURITY DEFINER` leaks, rate-limit bypasses |
| **Playwright** (`tests/e2e/`) | A real browser, phone viewport, fake camera | UI that silently drops correct data |

All three are necessary. The RLS scripts were once 21/21 green while the
partner page was quietly dropping every pair — only the E2E run caught it. It
has also gone the other way.

The E2E suite runs on **one worker, always**. It drives a handful of shared
real accounts, and `profile.spec` changes the test user's name and password
while other specs are signing in as them. In parallel that surfaces as logins
that silently produce no session, which reads as broken auth rather than as two
tests fighting over one account. Fixing it properly means an account per
worker, not a longer timeout.

### Database migrations

Run `supabase/migrations/*.sql` in order in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).

### Creating the first admin

There is **no way to become an admin from inside the app** — deliberately.
"Anyone can make themselves an admin" is not a bootstrap, it is a hole. The
first admin has to come from somewhere trusted.

1. **Sign up normally** at `/register` and confirm the emailed code. An admin
   is an ordinary user first.

2. **Promote the account** from your machine:

   ```bash
   node scripts/set-role.mjs you@example.com admin
   ```

   The script reads the service-role key from `.env.local`, so with production
   keys it updates the live database. Output:

   ```
   you@example.com -> admin
   ```

   Without a laptop, the same thing in the Supabase SQL Editor:

   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```

3. **Open `/admin`.** No need to sign in again — `requireAdmin()` reads the
   role from the database on every request, not from the session token. A
   `/forbidden` page means step 2 did not take effect.

To demote: `node scripts/set-role.mjs you@example.com user`

**Worth knowing:** an admin can view other people's evidence media. That is why
every admin action is written to `audit_logs` — including yours. Granting the
role is a real decision, not a convenience.

Admin routes: `/admin` (stats) · `/admin/users` · `/admin/users/[id]` (full
record and media) · `/admin/review` (flagged captures) · `/admin/settings` ·
`/admin/storage` (delete old data to stay inside the free tier) · `/admin/audit`
· `/admin/emails`

## Security model

- **Server-authoritative time.** An attendance timestamp is always the
  database's `now()`, never the device clock.
- **Single-use nonces.** Each capture is issued a short-lived nonce that is
  spent on use, so a submission cannot be replayed.
- **RLS everywhere.** A partner has **no direct read access** to attendance
  rows: latitude sits on the same row as the timestamp, and a row policy cannot
  grant one without the other. Partner reads go through `SECURITY DEFINER`
  functions that withhold each field according to its own switch.
- **Media access is decided in SQL.** There are three ways to open a photo and
  no fourth: it is yours, you are an admin, or its owner shares photos with
  you. An admin view is written to the audit log *before* the signed URL is
  minted — a view that cannot be recorded does not happen.
- **Verification codes never appear in an email subject.** Subjects are stored
  in `email_logs`, which admins can read; a code there would let any admin take
  over an account silently. The code lives only in the body, which is not
  stored.
- **CSP with a per-request nonce and `strict-dynamic`.** No `unsafe-inline`.
- **Permissions-Policy.** Camera, microphone and geolocation only; every other
  sensor is denied.
- **Rate limiting in Postgres**, on hashed identifiers, keyed on both IP and
  the identifier so neither alone is a way around it.
- **Risk scoring** from configurable signals. A flagged capture goes to admin
  review; it does not lock the user out.
- **Audit log** on every admin action and every settings change.

Detail: [docs/03-security-anti-fraud.md](./docs/03-security-anti-fraud.md)

## Authentication

Email confirmation and password reset both use **8-digit codes, not links**.

Mail scanners and link previewers fetch every URL in an incoming message, and
a one-time confirmation link is spent by that fetch — the real person then
clicks it and is told it has expired. A code cannot be spent by a machine that
merely reads the email.

Supabase's built-in mailer is not used at all. Accounts are created with
`admin.createUser`, codes are minted with `generateLink` (which returns a code
and sends nothing), and delivery goes through the app's own Resend templates —
so every auth email comes from the verified domain and lands in `email_logs`
like all other mail.

## Environment variables

Every key and its purpose is documented in
[`.env.example`](./.env.example). Never commit real values — `.env.local` is
gitignored.

Most things are **not** environment variables. Accuracy limits, risk
thresholds and signal weights, nonce lifetime, signed-URL lifetime, lunch clip
limits and data retention are all configured at `/admin/settings`, because they
are product decisions rather than deployment facts and changing one should not
need a redeploy. Every change is audit-logged.

## Deployment

The app deploys to **Vercel**; the domain and DNS stay on **Cloudflare**.

```bash
npx vercel            # first time — link the project
npx vercel --prod     # production deploy
```

1. **Env vars** — Vercel → Settings → Environment Variables. Everything from
   `.env.example` except the `E2E_*` keys, plus
   `NEXT_PUBLIC_APP_URL=https://lovetrack.harshitsaini.in`.
2. **Domain** — Vercel → Domains → add `lovetrack.harshitsaini.in`.
3. **Cloudflare DNS** — add the CNAME with **grey cloud (DNS only)**. Leaving
   the orange proxy on stops Vercel issuing a certificate; this is the most
   common mistake.
4. **Supabase** → Authentication → URL Configuration: set the Site URL and add
   `https://lovetrack.harshitsaini.in/**` as a redirect.
5. **GitHub Secrets** → `APP_URL` and `CRON_SECRET`, for the reminders
   workflow.

Reminders run from [a GitHub Actions
cron](./.github/workflows/reminders.yml) rather than Vercel Cron, which on the
Hobby plan fires only once a day. Reminder times are per-user and per-timezone,
so the endpoint has to run often and let the database decide who is due; it is
idempotent, so extra or late runs cost nothing.

Full guide, including the DMARC roadmap:
[docs/07-deployment.md](./docs/07-deployment.md)

## Documentation

| Doc | Content |
|---|---|
| [docs/00-project-state.md](./docs/00-project-state.md) | Current status — what is built, what is not |
| [docs/implementation-plan.md](./docs/implementation-plan.md) | Locked decisions and the phase plan |
| [docs/01-architecture.md](./docs/01-architecture.md) | Architecture, stack, data flow |
| [docs/02-database-schema.md](./docs/02-database-schema.md) | Tables, relationships, RLS |
| [docs/03-security-anti-fraud.md](./docs/03-security-anti-fraud.md) | Security model, anti-spoofing, risk scoring |
| [docs/04-phases-and-tasks.md](./docs/04-phases-and-tasks.md) | 12 phases with task checklists |
| [docs/05-hourly-plan.md](./docs/05-hourly-plan.md) | Execution timeline |
| [docs/06-testing-plan.md](./docs/06-testing-plan.md) | Unit + E2E test matrix |
| [docs/07-deployment.md](./docs/07-deployment.md) | Deployment and free-tier setup |

## Limitations (the honest list)

- A browser cannot fully prevent faked GPS, a virtual camera, or an emulator.
  LoveTrack makes those *harder and detectable*, not impossible.
- **There is no live or continuous location tracking — by design.** Location is
  read only at the moment someone marks an entry. After that the app does not
  look. A friend never sees "where you are now", only where you were when you
  marked something.
- EXIF metadata is never treated as proof.
- IP and timezone mismatch checks are heuristics. A VPN can produce a false
  positive.
- **Device binding is advisory, not cryptographic.** WebCrypto-based binding
  was deliberately deferred — showing "device verified" on a half-built
  implementation is worse than not showing it.
- Media currently lives in **Supabase Storage**, not R2. The media layer has a
  clean seam for that move when video volume makes it worth doing.

## Privacy notes

- Sharing starts only after **both people accept a pairing**.
- Five separate switches — attendance, location, lunch clip, leave, photos —
  each visible on the partner screen and revocable at any moment, plus a
  one-tap **stop all sharing**.
- All switches are **on by default** once a pair is accepted. That is a
  deliberate choice: people pair on purpose and expect to see each other's day,
  and starting blank made the app look broken. What keeps it honest is that
  every switch stays visible and can be turned off immediately.
- Turning photos off does not pretend the photo never existed — a friend still
  sees that one was taken, just not the photo. Hiding the difference would
  misrepresent what happened.
- All evidence media is private, reachable only through short-lived signed
  URLs, and every admin view is audit-logged.

## License

Private project.
