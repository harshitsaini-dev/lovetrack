# Project State — Abhi Kya Status Hai

Last updated: 2026-08-20

## Overall status: **PHASES 1-5 COMPLETE — Phase 6 (Leave + reminders + Resend) next**

### Where things stand (2026-08-20)

| Phase | Status |
|---|---|
| 1 · Repo, framework, design | ✅ |
| 2 · Auth, profiles, RLS | ✅ |
| 3 · Pairing + permissions | ✅ |
| 4 · Check-in/out, camera, location, risk engine | ✅ |
| 5 · Lunch proof video | ✅ |
| 6 · Leave + reminders + Resend | next |
| 7 · Partner activity view | pending |
| 8 · Admin (storage/retention shipped early) | partial |
| 9-12 | pending |

**Migrations applied: 0001-0011.**

**Verification scripts** (`npm run verify:*`) — adversarial API-level checks:

| Script | Checks |
|---|---|
| `verify-pairing-rls.mjs` | 24 |
| `verify-attendance.mjs` | 24 |
| `verify-lunch.mjs` | 11 |
| `verify-retention.mjs` | 20 |

**E2E: 82 tests** across auth, pairing, attendance, lunch, profile, status pages and SEO.

### Shipped ahead of its phase

- **Admin storage/retention** (`/admin/storage`) — media ages out while the record survives; preview before deleting; every run audit-logged
- **`audit_logs` table** — brought forward from Phase 8 because retention destroys other people's evidence and had to be answerable
- **Status pages** — 404, 500, 403, offline, and a global fallback
- **Skeleton loading** on every route
- **SEO** — robots.txt and sitemap.xml, with everything private disallowed and `noindex` on signed-in pages

---

## Phase 2 detail

### Phase 2 me kya bana (2026-08-20)

- **Supabase project live**: ref `<project-ref>`, keys `.env.local` me (gitignored)
- **Migration `0001_profiles.sql` applied** — `user_role`/`account_status` enums, `profiles` table, `updated_at` trigger, `handle_new_user()` signup trigger, `is_admin()` SECURITY DEFINER helper, RLS policies
- **Migration `0002_reminder_time.sql` applied** — per-user `reminder_time` (default `20:30`, user ke apne timezone me), partial index for the reminder cron
- **Settings panel** — naam, timezone, reminder time, per-activity email toggles
- **Install button + theme toggle** — landing, auth pages (login/register/forgot/reset) aur settings, sab jagah
- **Auth flows** — register, login, logout, forgot-password, reset-password, email confirm (`/auth/confirm`)
- **`/auth/recover`** — self-heals a signed-in user with no profile row (warna `/login` ↔ `/app/dashboard` infinite loop ban jaata)
- **Route protection** — `proxy.ts` (Next 16 me `middleware` deprecated ho gaya hai)
- **App shell** — bottom nav (phones) + header nav (desktop ≥lg), theme toggle, account menu
- **Playwright** installed + configured (mobile `Pixel 7` default project, desktop secondary)
- **`start.bat` / `stop.bat` / `restart.bat`** — local dev server control

**Live-verified security** (real DB ke against test kiya, phir test user delete kar diya):

| Test | Result |
|---|---|
| User apna `role` `admin` kar sake? | ❌ blocked (403) |
| Suspended user khud ko `active` kar sake? | ❌ blocked (403) |
| Dusre user ki row padh sake? | ❌ kuch nahi dikhta |
| Apna `full_name` badal sake? | ✅ allowed |
| Signup par profile auto-bane? | ✅ trigger works |
| User delete par profile cascade ho? | ✅ works |

**Tests**: 24/24 Playwright E2E pass (mobile + desktop) · typecheck ✅ · lint ✅ · build ✅

---

## Phase 1 (complete)

Scaffold ho chuka hai. Project ab ek working Next.js app hai:

```text
lovetrack/
├── app/              ← layout, globals.css (LoveTech theme), landing page
├── components/       ← ui/ (shadcn), layout/, + feature folders
├── lib/              ← service layers (supabase, auth, security, ... )
├── hooks/ stores/ types/
├── supabase/migrations/
├── tests/            ← unit / integration / e2e
├── public/           ← manifest.json, icons/
├── docs/             ← ye documentation
├── .env.example
├── README.md
└── project.md        ← original spec
```

**Verified working:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅

### Phase 1 me kya bana

- Next.js 16.3.1 (App Router, Turbopack) + TypeScript + React 19
- Tailwind CSS v4 + shadcn/ui (radix base, Nova preset)
- LoveTech theme — rose primary + lavender accent, light `#FFF8FB` / dark `#0D0810`
- Mobile-first base layer — safe-area utils, 44px touch targets, no tap-highlight, global `prefers-reduced-motion`
- PWA groundwork — `manifest.json`, `viewportFit: cover`, per-scheme theme-color
- `next-themes` (system/light/dark) + `sonner` toasts
- Mobile-first landing page
- `.env.example` (saare 12 phases ki keys) + hardened `.gitignore`

### Locked decisions (baad me change na karein bina soche)

1. **Mobile-first** — har screen pehle 360-430px ke liye design hogi (user requirement, 20 Aug 2026)
2. **No geofence** — check-in kahin se bhi ho sakta hai; validation sirf "location genuine + accurate hai ya nahi" par hai (user requirement, 20 Aug 2026)
3. **No live location** — location sirf check-in/check-out/lunch ke exact moment par ek baar capture hoti hai. Continuous sharing, `watchPosition`, background tracking, aur "partner abhi kahan hai" — sab explicitly out of scope (user requirement, 20 Aug 2026)
4. **GitHub repo private** (user requirement, 20 Aug 2026)
5. **No AI attribution** — commits/PRs me `Co-Authored-By` ya "Generated with..." kabhi nahi (user requirement, 20 Aug 2026)
6. **Playwright headed by default** — local test runs me browser window dikhe, slow-mo ke saath; CI me headless (user requirement, 20 Aug 2026)

## Ab tak kya decide ho chuka hai (spec se)

- **Product concept**: consent-based attendance/activity verification PWA — hidden surveillance nahi.
- **Tech stack**: Next.js + TS + Tailwind + shadcn/ui + Supabase + Cloudflare (Pages/Workers/R2) + Resend + Leaflet.
- **Security philosophy**: "100% spoof-proof" claim nahi karna — defense-in-depth (multi-signal verification + audit trail).
- **12-phase development order** aur **18-hour timeline** already defined (dekhein [04-phases-and-tasks.md](./04-phases-and-tasks.md) aur [05-hourly-plan.md](./05-hourly-plan.md)).
- **Budget target**: ₹0 infra cost within free tiers (Supabase Free, Cloudflare Free, Resend Free).

## Immediate next steps (Phase 3 — Pairing + permissions)

1. Migration `0002_pairs.sql` — `pairs` + `pair_permissions` tables, RLS.
2. Pairing request flow — send / accept / reject / revoke.
3. Per-pair granular permissions (location sharing, activity timeline).
4. Always-visible **"Stop Sharing Location"** control.
5. Partner list UI (mobile-first).

## Manual actions jo user (Harshit) ko karne honge (jab tak nahi kiye)

Ye sab abhi **pending** hain — jaise-jaise phases aayenge tab honge:

- [ ] Supabase account + naya project banana, URL/anon-key/service-role-key lena
- [ ] Cloudflare account — Pages project, R2 bucket, Worker setup, Cron trigger
- [ ] Resend account — API key generate karna, sender domain verify karna
- [x] GitHub CLI (`gh`) — **already installed aur configured hai** (user confirmed 2026-08-20). `git init` ke baad seedha `gh repo create` use kar sakte hain, alag se auth setup nahi chahiye.
- [ ] Playwright MCP install karna: `claude mcp add playwright npx @playwright/mcp@latest`

Jab bhi koi phase in accounts/keys par depend karega, us waqt exact steps (website, setting, value, `.env` key) is doc me aur chat me batayenge.

## Known cosmetic issue (unresolved, low priority)

Chromium ki **mobile-emulation screenshots** me `/login` par dark theme me footer ka text page ke top par faintly duplicate paint hota hua dikhta hai.

Investigate kiya gaya:
- DOM me footer bilkul sahi jagah hai (`top: 786px`), top par koi element nahi hai
- Footer hide karo to ghost bhi gayab ho jaata hai
- Desktop (non-emulated) context me reproduce nahi hota

Chuki element ka rect sahi hai, ye **layout/CSS bug nahi** — paint-only renderer artifact lagta hai jo emulation path se aata hai. **Real phone par verify karna baaki hai.** Tab tak koi speculative CSS "fix" nahi kiya gaya.

## Risk / open items to track

- Video storage (lunch proofs) R2 quota jaldi consume kar sakta hai agar duration/compression/retention enforce na ho — [03-security-anti-fraud.md](./03-security-anti-fraud.md) me detail hai.
- Full spoof-proof security **possible nahi hai** browser-only PWA se — ye baat README/security docs me explicitly likhni hai taaki expectations honest rahen.
