# Project State â€” Abhi Kya Status Hai

Last updated: 2026-08-20

## Overall status: **ALL 12 PHASES COMPLETE â€” LIVE at https://lovetrack.harshitsaini.in**

### Where things stand (2026-08-20)

| Phase | Status |
|---|---|
| 1 Â· Repo, framework, design | âœ… |
| 2 Â· Auth, profiles, RLS | âœ… |
| 3 Â· Pairing + permissions | âœ… |
| 4 Â· Check-in/out, camera, location, risk engine | âœ… |
| 5 Â· Lunch proof video | âœ… |
| 6 Â· Leave (= information) + reminders + Resend | âœ… |
| 7 Â· Partner activity view | âœ… |
| 8 Â· Admin panel + settings + retention | âœ… |
| 9 Â· Hardening â€” CSP nonce, rate limiting, headers | âœ… |
| 10 Â· Polish â€” skeletons, status pages, motion, mobile | âœ… |
| 11 Â· Tests â€” unit + E2E + database verify | âœ… |
| 12 Â· Deployment â€” Vercel + domain + cron | âœ… live |

**Migrations applied: 0001-0020.**

### Green as of last run

| Layer | Result |
|---|---|
| `npm run check` (typecheck + lint + unit + build) | âœ… exit 0 |
| Vitest unit tests | **72/72** |
| `npm run verify:all` â€” database-level, adversarial | **185/185** |
| Playwright E2E (mobile-first, headed) | **105/105** |

### Media, map links aur lunch order (20 Aug 2026)

Migrations **0021** aur **0022**.

**Partner/admin ko photo-video dikhna.** Asli wajah UI ka na hona tha —
`getLunchProofUrl` ka koi caller hi nahi tha, aur `get_partner_events`
`photo_path` return hi nahi karta tha. Ab `share_photos` switch hai, aur access
ka faisla SQL me hota hai (`get_attendance_photo_access` /
`get_lunch_proof_access`): teen hi raaste — apni hai, admin ho, ya owner ne
share kiya hai. Admin view **URL banne se pehle** audit log me jaata hai.

**Saare sharing switches ab default ON.** Purana privacy-first default
jaan-boojhkar palta gaya: log soch-samajh kar pair karte hain aur ek doosre ka
din dekhna chahte hain; khaali shuruaat app ko toota hua dikhati thi. Har switch
abhi bhi dikhta hai, kabhi bhi off ho sakta hai, "stop all sharing" ek tap hai.

**Location ab clickable** — Google Maps universal URL, jo Android/iOS par
installed app aur baaki jagah web map kholta hai.

**History poora record** — ek `DayDetail` component teeno jagah (apni
history, partner ki, admin wali), sirf permissions ka farak. **Lunch in aur
lunch out alag columns**, kyunki ek "Lunch" column break ki lambai chhupa deta
tha.

**Lunch ab start → video → end.** Pehle video baad me aati thi, jab lunch
already complete mark ho chuka hota tha — wo us stretch ka koi proof nahi
thi, aur din `lunch_verified` tak pahunch sakta tha **bina kisi video ke**.
Lunch in/out par photo nahi; beech wali clip hi poore period ka proof hai.
`lunch_end` ab clip ke bina **database level par** refuse hota hai.

**Admin delete** — ek entry ya poora din, typed reason ke saath, jo deleted
row ke content ke saath audit log me delete se **pehle** likha jaata hai.

Do cheezein iske dauraan pakdi gayin:

1. **`create or replace` se function ka return type nahi badalta.**
   `get_partner_events` me teen naye columns the, isliye 0021 beech me fail
   hua. Ab pehle `drop function` hota hai.
2. **E2E account suspended pada tha** ek interrupted parallel run se. `is_admin()`
   ko admin role ke saath **active status** bhi chahiye, isliye har admin check
   `not_admin` de raha tha — aisi wajah se jiska test se koi lena-dena nahi
   tha.

---

### Auth: link se OTP par shift (20 Aug 2026)

Live jaane ke baad pehla asli bug: confirmation link `otp_expired` de raha tha. Wajah link ka design hai â€” mail scanners aur link previewers har incoming URL fetch kar lete hain, aur one-time token usi fetch me kharch ho jaata hai; asli banda click kare tab tak wo ja chuka hota hai.

Ab **koi confirmation link bheja hi nahi jaata.** Signup aur password reset dono OTP code par hain, aur **Supabase ka built-in mailer bilkul use nahi hota**:

- `admin.createUser` (`signUp` nahi) â€” taaki Supabase apni mail na bheje
- `admin.generateLink` code deta hai aur kuch bhejta nahi
- Code apne Resend template se jaata hai, `email_logs` me record hoke
- `verifyOtp` code redeem karta hai â€” signup me address confirm + session, recovery me reset session
- `/auth/confirm` route delete ho gaya

Do cheezein is kaam me pakdi gayin:

1. **Code email subject me tha.** `sendEmail` har subject `email_logs` me likhta hai aur admin wo padh sakte hain â€” yaani koi bhi admin doosre ka reset code padh ke uska account le sakta tha, bina koi nishaan chhode. Subject ab generic hai; code sirf body me hai aur body store nahi hoti.
2. **React 19 form action ke baad uncontrolled fields reset kar deta hai.** Client-side redirect email input padh raha tha, jo tab tak khaali ho chuka hota tha â€” `/verify` bina address ke `/login` bhej deta tha. Ab teeno redirect server-side `redirect()` se hote hain.

**Verification scripts** (`npm run verify:*`):

| Script | Checks |
|---|---|
| `verify-pairing-rls.mjs` | 24 |
| `verify-attendance.mjs` | 25 |
| `verify-lunch.mjs` | 11 |
| `verify-leave.mjs` | 20 |
| `verify-partner-activity.mjs` | 22 |
| `verify-retention.mjs` | 20 |
| `verify-admin.mjs` | 25 |
| `verify-hardening.mjs` | 20 |
| `verify-otp-auth.mjs` | 18 |
| `verify-media-and-delete.mjs` | 22 |

### Phase 12 me ek plan badla

Cloudflare Workers par deploy karna **possible nahi nikla**: Next 16 ka `proxy.ts` sirf Node runtime par chalta hai, aur `@opennextjs/cloudflare` Node middleware support nahi karta. `proxy.ts` hatana option nahi tha (per-request CSP nonce usi me hai). **App ab Vercel par jaayegi, domain/DNS Cloudflare par hi rahenge.** Poori wajah [07-deployment.md](./07-deployment.md) me likhi hai.

### Shipped ahead of its phase

- **Admin storage/retention** (`/admin/storage`) â€” media ages out while the record survives; preview before deleting; every run audit-logged
- **`audit_logs` table** â€” brought forward from Phase 8 because retention destroys other people's evidence and had to be answerable
- **Status pages** â€” 404, 500, 403, offline, and a global fallback
- **Skeleton loading** on every route
- **SEO** â€” robots.txt and sitemap.xml, with everything private disallowed and `noindex` on signed-in pages

---

## Phase 2 detail

### Phase 2 me kya bana (2026-08-20)

- **Supabase project live**: ref `<project-ref>`, keys `.env.local` me (gitignored)
- **Migration `0001_profiles.sql` applied** â€” `user_role`/`account_status` enums, `profiles` table, `updated_at` trigger, `handle_new_user()` signup trigger, `is_admin()` SECURITY DEFINER helper, RLS policies
- **Migration `0002_reminder_time.sql` applied** â€” per-user `reminder_time` (default `20:30`, user ke apne timezone me), partial index for the reminder cron
- **Settings panel** â€” naam, timezone, reminder time, per-activity email toggles
- **Install button + theme toggle** â€” landing, auth pages (login/register/forgot/reset) aur settings, sab jagah
- **Auth flows** â€” register, login, logout, forgot-password, reset-password, email confirm (`/auth/confirm`)
- **`/auth/recover`** â€” self-heals a signed-in user with no profile row (warna `/login` â†” `/app/dashboard` infinite loop ban jaata)
- **Route protection** â€” `proxy.ts` (Next 16 me `middleware` deprecated ho gaya hai)
- **App shell** â€” bottom nav (phones) + header nav (desktop â‰¥lg), theme toggle, account menu
- **Playwright** installed + configured (mobile `Pixel 7` default project, desktop secondary)
- **`start.bat` / `stop.bat` / `restart.bat`** â€” local dev server control

**Live-verified security** (real DB ke against test kiya, phir test user delete kar diya):

| Test | Result |
|---|---|
| User apna `role` `admin` kar sake? | âŒ blocked (403) |
| Suspended user khud ko `active` kar sake? | âŒ blocked (403) |
| Dusre user ki row padh sake? | âŒ kuch nahi dikhta |
| Apna `full_name` badal sake? | âœ… allowed |
| Signup par profile auto-bane? | âœ… trigger works |
| User delete par profile cascade ho? | âœ… works |

**Tests**: 24/24 Playwright E2E pass (mobile + desktop) Â· typecheck âœ… Â· lint âœ… Â· build âœ…

---

## Phase 1 (complete)

Scaffold ho chuka hai. Project ab ek working Next.js app hai:

```text
lovetrack/
â”œâ”€â”€ app/              â† layout, globals.css (LoveTech theme), landing page
â”œâ”€â”€ components/       â† ui/ (shadcn), layout/, + feature folders
â”œâ”€â”€ lib/              â† service layers (supabase, auth, security, ... )
â”œâ”€â”€ hooks/ stores/ types/
â”œâ”€â”€ supabase/migrations/
â”œâ”€â”€ tests/            â† unit / integration / e2e
â”œâ”€â”€ public/           â† manifest.json, icons/
â”œâ”€â”€ docs/             â† ye documentation
â”œâ”€â”€ .env.example
â”œâ”€â”€ README.md
â””â”€â”€ project.md        â† original spec
```

**Verified working:** `npm run typecheck` âœ… Â· `npm run lint` âœ… Â· `npm run build` âœ…

### Phase 1 me kya bana

- Next.js 16.3.1 (App Router, Turbopack) + TypeScript + React 19
- Tailwind CSS v4 + shadcn/ui (radix base, Nova preset)
- LoveTech theme â€” rose primary + lavender accent, light `#FFF8FB` / dark `#0D0810`
- Mobile-first base layer â€” safe-area utils, 44px touch targets, no tap-highlight, global `prefers-reduced-motion`
- PWA groundwork â€” `manifest.json`, `viewportFit: cover`, per-scheme theme-color
- `next-themes` (system/light/dark) + `sonner` toasts
- Mobile-first landing page
- `.env.example` (saare 12 phases ki keys) + hardened `.gitignore`

### Locked decisions (baad me change na karein bina soche)

1. **Mobile-first** â€” har screen pehle 360-430px ke liye design hogi (user requirement, 20 Aug 2026)
2. **No geofence** â€” check-in kahin se bhi ho sakta hai; validation sirf "location genuine + accurate hai ya nahi" par hai (user requirement, 20 Aug 2026)
3. **No live location** â€” location sirf check-in/check-out/lunch ke exact moment par ek baar capture hoti hai. Continuous sharing, `watchPosition`, background tracking, aur "partner abhi kahan hai" â€” sab explicitly out of scope (user requirement, 20 Aug 2026)
4. **GitHub repo private** (user requirement, 20 Aug 2026)
5. **No AI attribution** â€” commits/PRs me `Co-Authored-By` ya "Generated with..." kabhi nahi (user requirement, 20 Aug 2026)
6. **Playwright headed by default** â€” local test runs me browser window dikhe, slow-mo ke saath; CI me headless (user requirement, 20 Aug 2026)

## Ab tak kya decide ho chuka hai (spec se)

- **Product concept**: consent-based attendance/activity verification PWA â€” hidden surveillance nahi.
- **Tech stack**: Next.js + TS + Tailwind + shadcn/ui + Supabase + Cloudflare (Pages/Workers/R2) + Resend + Leaflet.
- **Security philosophy**: "100% spoof-proof" claim nahi karna â€” defense-in-depth (multi-signal verification + audit trail).
- **12-phase development order** aur **18-hour timeline** already defined (dekhein [04-phases-and-tasks.md](./04-phases-and-tasks.md) aur [05-hourly-plan.md](./05-hourly-plan.md)).
- **Budget target**: â‚¹0 infra cost within free tiers (Supabase Free, Cloudflare Free, Resend Free).

## Immediate next steps (Phase 3 â€” Pairing + permissions)

1. Migration `0002_pairs.sql` â€” `pairs` + `pair_permissions` tables, RLS.
2. Pairing request flow â€” send / accept / reject / revoke.
3. Per-pair granular permissions (location sharing, activity timeline).
4. Always-visible **"Stop Sharing Location"** control.
5. Partner list UI (mobile-first).

## Manual actions jo user (Harshit) ko karne honge (jab tak nahi kiye)

Ye sab abhi **pending** hain â€” jaise-jaise phases aayenge tab honge:

- [ ] Supabase account + naya project banana, URL/anon-key/service-role-key lena
- [ ] Cloudflare account â€” Pages project, R2 bucket, Worker setup, Cron trigger
- [ ] Resend account â€” API key generate karna, sender domain verify karna
- [x] GitHub CLI (`gh`) â€” **already installed aur configured hai** (user confirmed 2026-08-20). `git init` ke baad seedha `gh repo create` use kar sakte hain, alag se auth setup nahi chahiye.
- [ ] Playwright MCP install karna: `claude mcp add playwright npx @playwright/mcp@latest`

Jab bhi koi phase in accounts/keys par depend karega, us waqt exact steps (website, setting, value, `.env` key) is doc me aur chat me batayenge.

## Known cosmetic issue (unresolved, low priority)

Chromium ki **mobile-emulation screenshots** me `/login` par dark theme me footer ka text page ke top par faintly duplicate paint hota hua dikhta hai.

Investigate kiya gaya:
- DOM me footer bilkul sahi jagah hai (`top: 786px`), top par koi element nahi hai
- Footer hide karo to ghost bhi gayab ho jaata hai
- Desktop (non-emulated) context me reproduce nahi hota

Chuki element ka rect sahi hai, ye **layout/CSS bug nahi** â€” paint-only renderer artifact lagta hai jo emulation path se aata hai. **Real phone par verify karna baaki hai.** Tab tak koi speculative CSS "fix" nahi kiya gaya.

## Risk / open items to track

- Video storage (lunch proofs) R2 quota jaldi consume kar sakta hai agar duration/compression/retention enforce na ho â€” [03-security-anti-fraud.md](./03-security-anti-fraud.md) me detail hai.
- Full spoof-proof security **possible nahi hai** browser-only PWA se â€” ye baat README/security docs me explicitly likhni hai taaki expectations honest rahen.
