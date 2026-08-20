# Phases & Tasks (12-Phase Development Order)

Spec (`project.md`, section 28) me defined exact order — is order ko follow karna mandatory hai, skip/reorder nahi karna.

Legend: `[ ]` pending, `[~]` in progress, `[x]` done — status manually update karte raho jaise-jaise kaam hota hai.

---

## PHASE 1 — Repository + Next.js + styling + architecture

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

## PHASE 2 — Supabase Auth + DB + RLS + profile

**Status: [x] COMPLETE**

Tasks:
- [x] Supabase project setup (project `<project-ref>`, keys in `.env.local`)
- [x] Migration `0001_profiles.sql` — enums, `profiles`, triggers, `is_admin()`, RLS
- [x] Auth: email/password, forgot password, password reset, email verification
- [x] Protected routes via `proxy.ts` (Next 16 renamed `middleware` → `proxy`)
- [x] Role-based authorization scaffold (`user` / `admin`) + suspended-account handling
- [x] `/auth/recover` self-heal route for profile-less accounts (prevents redirect loop)
- [x] Mobile-first auth screens + app shell (bottom nav on phones, header nav on desktop)
- [x] Playwright E2E suite — 24 tests passing on mobile + desktop

Exit criteria: ✅ register → login → protected dashboard; RLS verified against live DB —
role escalation blocked (403), self-unsuspend blocked (403), cross-user reads return nothing,
own-profile edits allowed, cascade delete confirmed.

## PHASE 3 — Pairing + permissions

**Status: [x] COMPLETE**

Tasks:
- [x] `pairs`, `pair_permissions` tables (migration 0003)
- [x] `request_pairing()` — email lookup inside a SECURITY DEFINER function so the client never queries `profiles` by email, and unknown addresses return the same answer as real ones (no account enumeration)
- [x] Send / withdraw / accept / decline / revoke, all through RLS-enforced updates
- [x] Per-direction sharing: `share_attendance`, `share_location`, `share_lunch_proof`, `share_leave` — each user owns their own row
- [x] Location sharing defaults to **off** (most sensitive field is opt-in)
- [x] Always-visible "Sab sharing band karein" control
- [x] `can_view_shared()` helper — the gate that Phases 4-6 will hang their RLS on
- [x] `get_pair_partners()` (migration 0004) — partner identity without widening `profiles` RLS
- [x] Fix for the re-pairing bug (migration 0005)

Exit criteria: ✅ 24/24 RLS checks + 6 UI E2E tests pass; revoking stops sharing immediately.

### Two bugs this phase found (both would have shipped)

**1. Partner name/email never rendered.** `profiles` RLS only exposes your own row, so the partner lookup came back empty and `toView()` silently dropped every pair. Fixed by `get_pair_partners()`, which returns only the four fields the UI shows — rather than widening the profiles policy and exposing role, status and notification settings.

**2. Re-pairing was impossible.** The `pairs` UPDATE policy pinned the members with a correlated subquery. It is evaluated as the calling user, so it returned one row while only one pair existed — and `21000: more than one row returned by a subquery` the moment the same two people had a second pair row. Since unpairing leaves a `revoked` row behind, **any couple could pair exactly once, ever**. Fixed in migration 0005 by moving immutability into a trigger, where a table invariant belongs.

Both were invisible to API-level RLS testing (21/21 green) and only surfaced when the flow was driven through the UI with two real accounts. `scripts/verify-pairing-rls.mjs` now carries a regression check for the second one.

## PHASE 4 — Check-in/check-out + camera + location + nonce + server time

**Status: [ ] pending**

Tasks:
- [ ] `getUserMedia()` camera capture flow (no file input)
- [ ] Canvas frame capture + compression
- [ ] Geolocation capture (lat/lng/accuracy/heading/speed)
- [ ] Server-authoritative timestamp
- [ ] Nonce generation + replay protection
- [ ] Device registration (WebCrypto key if feasible)
- [ ] Location genuineness validation (accuracy limit, fix-age limit, plausible-speed, no-drift detection) — **no geofence**
- [ ] Reverse geocoding for human-readable place name
- [ ] Risk scoring engine (initial version)
- [ ] `attendance`, `attendance_verifications` tables wired
- [ ] Random challenge (phrase/head-turn) — configurable

Exit criteria: check-in/check-out round-trip works, gallery upload rejected, bad accuracy flagged, duplicate nonce rejected.

## PHASE 5 — Lunch recording + R2

**Status: [ ] pending**

Tasks:
- [ ] Lunch start/end flow (location + server timestamp)
- [ ] `MediaRecorder` video capture (5-20s), challenge phrase overlay
- [ ] Cloudflare R2 setup (manual action — bucket/keys)
- [ ] Direct upload to private bucket
- [ ] Signed URL generation (short expiry)
- [ ] `lunch_sessions`, `lunch_proofs` tables wired

Exit criteria: lunch video uploads, only signed URL access works, direct public URL fails.

## PHASE 6 — Leave + reminders + Resend

**Status: [ ] pending**

Tasks:
- [ ] `leave_requests` table + form (mandatory reason)
- [ ] Admin approval flow (configurable on/off)
- [ ] Resend setup (manual action — API key, domain)
- [ ] Email templates (welcome, check-in, lunch, check-out, leave states, reminder, suspicious)
- [ ] Cloudflare Cron trigger — har ~15 min chale, aur har user ke **apne** `reminder_time` (unke timezone me) ke hisaab se email bheje. Koi global reminder time nahi.
- [ ] `email_logs` dedup logic (no duplicate reminders)

Exit criteria: leave submit → email sent; missing-attendance cron sends reminder once/day only.

## PHASE 7 — Partner activity

**Status: [ ] pending**

Tasks:
- [ ] Partner dashboard UI — today's attendance state (checked in / lunch / checked out)
- [ ] Event timeline — har event ka time + captured location (consent-gated)
- [ ] Leaflet + OpenStreetMap — **static pins for past events**, koi live moving marker nahi
- [ ] Refresh on page load / manual pull-to-refresh — **no location polling**

> **Scope guard:** ye "partner kahan hai abhi" wala feature **nahi** hai. Ye "partner ne kab aur kahan se attendance mark ki" wala feature hai. Detail: [03-security-anti-fraud.md](./03-security-anti-fraud.md) section "Live location — build hi nahi karni".

Exit criteria: partner sees only explicitly-shared data — event history with per-event locations, **no live position**.

## PHASE 8 — Admin

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

## PHASE 9 — Risk engine + security hardening

**Status: [ ] pending**

Tasks:
- [ ] Finalize risk scoring bands (0-29/30-59/60-79/80-100)
- [ ] Rate limiting on API/Worker routes
- [ ] CSP + Permissions Policy headers
- [ ] CSRF protection review
- [ ] `risk_events` logging complete
- [ ] Full security checklist pass (see [03-security-anti-fraud.md](./03-security-anti-fraud.md))

Exit criteria: full security checklist all-green.

## PHASE 10 — PWA + animations + accessibility

**Status: [ ] pending**

Tasks:
- [ ] `manifest.json`, service worker (next-pwa/Workbox)
- [ ] Icons, install prompt
- [ ] Light/dark theme (LoveTech aesthetic — not childish)
- [ ] Framer Motion micro-interactions, `prefers-reduced-motion` respected
- [ ] Keyboard nav, focus states, ARIA, contrast, touch targets

Exit criteria: installable PWA, accessibility checklist pass (see [06-testing-plan.md](./06-testing-plan.md)).

## PHASE 11 — Unit tests + Playwright MCP + E2E

**Status: [ ] pending**

Tasks:
- [ ] Vitest unit tests (location validation, distance/speed calc, risk score, nonce, state machine, leave validation, pairing permission, reminder eligibility)
- [ ] Playwright MCP installed: `claude mcp add playwright npx @playwright/mcp@latest`
- [ ] Full E2E flow suite (26 flows — see [06-testing-plan.md](./06-testing-plan.md))
- [ ] Mobile viewport + accessibility E2E checks

Exit criteria: lint + typecheck + unit + e2e all pass.

## PHASE 12 — Build + deployment + GitHub + README

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
├── feat/auth
├── feat/attendance
├── feat/lunch
├── feat/admin
├── feat/email
└── fix/*
```

Commit message style: `feat: implement secure check-in`, `fix: harden geolocation validation`, `docs: add deployment guide`, `test: add attendance e2e flows`.
