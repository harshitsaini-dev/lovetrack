# Phases & Tasks (12-Phase Development Order)

Spec (`project.md`, section 28) me defined exact order â€” is order ko follow karna mandatory hai, skip/reorder nahi karna.

Legend: `[ ]` pending, `[~]` in progress, `[x]` done â€” status manually update karte raho jaise-jaise kaam hota hai.

---

## PHASE 1 â€” Repository + Next.js + styling + architecture

**Status: [ ] pending**

Tasks:
- [ ] `git init`, `.gitignore`
- [ ] Next.js + TypeScript scaffold (App Router)
- [ ] Tailwind CSS + shadcn/ui install & configure
- [ ] Framer Motion install
- [ ] Base folder structure (`app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`, `supabase/`, `tests/`, `public/`, `docs/`)
- [ ] `.env.example` create
- [ ] `docs/implementation-plan.md` create (mandatory first-task deliverable per master prompt)

Exit criteria: `npm run dev` chal raha ho, blank branded landing page render ho.

## PHASE 2 â€” Supabase Auth + DB + RLS + profile

**Status: [x] COMPLETE**

Tasks:
- [x] Supabase project setup (project `<project-ref>`, keys in `.env.local`)
- [x] Migration `0001_profiles.sql` â€” enums, `profiles`, triggers, `is_admin()`, RLS
- [x] Auth: email/password, forgot password, password reset, email verification
- [x] Protected routes via `proxy.ts` (Next 16 renamed `middleware` â†’ `proxy`)
- [x] Role-based authorization scaffold (`user` / `admin`) + suspended-account handling
- [x] `/auth/recover` self-heal route for profile-less accounts (prevents redirect loop)
- [x] Mobile-first auth screens + app shell (bottom nav on phones, header nav on desktop)
- [x] Playwright E2E suite â€” 24 tests passing on mobile + desktop

Exit criteria: âœ… register â†’ login â†’ protected dashboard; RLS verified against live DB â€”
role escalation blocked (403), self-unsuspend blocked (403), cross-user reads return nothing,
own-profile edits allowed, cascade delete confirmed.

## PHASE 3 â€” Pairing + permissions

**Status: [x] COMPLETE**

Tasks:
- [x] `pairs`, `pair_permissions` tables (migration 0003)
- [x] `request_pairing()` â€” email lookup inside a SECURITY DEFINER function so the client never queries `profiles` by email, and unknown addresses return the same answer as real ones (no account enumeration)
- [x] Send / withdraw / accept / decline / revoke, all through RLS-enforced updates
- [x] Per-direction sharing: `share_attendance`, `share_location`, `share_lunch_proof`, `share_leave` â€” each user owns their own row
- [x] Location sharing defaults to **off** (most sensitive field is opt-in)
- [x] Always-visible "Sab sharing band karein" control
- [x] `can_view_shared()` helper â€” the gate that Phases 4-6 will hang their RLS on
- [x] `get_pair_partners()` (migration 0004) â€” partner identity without widening `profiles` RLS
- [x] Fix for the re-pairing bug (migration 0005)

Exit criteria: âœ… 24/24 RLS checks + 6 UI E2E tests pass; revoking stops sharing immediately.

### Two bugs this phase found (both would have shipped)

**1. Partner name/email never rendered.** `profiles` RLS only exposes your own row, so the partner lookup came back empty and `toView()` silently dropped every pair. Fixed by `get_pair_partners()`, which returns only the four fields the UI shows â€” rather than widening the profiles policy and exposing role, status and notification settings.

**2. Re-pairing was impossible.** The `pairs` UPDATE policy pinned the members with a correlated subquery. It is evaluated as the calling user, so it returned one row while only one pair existed â€” and `21000: more than one row returned by a subquery` the moment the same two people had a second pair row. Since unpairing leaves a `revoked` row behind, **any couple could pair exactly once, ever**. Fixed in migration 0005 by moving immutability into a trigger, where a table invariant belongs.

Both were invisible to API-level RLS testing (21/21 green) and only surfaced when the flow was driven through the UI with two real accounts. `scripts/verify-pairing-rls.mjs` now carries a regression check for the second one.

## PHASE 4 â€” Check-in/check-out + camera + location + nonce + server time

**Status: [x] COMPLETE**

### The central design decision

**A client cannot write an attendance record.** `attendance` and
`attendance_events` have no INSERT or UPDATE policy at all. The only way in is
`record_attendance_event()`, which in a single transaction consumes the nonce,
enforces the state machine, scores the risk and stamps the time.

The client supplies raw signals it inherently owns â€” coordinates from the
device, a photo it just captured. It never supplies conclusions. A client that
lies about `accuracy_m` is scored on the value it sent; one that tries to send
`verification_status` finds it is not an input.

### What is checked

| Signal | Outcome |
|---|---|
| accuracy > 100m | rejected |
| accuracy > 50m | +25, flagged if alone with others |
| fix older than 30s | rejected â€” a cached fix is the easiest way to submit a place you have left |
| implied speed > 900 km/h | +40 |
| coordinates identical to previous | +15 (see migration 0008) |
| score â‰¥ 30 / â‰¥ 80 | flagged / rejected |

Every contributing signal is written to `risk_events`, so a score is always
explainable to the user and to an admin.

### Other decisions worth remembering

- **Nonce**: 3-minute TTL, single use, bound to both the user and the specific
  action. Issued immediately before submission rather than on page load.
- **`maximumAge: 0`** on the geolocation call. Without it the browser returns a
  cached fix and the entire location check quietly becomes theatre.
- **No file input anywhere in the flow.** If the camera cannot open, the flow
  stops with an explanation rather than falling back to "pick an image" â€” that
  fallback would hand back exactly the capability the design removes.
- **Challenge phrase** is a deterrent, not proof: nothing verifies it was
  actually shown. Deterministic per user per day so a refresh does not change it.
- **Photos are not shared with partners.** They are anti-fraud evidence, not
  part of an activity feed â€” user and admin only.
- **Place names, not coordinates**, lead the UI. Reverse geocoding runs
  server-side (Nominatim asks for an identifying User-Agent and â‰¤1 req/sec,
  neither of which is possible from the browser), with a cache and graceful
  failure. Coordinates and accuracy stay visible underneath, and a Leaflet map
  shows the accuracy circle â€” the honest part of the picture.

### Bugs found while testing

**The result screen was being destroyed before it could be read.** Both
`router.refresh()` and `revalidatePath()` inside the action re-render the
capture page, whose guard then sees the day has moved on and redirects to the
dashboard. The user completed a check-in and was bounced away without ever
seeing their verification signals. Neither is needed: these pages are dynamic,
so there is no cached render to invalidate.

**Zero-drift scoring flagged honest users.** It was worth 30 points, which on
its own crossed the flag threshold. The reasoning â€” real GPS always jitters â€”
holds for a phone but not for a laptop positioned by Wi-Fi, which returns
byte-identical coordinates. Reduced to 15 in migration 0008, and the point
values moved into `system_settings` so future tuning is a settings change.

Tasks:
- [x] `getUserMedia()` camera capture flow â€” no file input, no fallback
- [x] Canvas frame capture + WebP compression (~50KB)
- [x] One-time geolocation capture with `maximumAge: 0`
- [x] Server-authoritative timestamp
- [x] Single-use nonce + replay protection
- [x] Location genuineness validation â€” **no geofence**
- [x] Reverse geocoding (server-side, cached, rate-limited)
- [x] Leaflet map with accuracy circle
- [x] Risk scoring engine with per-signal explanations
- [x] `attendance`, `attendance_events`, `attendance_nonces`, `risk_events`, `system_settings` (migrations 0006, 0008)
- [x] Private photo storage with per-user path policies (migration 0007)
- [x] Daily challenge phrase
- [x] Dashboard, history, check-in and check-out screens
- [ ] Device binding via WebCrypto key â€” deferred to Phase 9; a device label is recorded now

Exit criteria: âœ… 24/24 adversarial API checks + 6 UI E2E tests; 42 E2E total.

## PHASE 5 â€” Lunch recording + R2

**Status: [ ] pending**

Tasks:
- [ ] Lunch start/end flow (location + server timestamp)
- [ ] `MediaRecorder` video capture (5-20s), challenge phrase overlay
- [ ] Cloudflare R2 setup (manual action â€” bucket/keys)
- [ ] Direct upload to private bucket
- [ ] Signed URL generation (short expiry)
- [ ] `lunch_sessions`, `lunch_proofs` tables wired

Exit criteria: lunch video uploads, only signed URL access works, direct public URL fails.

## PHASE 6 â€” Leave + reminders + Resend

**Status: [x] COMPLETE**

### Leave is information, not a request

Migration 0012 first modelled leave the way an HR system would: pending,
approved, rejected, reviewer columns, an approval setting. **That was the
wrong shape**, and migration 0013 removed it.

LoveTrack is two people keeping each other in the loop. "I'm off today" is a
statement, not a petition â€” there is nobody whose permission is required,
and an approval queue only adds a step that always ends in yes.

Two states now: **recorded**, or **withdrawn** if it was entered by mistake.

What is still enforced at the database level:

- a reason is mandatory â€” whitespace does not count
- a day cannot be both worked and taken off (trigger against `attendance`)
- **the reason cannot be edited afterwards.** The whole entry can be
  withdrawn, but not rewritten: it is what the person said on the day
- leave is invisible to a partner unless `share_leave` is on, and it is off
  by default

### Email

- every send is logged, **including failures** â€” an email that silently did
  not arrive is worse than one that visibly bounced, because nobody goes
  looking for it
- duplicates are prevented by a unique index on
  `(user_id, template, dedup_key)`, so a cron retry collides instead of
  reminding somebody twice
- templates deliberately say little: no location, no photo. Putting those in
  an inbox takes them outside the app's permission model, somewhere neither
  person controls

### Reminders

The cron runs **every 15 minutes**, not once at a fixed hour, because each
user picks their own reminder time in their own timezone â€” there is no single
moment when "the reminders go out".

`CRON_SECRET` is compared in constant time, and the endpoint **refuses to run
at all** when no secret is configured rather than defaulting to permissive â€”
otherwise it would be an open mailer.

Nobody is reminded who: has finished the day, is on leave, has reminders off,
or has already been emailed today.

Tasks:
- [x] `leave_requests` table + form (mandatory reason)
- [x] ~~Admin approval flow~~ â€” removed; leave is information (migration 0013)
- [x] Resend setup â€” `send.harshitsaini.in` verified, test email delivered to inbox (not spam)
- [x] Email templates (welcome, reminder, leave recorded)
- [x] Reminder endpoint â€” `/api/cron/reminders`, secret-protected
- [x] `email_logs` dedup logic (no duplicate reminders)
- [ ] Cloudflare Cron trigger wiring â€” Phase 12, alongside deployment

Exit criteria: âœ… 20 adversarial API checks + 4 UI tests; 86 E2E total.

> âš ï¸ **Never run the reminder cron against the seeded E2E accounts with a
> live Resend key.** They use `@lovetrack.dev`, a domain nobody owns, and
> mailing it generates bounces that damage the sending domain's reputation.

## PHASE 7 â€” Partner activity

**Status: [x] COMPLETE**

### The security problem this phase turned on

RLS grants a partner the `attendance_events` row when `share_attendance` is
on. But **latitude and longitude are columns on that same row.** A row policy
is all-or-nothing: grant the row and the coordinates come with it.

So a partner meant to see only *"checked in at 9:12 am"* could read exactly
where from â€” with the location switch off. Column-level privileges cannot
express it either, because the answer depends on a per-pair setting rather
than on the role.

**Fix, in two steps:**

1. Migration 0014 â€” partner reads go through SECURITY DEFINER functions that
   null every location field unless `can_view_shared(owner, 'location')`.
2. Migration 0015 â€” **removed the partner's direct read policy entirely.**

Step 2 mattered. After 0014 the functions were correct but the row policies
were still there, so a partner could skip the app and read the table with
their own token:

```
GET /rest/v1/attendance_events?select=latitude,longitude&user_id=eq.<them>
```

A privacy control that only holds while you use the intended screen is not a
control. Anyone who opened devtools could bypass the switch. The functions
are SECURITY DEFINER so they never needed those policies; what changed is
that there is no longer a second route.

### Other decisions

- **A place name is a location.** "Janakpuri, Delhi" tells you as much as
  coordinates, so it sits behind the same switch.
- **Rejected submissions are never shown.** An attempt that did not count is
  not activity; it stays between its author and an admin.
- The empty state distinguishes *"they don't share this"* from *"nothing
  happened"* â€” two very different things, and silence implies the second.
- Nothing on this screen is live. Every pin is a place a capture already
  happened; LoveTrack does not track anyone.

Tasks:
- [x] Partner dashboard UI â€” today's attendance state (checked in / lunch / checked out)
- [x] Event timeline â€” har event ka time + captured location (consent-gated)
- [x] Leaflet + OpenStreetMap â€” **static pins for past events**, koi live moving marker nahi
- [x] Refresh on page load â€” **no location polling**
- [x] Per-partner history page at `/app/partner/[partnerId]`
- [x] Today's leave surfaced, so a quiet day reads as "on leave" not "nothing happened"

Exit criteria: âœ… 22 adversarial API checks + 5 UI tests; 91 E2E total.

> **Scope guard:** ye "partner kahan hai abhi" wala feature **nahi** hai. Ye "partner ne kab aur kahan se attendance mark ki" wala feature hai. Detail: [03-security-anti-fraud.md](./03-security-anti-fraud.md) section "Live location â€” build hi nahi karni".

Exit criteria: partner sees only explicitly-shared data â€” event history with per-event locations, **no live position**.

## PHASE 8 â€” Admin

**Status: [ ] pending**

Tasks:
- [ ] Admin dashboard (stat cards + charts)
- [ ] Users, pairings, attendance, leaves management
- [ ] Suspicious activity review screen
- [ ] Media evidence viewer (signed URLs only)
- [ ] Email logs viewer
- [ ] Audit logs viewer
- [ ] System settings (thresholds configurable)
- [ ] User suspension / device revoke actions

Exit criteria: all sensitive admin actions generate audit log entries.

## PHASE 9 â€” Risk engine + security hardening

**Status: [ ] pending**

Tasks:
- [ ] Finalize risk scoring bands (0-29/30-59/60-79/80-100)
- [ ] Rate limiting on API/Worker routes
- [ ] CSP + Permissions Policy headers
- [ ] CSRF protection review
- [ ] `risk_events` logging complete
- [ ] Full security checklist pass (see [03-security-anti-fraud.md](./03-security-anti-fraud.md))

Exit criteria: full security checklist all-green.

## PHASE 10 â€” PWA + animations + accessibility

**Status: [ ] pending**

Tasks:
- [ ] `manifest.json`, service worker (next-pwa/Workbox)
- [ ] Icons, install prompt
- [ ] Light/dark theme (LoveTech aesthetic â€” not childish)
- [ ] Framer Motion micro-interactions, `prefers-reduced-motion` respected
- [ ] Keyboard nav, focus states, ARIA, contrast, touch targets

Exit criteria: installable PWA, accessibility checklist pass (see [06-testing-plan.md](./06-testing-plan.md)).

## PHASE 11 â€” Unit tests + Playwright MCP + E2E

**Status: [ ] pending**

Tasks:
- [ ] Vitest unit tests (location validation, distance/speed calc, risk score, nonce, state machine, leave validation, pairing permission, reminder eligibility)
- [ ] Playwright MCP installed: `claude mcp add playwright npx @playwright/mcp@latest`
- [ ] Full E2E flow suite (26 flows â€” see [06-testing-plan.md](./06-testing-plan.md))
- [ ] Mobile viewport + accessibility E2E checks

Exit criteria: lint + typecheck + unit + e2e all pass.

## PHASE 12 â€” Build + deployment + GitHub + README

**Status: [ ] pending**

Tasks:
- [ ] Production build clean
- [ ] Cloudflare Pages deployment
- [ ] GitHub repo push, meaningful commit history
- [ ] README complete (overview, architecture, security, setup, env vars, limitations, privacy notes)
- [ ] Final smoke test on deployed URL

Exit criteria: `lovetrack.pages.dev` live, README complete, all manual actions documented.

---

## Git branch convention

```text
main
â”œâ”€â”€ feat/auth
â”œâ”€â”€ feat/attendance
â”œâ”€â”€ feat/lunch
â”œâ”€â”€ feat/admin
â”œâ”€â”€ feat/email
â””â”€â”€ fix/*
```

Commit message style: `feat: implement secure check-in`, `fix: harden geolocation validation`, `docs: add deployment guide`, `test: add attendance e2e flows`.
