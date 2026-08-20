# LoveTrack — Implementation Plan

Ye master prompt (`project.md`, section 28) ka mandatory first deliverable hai. Detailed phase breakdown [04-phases-and-tasks.md](./04-phases-and-tasks.md) me hai; ye doc us plan ka executive view + locked decisions rakhta hai.

## Locked product decisions

| # | Decision | Kyun / kab tay hua |
|---|---|---|
| 1 | **Consent-based only** — hidden surveillance kabhi nahi | Original spec, non-negotiable |
| 2 | **Mobile-first** — har screen pehle 360-430px ke liye | User requirement, 2026-08-20 |
| 3 | **No geofence** — check-in kahin se bhi, bas location genuine ho | User requirement, 2026-08-20 |
| 4 | **Camera-only proof** — `getUserMedia()`, koi file input nahi | Anti-fraud core |
| 5 | **Server-authoritative time** — client clock kabhi trust nahi | Anti-fraud core |
| 6 | **Private media** — R2 private bucket + short-lived signed URLs | Privacy |
| 7 | **No "100% spoof-proof" claim** — honest defense-in-depth | Technical honesty |
| 8 | **GitHub repo private** | User requirement, 2026-08-20 |

## Execution order

```text
PHASE 1  Repository + Next.js + styling + architecture     ← ✅ DONE
PHASE 2  Supabase Auth + DB + RLS + profile
PHASE 3  Pairing + permissions
PHASE 4  Check-in/check-out + camera + location + nonce + server time
PHASE 5  Lunch recording + R2
PHASE 6  Leave + reminders + Resend
PHASE 7  Partner activity
PHASE 8  Admin
PHASE 9  Risk engine + security hardening
PHASE 10 PWA + animations + accessibility
PHASE 11 Unit tests + Playwright MCP + E2E
PHASE 12 Build + deployment + GitHub + README
```

Har phase ke end me ye report print hoti hai:

```text
PHASE COMPLETE
What I built:
What I tested:
What remains:
Manual action required:
```

## Phase 1 — completed summary

**Built:**
- Next.js 16.3.1 (App Router, Turbopack) + TypeScript + React 19
- Tailwind CSS v4 + shadcn/ui (radix base, Nova preset)
- LoveTech theme: rose primary + lavender accent, light (`#FFF8FB`) + dark (`#0D0810`) palettes in `app/globals.css`
- Mobile-first base layer: safe-area utilities, 44px touch targets, no tap-highlight, `prefers-reduced-motion` honoured globally
- PWA groundwork: `public/manifest.json`, viewport with `viewportFit: cover`, theme-color per scheme
- `next-themes` provider (system/light/dark) + `sonner` toaster
- Mobile-first landing page at `app/page.tsx`
- Full folder structure (`app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`, `supabase/`, `tests/`, `public/`)
- `.env.example` with every key needed across all 12 phases
- `.gitignore` hardened (no `.env`, no `.wrangler`, no Playwright artifacts)

**Verified:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅

**Deps installed:** framer-motion, zustand, react-hook-form, zod, @hookform/resolvers, date-fns, next-themes, sonner, lucide-react, radix-ui

## Next up — Phase 2 (Supabase Auth + DB + RLS)

Blocked on manual action: Supabase project banana aur keys `.env.local` me daalna. Exact steps Phase 2 shuru hote hi diye jayenge.

Phase 2 scope:
1. Supabase client setup (browser + server + middleware)
2. Auth: register, login, logout, forgot-password, email verification
3. `profiles` table migration + RLS
4. Protected route middleware + role scaffold (user / admin)
5. Mobile-first auth screens
