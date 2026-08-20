# Deployment & ₹0 Setup Guide

## Deployment topology

```text
GitHub
   ↓
Cloudflare Pages
   ↓
LoveTrack PWA

Supabase → DB / Auth
Cloudflare R2 → photos/videos
Cloudflare Worker → security/API/cron
Resend → emails
```

## Target domain: `lovetrack.harshitsaini.in`

**Verified 2026-08-20** (live DNS lookup):

| Cheez | Status |
|---|---|
| Registrar | BigRock |
| DNS | **Cloudflare** (`gabe.ns.cloudflare.com`, `sreeni.ns.cloudflare.com`) — BigRock sirf registrar hai |
| `harshitsaini.in` | Next.js app, Cloudflare proxied (orange cloud) |
| `admin.harshitsaini.in` | Next.js app, Cloudflare proxied |
| `lovetrack.harshitsaini.in` | abhi exist nahi karta — ye humara target hai |
| Vercel headers | **nahi mile** — yaani existing apps Cloudflare par hi chal rahe hain |

Iska matlab: **nameservers already Cloudflare par hain, isliye subdomain add karna aasan hai.** BigRock me kuch nahi chhedna — sab Cloudflare dashboard se hoga.

### Next.js 16 ko Cloudflare par kaise deploy karein

Ye ek asli technical decision hai jo dhyan maangta hai:

- `@cloudflare/next-on-pages` (purana Pages adapter) ab **deprecated** hai aur Next.js 16 App Router + Server Actions ke saath reliable nahi hai.
- Current supported path: **`@opennextjs/cloudflare`**, jo app ko **Cloudflare Workers** par deploy karta hai (Pages par nahi).
- LoveTrack me SSR, Server Actions, Route Handlers aur `proxy.ts` — sab hain, isliye static export bilkul possible nahi.

**Recommended:** `@opennextjs/cloudflare` + Cloudflare Workers, custom domain `lovetrack.harshitsaini.in`.

> ⚠️ **Pehle confirm karna hai:** `harshitsaini.in` aur `admin.harshitsaini.in` kis setup par chal rahe hain (Workers + OpenNext, ya Pages + next-on-pages)? Wahi pattern LoveTrack ke liye repeat karna sabse safe hoga — naya pattern seekhne ki zaroorat nahi padegi. Ye Phase 12 me confirm karenge.

### Subdomain jodne ke steps (Phase 12)

1. Cloudflare dashboard → Workers & Pages → LoveTrack project
2. **Custom domains** → Add → `lovetrack.harshitsaini.in`
3. Zone same account me hai, isliye Cloudflare **CNAME khud bana dega** — manually DNS record add karne ki zaroorat nahi
4. SSL certificate automatically issue hoga (kuch minute lag sakte hain)
5. Supabase → **Authentication → URL Configuration** update karo:
   - Site URL: `https://lovetrack.harshitsaini.in`
   - Redirect URLs me add karo: `https://lovetrack.harshitsaini.in/**`
6. `NEXT_PUBLIC_APP_URL=https://lovetrack.harshitsaini.in` Cloudflare env vars me set karo (warna verification emails localhost par point karenge)

Initial testing URL: `lovetrack.<something>.workers.dev` — custom domain uske baad.

## GitHub — status: **CLI already configured** ✅

User (Harshit) ne confirm kiya hai ki **GitHub CLI (`gh`) already install + configure ho chuka hai**. Iska matlab:

- `git init` ke baad `gh repo create` se directly naya repo bana sakte hain (public/private choose karke).
- Auth/token setup dobara nahi karna padega — `gh auth status` se verify kar sakte hain.
- Cloudflare Pages ka Git-integration setup GitHub repo push hone ke baad hi connect hoga.

Jab Phase 1 shuru hoga, ye steps honge:

```bash
git init
gh repo create lovetrack --private --source=. --remote=origin
# ya public: --public
git add .
git commit -m "feat: initialize LoveTrack PWA"
git push -u origin main
```

(Exact repo name/visibility Phase 1 ke time confirm kar lenge.)

## Required external accounts (manual actions — abhi pending)

| Service | Kya chahiye | Kahan use hoga |
|---|---|---|
| Supabase | Project URL, anon key, service role key | Auth + DB (Phase 2) |
| Cloudflare | Account, Pages project, R2 bucket, Workers, Cron trigger | Media + edge security (Phase 5, 6, 9) |
| Resend | API key, verified sender domain | Emails (Phase 6) |
| GitHub | ✅ already done (CLI configured) | Source control (Phase 1, 12) |

Jab bhi in accounts me se koi setup zaroori hoga, us exact point par ye 5 cheezein batayi jayengi:
1. website kaunsi kholni hai
2. exact setting kaunsi click karni hai
3. exact value copy karni hai
4. exact `.env` key kis me daalni hai
5. success kaise verify karein

## Free-tier limits (₹0 budget ke liye important)

```text
GitHub               ₹0
Cloudflare Pages     ₹0 (500 builds/month)
Cloudflare Workers   ₹0 within quota (100k req/day)
Cloudflare R2        ₹0 within 10GB/month storage, no egress cost
Supabase             ₹0 within free quota (500MB DB, 5GB egress)
Resend               ₹0 within 3,000 emails/month (100/day)
OpenStreetMap        ₹0 (no key needed)
```

**Biggest quota risk: lunch videos.** ~15s video ≈ 1-3MB — bahut users ke saath R2 storage jaldi consume ho sakta hai. Isliye duration limit, compression, aur retention policy enforce karna mandatory hai (dekhein [03-security-anti-fraud.md](./03-security-anti-fraud.md)).

## Secrets — never commit

```text
.env
service role keys
database passwords
private keys
R2 secrets
Resend API keys
```

`.env.example` maintain karo (keys ke naam, values nahi), `.gitignore` me `.env*` (except `.env.example`) add karo.

## README must include

- LoveTrack overview
- Features
- Architecture diagram
- Stack
- Security model
- Local setup
- Environment variables
- Supabase setup
- R2 setup
- Resend setup
- Cloudflare setup
- Migrations
- Testing
- Deployment
- GitHub workflow
- Limitations
- Privacy notes

## Final deployment checklist (Phase 12)

- [ ] `lint`, `typecheck`, `test`, `build` — sab clean
- [ ] Cloudflare Pages connected to GitHub repo, auto-deploy on push to `main`
- [ ] All env vars set in Cloudflare Pages dashboard (not committed)
- [ ] Smoke test on deployed URL: register → pair → check-in → lunch → check-out → leave → admin view
- [ ] README finalized with all sections above
