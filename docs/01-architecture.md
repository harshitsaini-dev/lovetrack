# Architecture

## High-level diagram

```text
                         ┌─────────────────────────┐
                         │       LoveTrack PWA      │
                         │ Next.js + TypeScript     │
                         │ Tailwind + shadcn/ui     │
                         │ Framer Motion            │
                         └────────────┬─────────────┘
                                      │
                         HTTPS / Secure Context
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                      │
          Authentication        Attendance API         Media Capture
                │                     │                      │
                ▼                     ▼                      ▼
        ┌──────────────┐      ┌───────────────┐      ┌──────────────┐
        │  Supabase     │      │ Cloudflare    │      │ Camera/Mic   │
        │ Auth          │      │ Worker        │      │ getUserMedia │
        │ PostgreSQL    │      │ Anti-abuse    │      │ MediaRecorder│
        └──────┬────────┘      └───────┬───────┘      └──────┬───────┘
               │                       │                      │
               ▼                       ▼                      ▼
        Users / Pairing       Verification Engine       Upload URL
        Roles / RLS           Risk Scoring                  │
        Attendance            Server timestamp              ▼
        Leaves                Geo checks              Cloudflare R2
        Audit logs            Rate limiting              Media
               │
               ▼
        ┌─────────────────────┐
        │      Resend         │
        │ email notifications │
        └─────────────────────┘
```

## Tech stack (final)

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js + TypeScript | App Router, SSR + PWA support |
| UI | Tailwind CSS + shadcn/ui | Fast, accessible, customizable components |
| Animation | Framer Motion | Micro-interactions, `prefers-reduced-motion` respect |
| PWA | next-pwa / Workbox | Installable app, offline shell |
| Auth | Supabase Auth | Email/password + session management out of the box |
| DB | Supabase PostgreSQL | Free tier, RLS-native |
| Authorization | PostgreSQL RLS | DB-level enforcement, frontend trust nahi |
| API/security | Cloudflare Workers | Edge verification logic, rate limiting, cron |
| Media | Cloudflare R2 | No egress cost, private bucket + signed URLs |
| Email | Resend | 3,000/month free, simple API |
| Map | Leaflet + OpenStreetMap | Free, no API key needed |
| Forms | React Hook Form + Zod | Type-safe validation client + server dono jagah |
| State | Zustand | Lightweight client state |
| Date | date-fns | Timezone-safe date handling |
| Testing | Vitest + Playwright (+ MCP) | Unit + real browser E2E |
| Deployment | Cloudflare Pages | Git-based CI, free builds |

Sabse important reason ye combination chunne ka: **MVP ~₹0 infra cost me chal sakta hai** within free tiers (Supabase 500MB DB/5GB egress, R2 10GB storage/no egress, Resend 3000 emails/month, CF Pages 500 builds/month, Workers 100k req/day).

## Data flow — Check-in example

```text
User clicks "Verify & Check In"
        │
        ▼
1. Camera permission → getUserMedia() (NO file input allowed)
        │
        ▼
2. Location permission → navigator.geolocation
        │
        ▼
3. Fresh camera frame captured (video → canvas → compressed webp)
        │
        ▼
4. Fresh geolocation captured (lat, lng, accuracy, heading, speed)
        │
        ▼
5. Client packages: photo + location + nonce + device signature
        │
        ▼
6. Cloudflare Worker / API receives request
        │
        ├── Server timestamp assigned (client clock IGNORED)
        ├── Nonce validated (not reused, not expired)
        ├── Device signature verified (WebCrypto public key)
        ├── Location genuineness check (accuracy, fix age, plausible speed)
        ├── NO geofence — any location is allowed
        ├── Risk score calculated (0-100)
        │
        ▼
7. verification_status decided → PASS / SUSPICIOUS / REJECTED
        │
        ▼
8. Photo uploaded to private R2 bucket
        │
        ▼
9. attendance + attendance_verifications rows written (Supabase)
        │
        ▼
10. Email sent via Resend (if user enabled check-in emails)
        │
        ▼
11. Partner dashboard shows the new event next time it loads
```

> Step 2/4 me location **ek hi baar** li jaati hai — is button press ke liye.
> Uske baad app location access nahi karta. Koi `watchPosition`, koi polling.

## Core design principles

1. **Never trust the client.** Timestamp, verification status, role, location validity — sab server-side compute/validate hota hai.
2. **Camera-only proof.** `<input type="file">` kabhi use nahi hota attendance ke liye — sirf `getUserMedia()` se live stream.
3. **Consent-first pairing.** Activity sirf explicit pairing + per-permission toggle ke baad visible hoti hai, revoke kabhi bhi possible.
4. **Defense in depth, not "spoof-proof".** Multiple weak signals (photo freshness, location genuineness, device binding, nonce, risk score) combine karke fraud ko *substantially harder* banate hain — impossible nahi.
5. **Server-authoritative time.** Client ka `Date.now()`/timezone kabhi trust nahi hota attendance timestamp ke liye.
6. **Private media by default.** R2 bucket public nahi — sab access short-lived signed URLs se.
7. **Mobile-first.** Har UI pehle phone (360-430px) ke liye banti hai, phir bade screens ke liye scale up hoti hai.
8. **Geofence-free check-in.** Attendance kahin se bhi mark ho sakti hai — validation "kahan ho" par nahi, "location reading sach hai ya nahi" par hai.
9. **One-time location capture, no tracking.** Location sirf check-in/check-out/lunch ke exact moment par ek baar li jaati hai. `watchPosition`, background tracking aur live partner-position — teeno explicitly out of scope.

## PWA route map

```text
/
├── landing
├── login
├── register
├── forgot-password
│
├── app/
│   ├── dashboard
│   ├── check-in
│   ├── lunch
│   ├── check-out
│   ├── leave
│   ├── history
│   ├── partner
│   ├── notifications
│   ├── settings
│   └── devices
│
└── admin/
    ├── dashboard
    ├── users
    ├── attendance
    ├── leaves
    ├── verification
    ├── media
    ├── suspicious
    ├── emails
    ├── audit
    └── settings
```

## Repository structure (target)

```text
LoveTrack/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── admin/
│   └── api/
├── components/
│   ├── ui/
│   ├── attendance/
│   ├── camera/
│   ├── location/
│   ├── lunch/
│   ├── partner/
│   └── admin/
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── security/
│   ├── location/
│   ├── media/
│   ├── email/
│   ├── risk/
│   ├── pairing/
│   └── attendance/
├── hooks/
├── stores/
├── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── policies.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
│   ├── icons/
│   └── manifest.json
├── docs/
├── .env.example
├── README.md
├── package.json
└── LICENSE
```

Business logic **components ke andar nahi**, `lib/*` typed service functions me rehta hai — components sirf UI + calls.
