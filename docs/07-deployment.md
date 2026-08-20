# Deployment & â‚¹0 Setup Guide

## Deployment topology

```text
GitHub
   â†“
Cloudflare Pages
   â†“
LoveTrack PWA

Supabase â†’ DB / Auth
Cloudflare R2 â†’ photos/videos
Cloudflare Worker â†’ security/API/cron
Resend â†’ emails
```

## Target domain: `lovetrack.harshitsaini.in`

**Verified 2026-08-20** (live DNS lookup):

| Cheez | Status |
|---|---|
| Registrar | BigRock |
| DNS | **Cloudflare** (`gabe.ns.cloudflare.com`, `sreeni.ns.cloudflare.com`) â€” BigRock sirf registrar hai |
| `harshitsaini.in` | Next.js app, Cloudflare proxied (orange cloud) |
| `admin.harshitsaini.in` | Next.js app, Cloudflare proxied |
| `lovetrack.harshitsaini.in` | abhi exist nahi karta â€” ye humara target hai |
| Vercel headers | **nahi mile** â€” yaani existing apps Cloudflare par hi chal rahe hain |

Iska matlab: **nameservers already Cloudflare par hain, isliye subdomain add karna aasan hai.** BigRock me kuch nahi chhedna â€” sab Cloudflare dashboard se hoga.

### ⛔ Cloudflare Workers ka rasta band nikla (verified 20 Aug 2026)

Neeche wala plan **try kiya gaya aur fail hua**. Record ke liye rakha hai taaki dobara wahi koshish na ho.

`@opennextjs/cloudflare@1.20.2` (latest) build par:

```
ERROR Node.js middleware is not currently supported. Consider switching to Edge Middleware.
```

Edge par switch karne ki koshish ki, toh Next.js 16 ne mana kiya:

```
Error: Route segment config is not allowed in Proxy file at "./proxy.ts".
Proxy always runs on Node.js runtime.
```

Yaani **dono ek doosre ko block karte hain**. Ye config galti nahi thi — Next 16 ne `middleware` → `proxy` rename ke saath usse Node-only bana diya, aur adapter abhi Node middleware nahi chala sakta.

`proxy.ts` hata dena koi option nahi tha. Usme teen cheezein hain:

1. Supabase session cookie refresh
2. Protected route gating
3. **Per-request CSP nonce**

Teesri sabse important hai. Nonce ke bina CSP me `unsafe-inline` daalna padta, aur `unsafe-inline` wali CSP attacker ko lagbhag kuch nahi rokti — protection dikhti hai, hoti nahi.

**Faisla: app Vercel par, domain/DNS Cloudflare par.** Vercel Next 16 ka native host hai, Hobby tier ₹0 hai, aur portfolio Cloudflare Workers par jahan hai wahin रहेगा — usse kuch nahi chhua.

### Vercel deployment steps

```bash
npx vercel          # pehli baar — project link
npx vercel --prod   # production
```

1. **Env vars** — Vercel → Settings → Environment Variables. `.env.example` ki saari keys (`E2E_*` chhodkar). `NEXT_PUBLIC_APP_URL=https://lovetrack.harshitsaini.in`.
2. **Domain** — Vercel → Domains → `lovetrack.harshitsaini.in` add karo.
3. **Cloudflare DNS** — CNAME add karo, **grey cloud (DNS only)**. Orange proxy on rakhne par Vercel ka certificate issue nahi ho paata — ye sabse common galti hai.
4. **Supabase** → Authentication → URL Configuration: Site URL set karo, redirect me `https://lovetrack.harshitsaini.in/**` add karo. Warna verification emails localhost par point karenge.
5. **GitHub Secrets** → `APP_URL` aur `CRON_SECRET` (reminders workflow ke liye).

### Reminders cron — GitHub Actions, Vercel Cron nahi

Vercel ka **Hobby plan cron ko din me sirf ek baar** chalne deta hai. LoveTrack me har user apna reminder time apne timezone me chunta hai, isliye koi ek fixed hour hai hi nahi — endpoint ko baar-baar chalna padta hai aur database khud batata hai ki abhi kaun due hai.

Isliye schedule [`.github/workflows/reminders.yml`](../.github/workflows/reminders.yml) me hai — har 15 minute. Endpoint idempotent hai (`users_due_for_reminder()` un logon ko chhod deta hai jinhe aaj ki mail ja chuki, aur email log par unique index backup hai), isliye extra ya late run se koi nuksaan nahi.

<details>
<summary>Purana Cloudflare plan (ab valid nahi)</summary>

### Next.js 16 ko Cloudflare par kaise deploy karein

Ye ek asli technical decision hai jo dhyan maangta hai:

- `@cloudflare/next-on-pages` (purana Pages adapter) ab **deprecated** hai aur Next.js 16 App Router + Server Actions ke saath reliable nahi hai.
- Current supported path: **`@opennextjs/cloudflare`**, jo app ko **Cloudflare Workers** par deploy karta hai (Pages par nahi).
- LoveTrack me SSR, Server Actions, Route Handlers aur `proxy.ts` â€” sab hain, isliye static export bilkul possible nahi.

**Recommended:** `@opennextjs/cloudflare` + Cloudflare Workers, custom domain `lovetrack.harshitsaini.in`.

> âœ… **Confirm ho gaya (2026-08-20):** Cloudflare DNS me `harshitsaini.in` aur `admin.harshitsaini.in` dono **Worker** records hain (`portfolio-web`, `portfolio-admin`) â€” Pages nahi. Yaani tum already Next.js ko Cloudflare Workers par chala rahe ho.
>
> LoveTrack bhi wahi pattern follow karega: **`@opennextjs/cloudflare` + Workers**. Koi naya deployment model seekhne ki zaroorat nahi.

</details>

## Email â€” Resend (configured 2026-08-20)

| Cheez | Value |
|---|---|
| Sending domain | `send.harshitsaini.in` â€” **verified** |
| Region | `us-east-1` |
| From address | `LoveTrack <noreply@send.harshitsaini.in>` |
| API key | `.env.local` me, verified working |

Subdomain (`send.`) jaan-boojhkar use kiya, root domain nahi: agar kabhi `harshitsaini.in` par normal email (Google Workspace waghairah) lagao to koi conflict nahi hoga, aur transactional sending ki reputation personal email se alag rehti hai.

### DNS records

| Type | Name | Kaam |
|---|---|---|
| TXT | `resend._domainkey.send` | DKIM â€” signing. **Verification isi se hoti hai.** |
| TXT | `send` | SPF |
| MX | `send` | Bounce/complaint feedback |
| TXT | `_dmarc` | Anti-spoofing policy |

âš ï¸ Cloudflare me Name field me sirf `send` likhna hai â€” poora `send.harshitsaini.in` likhne par Cloudflare domain dobara jod deta hai aur record `send.send.harshitsaini.in` ban jaata hai. (Ye galti pehli baar hui thi; MX aur SPF dono wahan chale gaye the.)

### DMARC ka roadmap

`_dmarc` record **kabhi delete nahi karna** â€” ye permanent anti-spoofing protection hai. Sirf uski policy tight karni hai.

| Kab | Value | Matlab |
|---|---|---|
| Set kiya 20 Aug 2026 | `p=none` | Sirf report, block kuch nahi |
| **~10 Sep 2026** | `p=quarantine` | Fail hui mail spam folder me |
| **~10 Oct 2026** | `p=reject` | Fail hui mail bilkul reject |

Har baar wahi record **edit** karna hai, naya nahi banana.

**Date asli shart nahi hai.** Aage tabhi badhna hai jab DMARC reports me dikhe ki *saari* legitimate mail pass ho rahi hai. Koi source fail dikhe to wahin rukna hai.

### âš ï¸ `p=reject` se pehle padhna

`_dmarc` record `harshitsaini.in` par hai, isliye ye **poore domain aur saare subdomains** par lagta hai â€” sirf `send.` par nahi.

`p=reject` ke baad `harshitsaini.in` se bheji gayi koi bhi doosri mail (Google Workspace, contact form, kuch bhi) agar SPF/DKIM aligned na ho, to **chupchaap reject** ho jayegi.

**Recommended** â€” subdomain policy alag rakho:

```
v=DMARC1; p=none; sp=reject; rua=mailto:you@example.com
```

`sp=reject` = subdomains (jaise `send.`) par sakhti, root domain par dheel. LoveTrack protected rehta hai aur root domain baad me bina dikkat use ho sakta hai.

### Subdomain jodne ke steps (Phase 12)

1. Cloudflare dashboard â†’ Workers & Pages â†’ LoveTrack project
2. **Custom domains** â†’ Add â†’ `lovetrack.harshitsaini.in`
3. Zone same account me hai, isliye Cloudflare **CNAME khud bana dega** â€” manually DNS record add karne ki zaroorat nahi
4. SSL certificate automatically issue hoga (kuch minute lag sakte hain)
5. Supabase â†’ **Authentication â†’ URL Configuration** update karo:
   - Site URL: `https://lovetrack.harshitsaini.in`
   - Redirect URLs me add karo: `https://lovetrack.harshitsaini.in/**`
6. `NEXT_PUBLIC_APP_URL=https://lovetrack.harshitsaini.in` Cloudflare env vars me set karo (warna verification emails localhost par point karenge)

Initial testing URL: `lovetrack.<something>.workers.dev` â€” custom domain uske baad.

## GitHub â€” status: **CLI already configured** âœ…

User (Harshit) ne confirm kiya hai ki **GitHub CLI (`gh`) already install + configure ho chuka hai**. Iska matlab:

- `git init` ke baad `gh repo create` se directly naya repo bana sakte hain (public/private choose karke).
- Auth/token setup dobara nahi karna padega â€” `gh auth status` se verify kar sakte hain.
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

## Required external accounts (manual actions â€” abhi pending)

| Service | Kya chahiye | Kahan use hoga |
|---|---|---|
| Supabase | Project URL, anon key, service role key | Auth + DB (Phase 2) |
| Cloudflare | Account, Pages project, R2 bucket, Workers, Cron trigger | Media + edge security (Phase 5, 6, 9) |
| Resend | API key, verified sender domain | Emails (Phase 6) |
| GitHub | âœ… already done (CLI configured) | Source control (Phase 1, 12) |

Jab bhi in accounts me se koi setup zaroori hoga, us exact point par ye 5 cheezein batayi jayengi:
1. website kaunsi kholni hai
2. exact setting kaunsi click karni hai
3. exact value copy karni hai
4. exact `.env` key kis me daalni hai
5. success kaise verify karein

## Free-tier limits (â‚¹0 budget ke liye important)

```text
GitHub               â‚¹0
Cloudflare Pages     â‚¹0 (500 builds/month)
Cloudflare Workers   â‚¹0 within quota (100k req/day)
Cloudflare R2        â‚¹0 within 10GB/month storage, no egress cost
Supabase             â‚¹0 within free quota (500MB DB, 5GB egress)
Resend               â‚¹0 within 3,000 emails/month (100/day)
OpenStreetMap        â‚¹0 (no key needed)
```

**Biggest quota risk: lunch videos.** ~15s video â‰ˆ 1-3MB â€” bahut users ke saath R2 storage jaldi consume ho sakta hai. Isliye duration limit, compression, aur retention policy enforce karna mandatory hai (dekhein [03-security-anti-fraud.md](./03-security-anti-fraud.md)).

## Secrets â€” never commit

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

- [x] `typecheck`, `lint`, `test` (49 unit), `build` â€” sab clean (`npm run check`)
- [x] `npm run verify:all` â€” 167 database-level checks
- [x] Playwright â€” 97 E2E
- [x] README finalized
- [x] Reminders cron workflow committed
- [x] Vercel deploy live â€” `https://lovetrack.harshitsaini.in`
- [x] Env vars set (committed nahi)
- [x] Cloudflare CNAME â†’ `vercel-dns-017.com`, **grey cloud** (Vercel anycast IPs resolve ho rahe hain, Cloudflare ke nahi â€” yaani DNS-only sahi lagaya gaya)
- [x] Supabase Auth URL configuration updated
- [x] GitHub Secrets: `APP_URL`, `CRON_SECRET`
- [x] Resend MX + SPF sahi naam par move ho gaye
- [ ] Manual smoke test asli phone par: register â†’ pair â†’ check-in â†’ lunch â†’ check-out â†’ leave â†’ admin view

## Live verification (20 Aug 2026)

| Check | Result |
|---|---|
| `/login` | 200, `server: Vercel` |
| CSP nonce HTML aur header dono me match | âœ… `proxy.ts` Vercel par chal raha hai |
| HSTS / Permissions-Policy / Referrer-Policy / nosniff / frame-deny | âœ… sab present |
| `/app/dashboard`, `/admin` bina login | 307 â†’ `/login` |
| `/api/cron/reminders` bina secret | 401 |
| Unknown URL | 404 (custom page) |
| `robots.txt` | production URL, saare private routes disallowed, AI crawlers blocked |
| `sitemap.xml` | koi private route nahi |
| GitHub Actions cron | `{"ok":true,"considered":0,"sent":0,"skipped":0,"failed":0}` â€” authenticated, DB query chali, abhi koi due nahi |

### Resend DNS â€” fixed

| Record | Name | Status |
|---|---|---|
| DKIM | `resend._domainkey.send.harshitsaini.in` | âœ… |
| SPF (TXT) | `send.harshitsaini.in` | âœ… `send.send.` se move hua |
| MX | `send.harshitsaini.in` | âœ… `send.send.` se move hua |
| DMARC | `_dmarc.harshitsaini.in` | âœ… `p=none` |

Ab bounce aur spam-complaint feedback kaam karega. Pehle DKIM sahi hone ki wajah se domain verified dikh raha tha aur mail bhi ja rahi thi, isliye ye dikkat chupi hui thi.

## â° Ab sirf ye yaad rakhna hai

1. **DMARC tightening** â€” `p=none` â†’ `p=quarantine` (~10 Sep 2026) â†’ `p=reject` (~10 Oct 2026), aur `sp=reject` wala variant use karo taaki root domain par asar na pade. Upar "DMARC ka roadmap" section me detail hai. Date asli shart nahi hai â€” pehle DMARC reports me dekh lo ki saari legitimate mail pass ho rahi hai.
2. **R2 migration** â€” media abhi Supabase Storage me hai. Video quota badhne par shift karna.
