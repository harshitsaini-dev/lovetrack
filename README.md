# ❤️ LoveTrack

**Consent-based attendance & activity verification PWA** for couples and friends.

LoveTrack ek hidden tracking app **nahi** hai. Har user ko clearly pata hota hai ki unka kaunsa data kis paired person ko dikh raha hai, aur sharing dono taraf se kabhi bhi revoke ki ja sakti hai.

> **Security statement:** LoveTrack does not claim impossible spoof-proof verification. It uses multi-signal verification, server-authoritative timestamps, fresh camera capture, location genuineness checks, device binding, replay protection and audit logging to make fraudulent attendance substantially harder and detectable.

## Features

- **Live camera proof** — attendance sirf `getUserMedia()` se, koi gallery/file upload nahi
- **Location kahin se bhi** — koi fixed geofence nahi; validation sirf ye hai ki us waqt ki location genuine aur accurate ho
- **One-time capture** — location sirf check-in/check-out/lunch ke exact moment par li jaati hai, uske baad kabhi nahi
- **Server-authoritative time** — device ka clock/timezone badalne se attendance timestamp nahi badalta
- **Lunch proof video** — 5-20s `MediaRecorder` clip, private R2 bucket, short-lived signed URLs
- **Leave workflow** — mandatory reason, optional admin approval, full audit trail
- **Automatic reminders** — missing activity par daily email; har user apna reminder time Settings se chunta hai (Cloudflare Cron + Resend)
- **Installable** — landing page aur settings dono jagah "Install app" button, plus light/dark toggle
- **Partner dashboard** — consent-gated attendance events, har event ki captured location map par (live tracking nahi)
- **Admin panel** — users, attendance, leaves, suspicious events, media evidence, audit logs
- **Mobile-first PWA** — installable, safe-area aware, `prefers-reduced-motion` respected

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animation | Framer Motion |
| Auth + DB | Supabase (Auth, PostgreSQL, RLS) |
| Edge/API | Cloudflare Workers + Cron |
| Media | Cloudflare R2 (private bucket) |
| Email | Resend |
| Maps | Leaflet + OpenStreetMap |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Testing | Vitest + Playwright (MCP) |
| Hosting | Cloudflare Pages |

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Open http://localhost:3000

**Windows shortcuts** — double-click, ya terminal se:

```bat
start.bat     :: dev server start karo (port 3000)
stop.bat      :: port par chal raha server band karo
restart.bat   :: stop + start
```

Doosre port ke liye: `set PORT=4000 && start.bat`

### Scripts

```bash
npm run dev              # dev server (Turbopack)
npm run build            # production build
npm run start            # serve production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test:e2e          # Playwright — opens a real browser you can watch
npm run test:e2e:mobile   # phone viewport only
npm run test:e2e:ui       # Playwright's interactive UI mode
npm run test:e2e:headless # no browser window (what CI runs)
npm run test:e2e:report   # open the last HTML report
```

E2E runs are **headed by default** on your machine — a real browser window
opens and the actions are slowed down so you can follow along. CI runs
headless automatically. Force either mode with `HEADED=1` / `HEADED=0`.

The signed-in tests need a test account:

```bash
node scripts/seed-e2e-user.mjs   # creates it, prints the credentials
```

Put the printed `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` into `.env.local`.
Without them those tests skip themselves rather than fail.

### Database migrations

`supabase/migrations/*.sql` ko order me Supabase SQL Editor me run karein
(Dashboard → SQL Editor → New query → paste → Run).

## Environment variables

Saari keys aur unka purpose [`.env.example`](./.env.example) me documented hain. Real values kabhi commit mat karna — `.env.local` gitignored hai.

Setup guides: [docs/07-deployment.md](./docs/07-deployment.md)

## Documentation

| Doc | Content |
|---|---|
| [docs/00-project-state.md](./docs/00-project-state.md) | Current status — kya ban chuka, kya baaki |
| [docs/implementation-plan.md](./docs/implementation-plan.md) | Locked decisions + phase-wise plan |
| [docs/01-architecture.md](./docs/01-architecture.md) | Architecture, stack, data flow |
| [docs/02-database-schema.md](./docs/02-database-schema.md) | Tables, relationships, RLS |
| [docs/03-security-anti-fraud.md](./docs/03-security-anti-fraud.md) | Security model, anti-spoofing, risk scoring |
| [docs/04-phases-and-tasks.md](./docs/04-phases-and-tasks.md) | 12 phases with task checklists |
| [docs/05-hourly-plan.md](./docs/05-hourly-plan.md) | 18-hour execution timeline |
| [docs/06-testing-plan.md](./docs/06-testing-plan.md) | Unit + E2E test matrix |
| [docs/07-deployment.md](./docs/07-deployment.md) | Deployment + free-tier setup |

## Limitations (honest list)

- Browser/PWA se fake GPS, virtual camera, ya emulator ko **100% rokna possible nahi** hai. LoveTrack in cheezon ko *mushkil aur detectable* banata hai, impossible nahi.
- **Koi live/continuous location tracking nahi hai — by design.** Location sirf us ek moment par capture hoti hai jab aap khud check-in / check-out / lunch mark karte hain. Uske baad app aapki location nahi dekhta. Partner ko "aap abhi kahan ho" nahi dikhta — sirf ye dikhta hai ki aapne kab aur kahan se attendance mark ki.
- EXIF metadata ko kabhi proof nahi maana jata.
- IP/timezone mismatch checks sirf heuristics hain — VPN se false positive aa sakta hai.

## Privacy notes

- Partner sharing **sirf mutual pairing ke baad** activate hoti hai.
- **"Stop Sharing Location"** control hamesha visible hai aur turant effective hota hai.
- Saara evidence media private hai — access sirf short-lived signed URLs se, admin actions audit-logged.
- User dekh sakta hai ki uska kya data share ho raha hai, aur access revoke kar sakta hai.

## License

Private project.
