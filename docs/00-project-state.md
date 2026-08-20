# Project State — Abhi Kya Status Hai

Last updated: 2026-08-20

## Overall status: **PHASE 1 COMPLETE — Phase 2 (Supabase Auth) next**

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
3. **GitHub repo private** (user requirement, 20 Aug 2026)

## Ab tak kya decide ho chuka hai (spec se)

- **Product concept**: consent-based attendance/activity verification PWA — hidden surveillance nahi.
- **Tech stack**: Next.js + TS + Tailwind + shadcn/ui + Supabase + Cloudflare (Pages/Workers/R2) + Resend + Leaflet.
- **Security philosophy**: "100% spoof-proof" claim nahi karna — defense-in-depth (multi-signal verification + audit trail).
- **12-phase development order** aur **18-hour timeline** already defined (dekhein [04-phases-and-tasks.md](./04-phases-and-tasks.md) aur [05-hourly-plan.md](./05-hourly-plan.md)).
- **Budget target**: ₹0 infra cost within free tiers (Supabase Free, Cloudflare Free, Resend Free).

## Immediate next steps (Phase 2 — Supabase Auth + DB + RLS)

1. Supabase project banana (**manual action** — steps neeche).
2. Supabase clients setup — browser, server, middleware.
3. Auth flows — register, login, logout, forgot-password, email verification.
4. `profiles` table migration + RLS policies.
5. Protected route middleware + role scaffold (user / admin).
6. Mobile-first auth screens.

## Manual actions jo user (Harshit) ko karne honge (jab tak nahi kiye)

Ye sab abhi **pending** hain — jaise-jaise phases aayenge tab honge:

- [ ] Supabase account + naya project banana, URL/anon-key/service-role-key lena
- [ ] Cloudflare account — Pages project, R2 bucket, Worker setup, Cron trigger
- [ ] Resend account — API key generate karna, sender domain verify karna
- [x] GitHub CLI (`gh`) — **already installed aur configured hai** (user confirmed 2026-08-20). `git init` ke baad seedha `gh repo create` use kar sakte hain, alag se auth setup nahi chahiye.
- [ ] Playwright MCP install karna: `claude mcp add playwright npx @playwright/mcp@latest`

Jab bhi koi phase in accounts/keys par depend karega, us waqt exact steps (website, setting, value, `.env` key) is doc me aur chat me batayenge.

## Risk / open items to track

- Video storage (lunch proofs) R2 quota jaldi consume kar sakta hai agar duration/compression/retention enforce na ho — [03-security-anti-fraud.md](./03-security-anti-fraud.md) me detail hai.
- Full spoof-proof security **possible nahi hai** browser-only PWA se — ye baat README/security docs me explicitly likhni hai taaki expectations honest rahen.
