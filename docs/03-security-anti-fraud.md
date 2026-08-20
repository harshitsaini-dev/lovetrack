# Security & Anti-Fraud Model

## Honest security statement (README me bhi ye jaana chahiye)

> **LoveTrack does not claim impossible spoof-proof verification.** It uses multi-signal verification, server-authoritative timestamps, fresh camera capture, geolocation checks, device binding, replay protection aur audit logging se fraudulent attendance ko *substantially harder aur detectable* banata hai.

Reality check: browser/PWA se 100% fake-GPS, fake-time, emulator, rooted device, virtual camera ya prerecorded media ko **mathematically impossible** banana possible nahi hai (MDN khud confirm karta hai ki media stream virtual source se bhi aa sakta hai). Isliye goal hai: **"fake karna difficult banao + suspicious cheez ko automatically flag/reject karo + immutable audit trail rakho."**

## Layered defenses (checklist)

```text
✅ HTTPS only
✅ Secure cookies (HttpOnly / Secure / SameSite jahan applicable)
✅ Supabase RLS
✅ Zod validation (client + server dono)
✅ server-side timestamps
✅ nonce + replay protection
✅ rate limiting
✅ signed media URLs (short-lived)
✅ private R2 bucket
✅ audit log
✅ admin RBAC (server-verified, frontend-trust nahi)
✅ CSRF protection jahan applicable
✅ Content Security Policy
✅ Permissions Policy (geolocation scoped to origin)
✅ camera permission checks
✅ location permission checks
✅ device registration
✅ suspicious activity risk scoring
```

## Design constraints (locked decisions)

1. **Mobile-first, always.** Ye PWA primarily phone par chalegi. Har screen pehle 360-430px width ke liye design hogi, phir tablet/desktop ke liye scale up. Desktop-first layout likhkar baad me "responsive banana" allowed nahi.
2. **No geofence.** Check-in kahin se bhi — sirf location genuine honi chahiye (section 2 dekhein).

## 1. Fake photo defense

**Kya nahi karna**: `<input type="file">` — isse gallery se purani/downloaded photo select ho sakti hai.

**Kya karna**:

```javascript
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user" },
  audio: false
})
```

Flow: `camera stream → video element → canvas → fresh frame → compress → upload`.

Extra layer — **random challenge**:

- Random phrase: `"BLUE ROSE 47"` — screen par dikhta hai, user camera ke saamne bolta/dikhata hai.
- MVP ke liye simpler: random head-turn instruction (`"Look LEFT"`, `"Blink twice"`).

**Explicitly avoid**: full AI face liveness — 18-hour MVP me overkill, expensive/unreliable without paid APIs.

## 2. Location model — **NO GEOFENCE, NO LIVE TRACKING** (decisions, 2026-08-20)

> **Decision A — koi geofence nahi.** Check-in/check-out **kisi bhi jagah se** ho sakta hai. Koi fixed office/approved location restriction nahi hai. **Requirement sirf ye hai ki jahan se bhi ho, wahan ki location sahi (genuine + accurate) capture ho.**

> **Decision B — koi continuous/live location sharing nahi.** Location **sirf us ek moment par** capture hoti hai jab user check-in / check-out / lunch mark kar raha hota hai. Uske baad app location ko **track nahi karta**. Koi `watchPosition`, koi background tracking, koi "partner ka live moving dot on map" nahi.

### Location kab capture hoti hai

```text
User "Check In" dabata hai
        ↓
us exact moment ka ek GPS fix liya jaata hai
        ↓
attendance record ke saath store ho jaata hai
        ↓
BAS. Uske baad koi location nahi li jaati.
```

Wahi cheez check-out aur lunch ke liye. **Har event = ek snapshot, ek baar.**

### Partner ko kya dikhta hai

Partner ko ek **live map** nahi dikhta. Use dikhta hai:

```text
Harshit ne check-in kiya
🕐 09:12 AM
📍 Janakpuri, Delhi
```

Yaani **event history + har event ki jagah** — na ki "abhi ye kahan hai". Ye difference LoveTrack ko attendance app rakhta hai, tracking app banne se rokta hai.

### Iska security par asar

Ye model **security ko aasan bhi karta hai aur privacy ko behtar bhi**:

- Sirf ek fix validate karna hota hai, continuous stream nahi
- Battery drain nahi, background permission nahi chahiye
- "App band hone ke baad bhi track hoga" wala jhooth bolne ki nautanki hi nahi
- Attack surface chhota — koi long-lived location stream hai hi nahi

Iska matlab security ka focus shift ho gaya hai:

| Purana model (dropped) | Naya model (active) |
|---|---|
| "Kya user approved area me hai?" | "Kya ye location reading real aur accurate hai?" |
| Distance > radius → REJECT | Distance check hai hi nahi |
| Geofence config per user/org | Koi geofence config nahi |

### Kya capture hota hai

```text
GPS lat/lng
+ accuracy (metres)
+ position timestamp (fix kitni purani hai)
+ heading / speed (jo browser de)
+ IP-derived region (heuristic)
+ device timezone (heuristic)
+ movement consistency vs previous capture
+ reverse-geocoded place name (display ke liye)
```

### Validation rules (geofence ki jagah ye)

```text
accuracy > MAX_LOCATION_ACCURACY_METERS (default 100m)
        → ❌ REJECT — "location accurate nahi hai, khule me jaakar dobara try karo"

accuracy > WARN_LOCATION_ACCURACY_METERS (default 50m)
        → 🟡 FLAG low-confidence (accept, but risk score badhta hai)

position fix age > MAX_LOCATION_AGE_SECONDS (default 30s)
        → ❌ REJECT — cached/stale location accept nahi hoti

implied speed > MAX_PLAUSIBLE_SPEED_KMH (default 900 km/h)
        → 🟡 suspicious — impossible movement between two captures

IP country/region ≠ GPS country/region
        → 🟡 suspicious (heuristic only, VPN se false positive ho sakta hai)

device timezone ≠ GPS-derived timezone
        → 🟡 suspicious (heuristic only)

exact same lat/lng repeated across many submissions (0 drift)
        → 🟡 suspicious — real GPS me hamesha thoda jitter hota hai
```

**Important**: `getCurrentPosition` me `enableHighAccuracy: true` aur `maximumAge: 0` set karna mandatory hai — warna browser cached (purani) location de dega jo is model ko todh degi. **`watchPosition` kabhi use nahi karna** — hum continuous tracking nahi kar rahe.

Note: "implied speed" check consecutive **attendance events** ke beech hota hai (jaise aaj ka check-in vs kal ka check-out) — kisi live stream ke beech nahi, kyunki live stream hai hi nahi.

**Caveat**: GPS spoofing ko browser se guaranteed-impossible nahi banaya ja sakta — geolocation permission-based hai aur device/user-agent-supplied coordinates par depend karti hai. Ye sab **heuristics** hain, **proof** nahi. Isliye har suspicious signal `risk_events` me log hota hai aur admin review kar sakta hai.

## 3. Device fingerprint / registration

First login par device register hota hai:

```text
user_device
--------------------
id, user_id, public_key, browser, os, created_at, last_seen, trusted, revoked
```

Better approach — **WebCrypto device key**: browser private+public keypair generate karta hai, private key device par hi rehti hai, server sirf public key store karta hai. Har attendance request `payload + nonce + device signature` ke saath aati hai — plain browser fingerprint se kaafi strong.

## 4. Replay / duplicate prevention

Har attendance session ek `nonce` (256-bit random) leta hai:

```text
checkin_session_id, nonce, created_at, expires_at
```

Server verify karta hai: `nonce valid? already used? expired? user correct? device correct?` — isse old photo/old nonce/old request reuse nahi ho sakta.

## 5. Risk scoring

```text
0–29     ✅ normal
30–59    🟡 suspicious
60–79    🟠 high risk
80–100   🔴 block
```

Thresholds **configurable** (`system_settings` table se), hardcoded nahi. Har contributing signal `risk_events` me individually logged hota hai taaki score explainable rahe.

## 6. Lunch video security

- Min 5s, max 20s video (`MediaRecorder`, fresh `MediaStream` only).
- Challenge phrase embedded (e.g. "Show your lunch + say BLUE 42").
- Direct upload to **private R2 bucket** — never public.
- Access sirf **short-lived signed URL** (~5 min expiry), admin/authorized partner ke liye.
- Path convention: `users/{userId}/attendance/{attendanceId}/lunch/{uuid}.webm`.
- Duration/compression/retention enforce karna zaroori hai — warna R2 free quota (10GB/month) jaldi khatam ho sakta hai.

## 7. Never trust list

```text
❌ client Date.now() for attendance timestamp
❌ client timezone
❌ client-provided current date
❌ client-provided verification status
❌ EXIF metadata as proof of anything
```

Server/DB time hi authoritative hai. Client time sirf UI-display convenience ke liye.

## 8. Admin-side security

- Separate protected routes for admin.
- Server-side role validation (RLS + explicit checks) — client-side role check kabhi trust nahi.
- Sensitive actions (suspend user, revoke device, revoke pair, review media, approve leave, change settings) — **sab audit-logged**.
- No unrestricted storage access even for admin — signed URLs yahan bhi.

## Live location — **build hi nahi karni** (deliberate scope exclusion)

Ye section pehle "live location ko lightweight rakhna" kehta tha. Ab decision aur saaf hai: **live location feature hai hi nahi.**

Explicitly banned:

```text
❌ watchPosition()
❌ background location tracking
❌ "partner ka live moving dot" on map
❌ "last updated 8 sec ago" live indicator
❌ periodic location polling
❌ service worker se location capture
```

Sirf ye allowed hai:

```text
✅ ek single getCurrentPosition() call, us waqt jab user
   khud check-in / check-out / lunch button dabata hai
```

Agar kabhi future me continuous sharing add karne ka socha jaaye, to wo ek **naya product decision** hoga — chupke se add nahi hoga.

## Privacy-by-design control (non-negotiable UX requirement)

- Partner ko kuch bhi dikhna **sirf mutual consent/pairing ke baad**.
- Har waqt visible **"Stop Sharing"** control — click karte hi turant effective.
- User ko clearly dikhna chahiye ki unka kya data kis paired person ko visible hai.
- Chuki continuous tracking hai hi nahi, "sharing band" ka matlab hai: partner ab aapke attendance events ki location nahi dekh sakta. Koi background stream rokne ki zaroorat hi nahi padti — kyunki wo kabhi chalu hi nahi tha.

Ye decision LoveTrack ko "useful consensual tool" aur "creepy surveillance app" ke beech differentiate karta hai — is par kabhi compromise mat karna.
