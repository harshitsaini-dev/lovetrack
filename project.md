Bilkul. **LoveTrack** ko main “couples/friends ke liye voluntary attendance + live activity verification PWA” ke रूप में design karunga — hidden tracking app ke रूप में nahi. Har user ko clearly pata hoga ki unki location/activity kis paired person ko visible hai, aur pairing/revoke dono side se possible hoga.

Sabse important reality check: **browser/PWA alone se 100% fake GPS, fake date/time, emulator, rooted-device, virtual camera ya prerecorded media ko mathematically impossible banana possible nahi hai.** `getUserMedia()` camera stream hardware ke saath-saath virtual video source se bhi aa sakta hai, aur browser geolocation user/device-provided coordinates par depend karta hai. ([MDN Web Docs][1])
Isliye LoveTrack ka target hona chahiye: **“fake karna difficult + suspicious submissions automatically reject/flag + immutable audit trail.”**

## 1. LoveTrack ka overall concept

Architecture:

```text
                         ┌─────────────────────────┐
                         │       LoveTrack PWA     │
                         │ Next.js + TypeScript    │
                         │ Tailwind + shadcn/ui    │
                         │ Framer Motion           │
                         └────────────┬────────────┘
                                      │
                         HTTPS / Secure Context
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
          Authentication        Attendance API        Media Capture
                │                     │                     │
                ▼                     ▼                     ▼
        ┌──────────────┐      ┌───────────────┐      ┌──────────────┐
        │  Supabase    │      │ Cloudflare    │      │ Camera/Mic   │
        │ Auth         │      │ Worker        │      │ getUserMedia │
        │ PostgreSQL   │      │ Anti-abuse    │      │ MediaRecorder│
        └──────┬───────┘      └───────┬───────┘      └──────┬───────┘
               │                      │                     │
               │                      │                     │
               ▼                      ▼                     ▼
        Users / Pairing       Verification Engine      Upload URL
        Roles / RLS           Risk Scoring              │
        Attendance            Server timestamp          ▼
        Leaves                Geo checks            Cloudflare R2
        Audit logs            Rate limiting           Media
               │
               ▼
        ┌─────────────────────┐
        │      Resend         │
        │ email notifications │
        └─────────────────────┘
```

### Recommended stack

| Layer              | Technology               |
| ------------------ | ------------------------ |
| Frontend           | **Next.js + TypeScript** |
| UI                 | Tailwind CSS + shadcn/ui |
| Animation          | Framer Motion            |
| PWA                | next-pwa / Workbox       |
| Auth               | Supabase Auth            |
| DB                 | Supabase PostgreSQL      |
| Authorization      | PostgreSQL RLS           |
| API/security       | Cloudflare Workers       |
| Media              | Cloudflare R2            |
| Email              | Resend                   |
| Map                | Leaflet + OpenStreetMap  |
| Forms              | React Hook Form + Zod    |
| State              | Zustand                  |
| Date handling      | date-fns                 |
| Testing            | Vitest + Playwright      |
| Browser automation | Playwright MCP           |
| Deployment         | Cloudflare Pages         |
| Source control     | GitHub                   |

Is combination ka major advantage ye hai ki MVP practically **₹0 infrastructure cost** par chal sakta hai within reasonable personal usage. Supabase Free currently gives 500 MB DB and 5 GB egress; Cloudflare R2 currently gives 10 GB-month storage plus 1M Class A and 10M Class B requests free/month with no egress charge. ([Supabase][2])

Resend ka current free tier **3,000 emails/month / 100 emails/day** hai, jo small LoveTrack deployment ke liye useful hai. ([Resend][3])

Cloudflare Pages/Workers bhi MVP ke liye workable hain: Pages Free has 500 builds/month and Workers Free has 100,000 requests/day. ([Cloudflare Docs][4])

---

# 2. User roles

LoveTrack me 3 roles rakho:

### USER

Normal user.

Capabilities:

* Login
* Profile
* Pair with partner/friend
* Check-in
* Check-out
* Lunch start
* Lunch end
* Lunch proof video
* Leave
* Attendance history
* Activity timeline
* Location visibility
* Notification settings
* Privacy settings

### PARTNER

A paired person ko:

```text
Partner Activity

🟢 Online
📍 Current Location
🕐 Checked in 09:12 AM
🍱 Lunch 01:22 PM
🔴 Checked out 06:04 PM
```

dikhe.

Lekin **location sharing explicit consent ke bina nahi hogi**.

### ADMIN

Admin:

* Users
* Pairings
* Attendance
* Leaves
* Failed verification
* Suspicious activity
* Location audit
* Media evidence
* Email logs
* System settings
* User suspension
* Device management
* Audit logs

---

# 3. Core attendance flow

## CHECK-IN

User:

```text
❤️ Good Morning Harshit

Today — Thu, 20 Aug

     ┌──────────────────┐
     │     📷 CAMERA    │
     │                  │
     │   live preview   │
     │                  │
     └──────────────────┘

Location
📍 28.62xxxx, 77.0xxxxx
Accuracy: 8m

Server Time
09:14:27 AM

[ VERIFY & CHECK IN ]
```

Button click par:

### Step 1

Camera permission.

### Step 2

Location permission.

### Step 3

Fresh camera frame capture.

**File picker nahi hoga.**

Browser camera API `getUserMedia()` secure HTTPS context me permission ke saath camera access deta hai. ([MDN Web Docs][1])

### Step 4

Fresh geolocation.

Capture:

```json
{
  "latitude": 28.62,
  "longitude": 77.05,
  "accuracy": 9,
  "altitude": null,
  "heading": 120,
  "speed": 0
}
```

### Step 5

Frontend clock ignore.

Server:

```text
server_timestamp = database/server time
```

So:

```text
Laptop time = fake
Phone time = fake
Timezone = fake
```

hone se attendance timestamp change nahi hona chahiye.

### Step 6

Verification.

```text
photo freshness
+
location accuracy
+
geofence
+
server timestamp
+
session nonce
+
device risk
+
duplicate detection
=
verification result
```

---

# 4. Fake photo rokne ka design

Normal:

```html
<input type="file">
```

**use mat karna.**

Instead:

```javascript
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user"
  },
  audio: false
})
```

Then:

```text
Camera stream
      ↓
Video element
      ↓
Canvas
      ↓
fresh frame
      ↓
compress
      ↓
upload
```

Isse UI se old gallery photo select karna disable ho jayega.

### But important

Ye alone 100% security nahi hai.

Virtual camera/browser manipulation still possible ho sakti hai. MDN specifically note karta hai ki media stream physical camera ke alawa virtual video source se bhi originate ho sakta hai. ([MDN Web Docs][1])

Isliye extra checks:

### Random challenge

Example:

```text
Today's verification phrase:

❤️ BLUE ROSE 47
```

Camera preview me phrase display hoga.

User ko camera ke saamne:

```text
BLUE ROSE 47
```

bolna/visible action karna hoga.

For MVP:

```text
random phrase
+
random head-turn instruction
```

Example:

```text
Look LEFT
```

Ya:

```text
Blink twice
```

Full AI face liveness 18-hour MVP me mat daalna.

---

# 5. Fake location defence

Location capture:

```text
GPS
+
accuracy
+
timestamp
+
IP region
+
timezone
+
movement consistency
+
geofence
```

Example:

Company/approved place:

```text
center:
28.620123
77.052134

radius:
150 meters
```

Submission:

```text
distance = 9m
accuracy = 8m
```

✅ PASS

Submission:

```text
distance = 4.8km
accuracy = 12m
```

❌ REJECT

### Suspicious checks

```text
accuracy > 100m
                 ↓
           suspicious

IP country mismatch
                 ↓
           suspicious

timezone mismatch
                 ↓
           suspicious

impossible movement
                 ↓
           suspicious
```

But GPS spoofing cannot be guaranteed to be impossible from a browser alone; browser geolocation is permission-based and exposes coordinates supplied by the device/user agent. ([MDN Web Docs][5])

---

# 6. Device fingerprint / registration

First login:

```text
Device Registration

📱 Device: Android
🌐 Browser: Chrome
🆔 Device ID
```

Store:

```text
user_device
--------------------
id
user_id
public_key
browser
os
created_at
last_seen
trusted
revoked
```

Better security:

### WebCrypto device key

Browser generates:

```text
private key
public key
```

Private key device par.

Server stores public key.

Attendance request:

```text
payload
+
nonce
+
device signature
```

This is much better than simply storing a browser fingerprint.

---

# 7. Prevent duplicate / old submission

Every attendance session gets:

```text
nonce = random 256-bit value
```

Example:

```text
checkin_session_id
nonce
created_at
expires_at
```

Frontend can't reuse:

```text
old photo
old nonce
old request
```

because server verifies:

```text
nonce valid?
already used?
expired?
user correct?
device correct?
```

---

# 8. Lunch system

This feature LoveTrack ko interesting bana dega.

Flow:

```text
❤️ Start Lunch
        ↓
fresh camera
        ↓
location
        ↓
server timestamp
        ↓
Lunch Started
```

Then:

```text
🍱 Lunch Verification Required

Record a 10–20 sec video

Today's challenge:

"Show your lunch + say BLUE 42"

[ START RECORDING ]
```

### Video requirements

```text
minimum: 5 sec
maximum: 20 sec
front/rear camera configurable
fresh MediaStream only
audio optional
```

Use:

```javascript
MediaRecorder
```

Video direct R2 upload.

**Important design decision:** video ko Supabase DB/storage me rakhne ke bajay R2 use karna better hai because lunch videos quickly consume storage.

R2 currently has a 10 GB-month free storage allowance and no egress charge; this makes it a strong fit for evidence media. ([Cloudflare Docs][6])

---

# 9. Lunch video ko secure kaise rakhen

Video path:

```text
users/{userId}/attendance/{attendanceId}/lunch/{uuid}.webm
```

Private bucket.

User ko direct public URL nahi.

Server creates:

```text
short-lived signed URL
```

Example:

```text
expires = 5 minutes
```

Admin/authorized partner only.

---

# 10. Leave system

Dashboard:

```text
❤️ LoveTrack

Today

🟢 Check In
🍱 Lunch
🔴 Check Out

───────────────

Leave

[ Apply Leave ]
```

Form:

```text
Leave Date
Leave Type
Reason *
```

Reason mandatory.

```text
[ Submit Leave ]
```

Database:

```text
leave_requests

id
user_id
leave_date
reason
status
created_at
reviewed_by
reviewed_at
```

Status:

```text
PENDING
APPROVED
REJECTED
```

Admin approval optional configuration ke through enable karna.

---

# 11. Automatic reminder system

Daily cron:

```text
8:30 PM
       ↓
users list
       ↓
today attendance complete?
       ↓
NO
       ↓
leave marked?
       ↓
NO
       ↓
send reminder
```

Email:

```text
❤️ LoveTrack Reminder

Aaj ki activity complete nahi hui hai.

Please complete:
✓ Check-in
✓ Lunch proof
✓ Check-out

— LoveTrack
```

Resend free plan currently allows 3,000 emails/month and 100/day. ([Resend][3])

### Important

18-hour MVP me email automation ko:

```text
Cloudflare Cron Trigger
```

se run karao.

---

# 12. Check-in email

Successful check-in:

```text
❤️ LoveTrack Activity

Harshit checked in.

Time:
09:12 AM

Location:
Janakpuri, Delhi

Verification:
✅ Camera
✅ Location
✅ Device
```

Partner ko email optional.

Admin ko email optional.

User settings:

```text
☑ Check-in email
☑ Lunch email
☑ Check-out email
☑ Leave email
☑ Reminder email
```

---

# 13. Live activity

Dashboard:

```text
❤️ LOVE MODE

┌─────────────────────────────┐
│                             │
│       💕 HARSHIT            │
│                             │
│       🟢 ACTIVE             │
│                             │
│      📍 Janakpuri           │
│                             │
│      09:14 AM               │
│                             │
└─────────────────────────────┘
```

Map:

```text
         ❤️
          📍
       HARSHIT

       Accuracy 12m

Last update:
09:18:42
```

### Privacy control

```text
Location Sharing

🟢 Enabled
      ↓
Partner can see live location

[ Stop Sharing ]
```

Stop sharing immediately works.

---

# 14. Database architecture

Main tables:

```text
users
profiles
devices
pairs
pair_permissions

attendance
attendance_verifications
attendance_locations

lunch_sessions
lunch_proofs

leave_requests

notifications
email_logs

audit_logs

risk_events
system_settings
```

### Attendance

```text
attendance
-------------------------
id
user_id
attendance_date
check_in_at
check_out_at
status
check_in_id
check_out_id
created_at
updated_at
```

### Verification

```text
attendance_verifications
-------------------------
id
attendance_id
type
nonce_hash
server_timestamp
latitude
longitude
accuracy
ip_hash
device_id
risk_score
verification_status
failure_reason
created_at
```

### Pair

```text
pairs
-------------------------
id
requester_id
receiver_id
status
created_at
accepted_at
revoked_at
```

---

# 15. RLS — extremely important

Supabase database me:

```text
User A
   ↓
can read
   ↓
own data

Partner A
   ↓
can read
   ↓
Partner B's shared data
```

But:

```text
User A
   ❌ cannot update User B attendance

Partner A
   ❌ cannot access User B private media

Normal user
   ❌ cannot access admin tables
```

Admin:

```text
role = admin
```

with server-side authorization.

---

# 16. Security rules

LoveTrack me ye mandatory hain:

```text
✅ HTTPS only
✅ Secure cookies
✅ Supabase RLS
✅ Zod validation
✅ server-side timestamps
✅ nonce
✅ replay protection
✅ rate limiting
✅ signed media URLs
✅ private R2 bucket
✅ audit log
✅ admin RBAC
✅ CSRF protection where applicable
✅ Content Security Policy
✅ Permissions Policy
✅ camera permission checks
✅ location permission checks
✅ device registration
✅ suspicious activity scoring
```

Geolocation ke liye `Permissions-Policy` bhi configure ki ja sakti hai so that location access limited origin tak rahe. ([MDN Web Docs][7])

---

# 17. UX theme

Tumne love theme bola hai, but meri recommendation:

**“Premium LoveTech”**

Na ki overly pink dating app.

### Light theme

```text
Background:
#FFF8FB

Primary:
Rose

Accent:
Lavender

Text:
Deep charcoal

Cards:
Glass / soft shadow
```

### Dark theme

```text
Background:
#0D0810

Primary:
Rose

Accent:
Purple

Cards:
#17111A
```

### UI language

```text
❤️ LoveTrack
Good morning, Harshit
Your day is looking lovely.

🟢 Checked in

🍱 Lunch
🔴 Check out
```

Animations:

```text
heart pulse
soft floating hearts
card slide
location pulse
button micro-interaction
success confetti
```

But accessibility ke liye:

```text
prefers-reduced-motion
```

honour karna.

---

# 18. PWA pages

```text
/
├── landing
├── login
├── register
├── forgot-password
│
├── app
│   ├── dashboard
│   ├── check-in
│   ├── lunch
│   ├── check-out
│   ├── leave
│   ├── history
│   ├── partner
│   ├── location
│   ├── notifications
│   ├── settings
│   └── devices
│
└── admin
    ├── dashboard
    ├── users
    ├── attendance
    ├── leaves
    ├── live-activity
    ├── verification
    ├── media
    ├── suspicious
    ├── emails
    ├── audit
    └── settings
```

---

# 19. Admin dashboard

Main cards:

```text
Users                 24
Active today          18
Checked in            15
On leave               3
Lunch pending          6
Suspicious              2
```

Charts:

```text
Attendance trend
Lunch completion
Leave trend
Verification failures
User activity
```

Table:

```text
USER     IN       LUNCH     OUT       STATUS
Harshit  09:12    ✅ 13:02  —         🟢
Friend   09:25    ❌        18:02      ⚠️
```

---

# 20. Suspicious activity dashboard

This is important.

Example:

```text
⚠ Suspicious Submission

User: Rahul

Reasons:
• GPS accuracy: 780m
• Location mismatch
• Device changed
• Timestamp anomaly

Risk Score:
87/100

[ REVIEW ]
```

Risk score:

```text
0–29    ✅ normal
30–59   🟡 suspicious
60–79   🟠 high risk
80–100  🔴 block
```

---

# 21. “100% secure” ki jagah actual security model

LoveTrack ka security statement:

> **LoveTrack does not claim impossible spoof-proof verification. It uses multi-signal verification, server-authoritative timestamps, fresh camera capture, geolocation checks, device binding, replay protection and audit logging to make fraudulent attendance substantially harder and detectable.**

Ye technically honest hai.

---

# 22. 18-hour development strategy

18 hours me **production-grade full enterprise version** realistic nahi hai.

But **very strong MVP** realistic hai.

### Hour 0–1

```text
architecture
repo
Next.js
Supabase
Cloudflare
environment
```

### Hour 1–3

```text
auth
database
roles
RLS
profile
pairing
```

### Hour 3–6

```text
dashboard
camera
location
check-in
check-out
server timestamps
```

### Hour 6–8

```text
lunch
MediaRecorder
R2
signed URL
```

### Hour 8–10

```text
leave
reminders
email
Resend
```

### Hour 10–12

```text
admin dashboard
users
attendance
leaves
audit
```

### Hour 12–14

```text
theme
motion
responsive
PWA
accessibility
```

### Hour 14–16

```text
security hardening
rate limit
risk engine
permissions
error handling
```

### Hour 16–17

```text
Playwright
critical flows
mobile tests
accessibility
```

### Hour 17–18

```text
production deploy
GitHub
README
.env documentation
smoke testing
final fix
```

---

# 23. GitHub structure

```text
LoveTrack/
│
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── admin/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── attendance/
│   ├── camera/
│   ├── location/
│   ├── lunch/
│   ├── partner/
│   └── admin/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── security/
│   ├── location/
│   ├── media/
│   ├── email/
│   ├── risk/
│   └── validation/
│
├── hooks/
│
├── stores/
│
├── types/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── policies.sql
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/
│   ├── icons/
│   └── manifest.json
│
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── deployment.md
│   └── testing.md
│
├── .env.example
├── README.md
├── package.json
└── LICENSE
```

---

# 24. Git workflow

Claude ko ye workflow follow karwana:

```text
main
│
├── feat/auth
├── feat/attendance
├── feat/lunch
├── feat/admin
├── feat/email
└── fix/*
```

Commits:

```text
feat: initialize LoveTrack PWA
feat: implement authentication
feat: add consent based pairing
feat: implement secure check-in
feat: implement lunch proof recording
feat: add admin attendance dashboard
feat: add transactional emails
test: add attendance e2e flows
fix: harden geolocation validation
docs: add deployment guide
```

---

# 25. Playwright MCP

Playwright MCP official docs currently support Claude Code directly using:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

and then Claude Code browser interactions/tests perform kar sakta hai. ([Playwright][8])

Claude ko ye flows automate karne chahiye:

```text
Register
Login
Pair
Check-in
Reject gallery upload
Location permission denied
Lunch recording
Leave request
Admin login
Admin review
Email trigger
Logout
```

---

# 26. Accessibility tests

Must test:

```text
keyboard navigation
focus visible
button labels
ARIA
contrast
screen reader semantics
form error messages
reduced motion
touch targets
```

---

# 27. Production deployment

Recommended:

```text
GitHub
   ↓
Cloudflare Pages
   ↓
LoveTrack PWA

Supabase
   ↓
DB/Auth

Cloudflare R2
   ↓
photos/videos

Cloudflare Worker
   ↓
security/API/cron

Resend
   ↓
emails
```

Cloudflare Pages Free currently supports Git-based builds, with 500 builds/month; static asset requests are free/unlimited, while Pages Functions consume Workers request quota. ([Cloudflare Docs][4])

### URL

Initial:

```text
lovetrack.pages.dev
```

Custom domain later optional.

---

# 28. Claude Code ko exactly kya instruction deni hai

Neeche wala **master prompt** Claude Code ke root project me use karo.

# LoveTrack — Claude Code Master Build Prompt

You are the lead full-stack engineer, security engineer, QA engineer, UI/UX engineer and DevOps engineer for this project.

Project name: **LoveTrack**

Build a production-ready MVP PWA in approximately 18 focused development hours.

IMPORTANT:

* Explain all work to me in Hinglish.
* Do not repeatedly ask for confirmation.
* Inspect the existing repository before changing anything.
* Make reasonable technical decisions yourself.
* Perform all code/configuration/database/migration/test/documentation work yourself.
* Ask me only for unavoidable manual actions such as:

  * creating external accounts
  * copying API keys
  * OAuth/domain verification
  * accepting deployment/login prompts
  * granting browser permissions when required
  * entering secrets into provider dashboards
* Never expose secrets in source control.
* Never commit .env files containing secrets.
* Create and maintain .env.example.
* After every major milestone, summarize what was completed in Hinglish and what manual action I must perform, if any.

## PRODUCT

LoveTrack is a consent-based attendance and activity verification PWA for couples/friends.

Every user explicitly controls who can see their shared activity.

Do NOT implement hidden surveillance.

A user must be able to:

* pair/unpair another user
* revoke location sharing
* view what data is being shared
* delete/revoke access where appropriate

## PRIMARY FEATURES

1. Authentication

* email/password
* forgot password
* email verification
* protected routes
* role-based authorization
* user profile

2. Consent-based pairing

* send pairing request
* accept/reject
* revoke pairing
* shared-data permissions
* location sharing toggle

3. Check-in

* camera-only capture
* do not provide gallery/file upload for attendance proof
* use getUserMedia()
* fresh camera frame
* fresh geolocation
* server authoritative timestamp
* unique nonce
* device binding
* optional random challenge
* geofence verification
* accuracy check
* risk scoring
* audit log
* verification status

4. Check-out

* same security model as check-in

5. Lunch

* start lunch
* fresh location
* server timestamp
* lunch proof video
* MediaRecorder
* 5-20 second video
* challenge phrase
* upload to private Cloudflare R2
* signed temporary URLs
* lunch completion state

6. Leave

* date
* leave type
* mandatory reason
* status
* optional admin approval
* audit trail

7. Automatic reminders

* detect missing activity
* send reminder email
* configurable reminder schedule
* avoid duplicate email spam
* email logs

8. Activity emails

* check-in
* lunch
* check-out
* leave
* reminder
* suspicious activity notification
* configurable per user

9. Partner dashboard

* active/inactive state
* check-in/check-out
* lunch state
* consented location sharing
* current/latest location
* last updated timestamp
* map visualization
* never expose data without permission

10. Admin

* dashboard
* users
* pairings
* attendance
* leaves
* verification
* suspicious events
* media evidence
* email logs
* audit logs
* system settings
* user/device revoke
* account suspension

## SECURITY MODEL

Do NOT claim impossible "100% spoof-proof" browser security.

Build defense in depth:

* HTTPS
* secure context
* HttpOnly/Secure/SameSite cookies where applicable
* Supabase RLS
* server-side validation
* Zod schemas
* server-authoritative timestamps
* nonce
* replay protection
* rate limiting
* device registration
* WebCrypto device key if practical
* private R2 bucket
* expiring signed media URLs
* role checks
* audit logs
* Content Security Policy
* Permissions Policy
* camera permission checks
* geolocation permission checks
* geofence
* location accuracy validation
* suspicious risk scoring
* duplicate submission detection
* impossible movement detection
* timezone/IP consistency checks as heuristic only
* never trust EXIF metadata as proof
* never trust client-side time
* never trust client-provided verification status

## ANTI-FRAUD

Attendance proof must use getUserMedia() instead of file input.

Implement:

camera stream
-> video preview
-> fresh frame
-> canvas capture
-> image compression
-> upload

Implement a random challenge system.

Example:

"LOOK LEFT"
or
"SHOW BLUE 42"

Keep challenge configurable.

Do not add expensive AI liveness unless it can be implemented reliably without external paid APIs.

For geolocation:

* obtain navigator.geolocation
* store latitude
* longitude
* accuracy
* capturedAt
* compare distance to configured allowed location
* reject poor accuracy
* flag suspicious cases
* use server timestamp
* maintain verification status

Create risk scoring:

0-29 = normal
30-59 = suspicious
60-79 = high risk
80-100 = blocked

Make thresholds configurable.

## TECH STACK

Frontend:

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion
* React Hook Form
* Zod
* Zustand

Backend/data:

* Supabase Auth
* Supabase PostgreSQL
* PostgreSQL RLS

Infrastructure:

* Cloudflare Pages
* Cloudflare Workers
* Cloudflare R2
* Cloudflare Cron

Email:

* Resend

Maps:

* Leaflet
* OpenStreetMap

Testing:

* Vitest
* Playwright
* Playwright MCP

## UI/UX

Create a premium "LoveTech" aesthetic.

Do not make it childish.

Light theme:

* soft blush
* rose
* lavender
* warm white
* charcoal

Dark theme:

* deep plum
* near-black
* rose
* lavender
* subtle glow

Use:

* glassmorphism carefully
* soft gradients
* rounded cards
* premium spacing
* elegant typography
* subtle heart animations
* pulse indicators
* map pulse markers
* success micro-interactions
* loading skeletons
* empty states
* excellent mobile UX

Respect:
prefers-reduced-motion

All interactive elements need:

* visible focus
* keyboard support
* accessible name
* useful error states
* good contrast
* minimum touch target size

## DATABASE

Create migrations for:

users/profile-related data
profiles
devices
pairs
pair_permissions
attendance
attendance_verifications
attendance_locations
lunch_sessions
lunch_proofs
leave_requests
notifications
email_logs
audit_logs
risk_events
system_settings

Use UUID primary keys where appropriate.

Add indexes for:

* user_id
* attendance_date
* created_at
* pair relationships
* status
* risk events

Write strong RLS policies.

Users can access their own data.

Paired users can only access explicitly shared data.

Admin access must be explicitly role-controlled.

Never rely only on frontend role checks.

## MEDIA

R2 structure:

users/{userId}/attendance/{attendanceId}/checkin/{uuid}.webp
users/{userId}/attendance/{attendanceId}/checkout/{uuid}.webp
users/{userId}/attendance/{attendanceId}/lunch/{uuid}.webm

All evidence is private.

Generate short-lived signed URLs.

Do not expose bucket publicly unless there is a compelling technical reason.

Validate:

* MIME type
* max size
* file extension
* ownership
* associated attendance ID

## EMAIL

Build reusable email templates.

Templates:

* welcome
* check-in
* lunch
* check-out
* leave submitted
* leave approved
* leave rejected
* missing activity reminder
* suspicious activity

Store delivery attempts/status in email_logs.

Respect user notification settings.

Prevent duplicate reminders.

## CRON

Create a scheduled worker.

Tasks:

* missing attendance detection
* reminder email
* stale activity detection
* cleanup expired records if configured
* optional media retention handling

Make all cron actions idempotent.

## API DESIGN

Use typed service functions.

Keep business logic out of React components.

Recommended structure:

lib/auth
lib/security
lib/location
lib/media
lib/email
lib/risk
lib/pairing
lib/attendance

Use explicit result/error types.

Return safe errors to clients.

Do not leak internal database errors or secrets.

## PROJECT STRUCTURE

Create and maintain:

app/
components/
hooks/
lib/
stores/
types/
supabase/
tests/
public/
docs/

Include:

README.md
.env.example
docs/architecture.md
docs/security.md
docs/deployment.md
docs/testing.md

## TESTING

Use Playwright MCP.

Install:

claude mcp add playwright npx @playwright/mcp@latest

Then test:

1. registration
2. login
3. logout
4. forgot password flow
5. pair request
6. pair acceptance
7. revoke pairing
8. check-in
9. gallery/file upload unavailable for attendance
10. location permission denied
11. bad accuracy
12. outside geofence
13. duplicate submission
14. replay nonce
15. lunch recording
16. lunch upload
17. leave request
18. missing attendance reminder
19. partner activity
20. admin login
21. admin attendance
22. suspicious activity
23. signed media URL
24. unauthorized media access
25. mobile viewport
26. keyboard navigation

Create unit tests for:

* geofence distance
* risk score
* nonce validation
* attendance state machine
* leave validation
* pairing permission
* reminder eligibility

Create E2E tests for the critical user flows.

Run:

* lint
* typecheck
* tests
* build

Fix failures before calling the milestone complete.

## STATE MACHINE

Attendance:

NONE
-> CHECKIN_PENDING
-> CHECKED_IN
-> LUNCH_ACTIVE
-> LUNCH_VERIFIED
-> CHECKED_OUT

Allow only valid transitions.

Prevent:

* duplicate check-in
* checkout before check-in unless explicitly configured
* multiple lunch sessions
* lunch proof without lunch session
* multiple checkout

## SERVER TIME

Never trust:
Date.now() from the client
client timezone
client-provided current date

Use database/server time for the authoritative attendance timestamp.

Client time may only be shown as UI convenience.

## LIVE ACTIVITY

Use polling initially for MVP instead of complicated realtime if faster.

Optimize:

* 15-30 second activity refresh
* latest known location
* last updated timestamp
* explicit location-sharing status

If Supabase Realtime is straightforward, use it for status updates.

Do not implement unnecessary complexity.

## ADMIN SECURITY

Admin:

* separate protected routes
* server-side role validation
* audit all sensitive admin actions
* no direct client trust
* no unrestricted storage access

Sensitive actions:

* suspend user
* revoke device
* revoke pair
* review media
* approve leave
* change system settings

All should generate audit logs.

## GITHUB

Initialize repository if needed.

Create:
.gitignore
.env.example
README.md

Use meaningful commit messages.

Recommended commits:

feat: initialize LoveTrack PWA
feat: implement authentication
feat: implement consent-based pairing
feat: implement attendance verification
feat: implement lunch proof recording
feat: implement leave workflow
feat: add notification emails
feat: add admin dashboard
feat: add risk detection
test: add Playwright attendance flows
test: add accessibility coverage
fix: harden authorization checks
docs: add deployment documentation

Never commit:
.env
service role keys
database passwords
private keys
R2 secrets
Resend API keys

## README

README must include:

* LoveTrack overview
* features
* architecture diagram
* stack
* security model
* local setup
* environment variables
* Supabase setup
* R2 setup
* Resend setup
* Cloudflare setup
* migrations
* testing
* deployment
* GitHub workflow
* limitations
* privacy notes

## MANUAL ACTIONS

Whenever external provider setup is required, stop only at that exact point and tell me in Hinglish:

1. website to open
2. exact setting to click
3. exact value to copy
4. exact .env key to populate
5. how to verify success

Then continue automatically once the information is available.

## DEVELOPMENT ORDER

Follow exactly:

PHASE 1
Repository + Next.js + styling + architecture

PHASE 2
Supabase Auth + DB + RLS + profile

PHASE 3
Pairing + permissions

PHASE 4
Check-in/check-out + camera + location + nonce + server time

PHASE 5
Lunch recording + R2

PHASE 6
Leave + reminders + Resend

PHASE 7
Partner activity

PHASE 8
Admin

PHASE 9
Risk engine + security hardening

PHASE 10
PWA + animations + accessibility

PHASE 11
Unit tests + Playwright MCP + E2E

PHASE 12
Build + deployment + GitHub + README

## IMPORTANT BEHAVIOR

Do not over-engineer the first version.

Prioritize:
security
privacy
correctness
mobile UX
working core flows

Avoid unnecessary:
microservices
Kubernetes
Redis
GraphQL
complex AI
paid APIs
large third-party dependencies

This is an 18-hour MVP.

Whenever a choice exists between:
"perfect but slow"
and
"secure, maintainable and working"

choose the second.

Always explain progress in Hinglish.

At the end of each phase print:

PHASE COMPLETE
What I built:
What I tested:
What remains:
Manual action required:

```
---

# First task

Inspect the repository.

Then create an implementation plan in `docs/implementation-plan.md`.

Do not wait for my approval to begin.

Start implementation immediately.
```

---

# 29. Claude ko MCP setup

Claude Code terminal:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Ye official Playwright MCP setup hai. ([Playwright][8])

Uske baad Claude ko prompt do:

```text
Use Playwright MCP aggressively during implementation.
Do not just write tests.
Actually open the running LoveTrack application and interact with it.

Validate:
- mobile layout
- camera flow UI
- location states
- disabled states
- error messages
- loading states
- admin navigation
- partner activity
- accessibility
- visual consistency

When something looks wrong, fix the implementation and retest.
```

---

# 30. Ek aur important architecture decision

**“Live location” ko 1-second tracking mat banana.**

PWA me background location tracking reliable native-app-level guarantee nahi deta. Better MVP:

```text
while app active:
    watchPosition()
        ↓
    update latest location
```

aur partner ko:

```text
Last updated 8 sec ago
```

dikhana.

Jab user app close kar deta hai, “always-live” location ka claim mat karna. Browser permission/background execution limitations ki wajah se PWA ko native GPS tracker samajhna galat hoga. Geolocation browser permission aur secure-context model ke through expose hoti hai. ([MDN Web Docs][5])

---

# 31. ₹0 setup ka practical version

### Free

```text
GitHub
       ₹0

Cloudflare Pages
       ₹0

Cloudflare Workers
       ₹0 within quota

Cloudflare R2
       ₹0 within 10GB/month free storage

Supabase
       ₹0 within free quota

Resend
       ₹0 within 3,000 emails/month

OpenStreetMap
       ₹0 for MVP
```

Cloudflare currently gives 10 GB/month R2 free storage, 1M Class-A and 10M Class-B requests, while Workers Free has 100k requests/day; Supabase Free provides 500 MB DB and 5 GB egress. ([Cloudflare Docs][6])

**But** videos are the biggest cost/quota risk. A 15-second lunch video at roughly 1–3 MB each can consume R2 storage surprisingly quickly with many users, so Claude should enforce duration, compression, retention and max-size rules.

---

# 32. What I would NOT build in the first 18 hours

Avoid:

```text
❌ AI face recognition
❌ AI video deepfake detection
❌ native Android app
❌ native iOS app
❌ WebRTC location stream
❌ complicated microservices
❌ custom map backend
❌ biometric authentication
❌ real-time 1-second location engine
❌ expensive AI APIs
```

Ye sab 18-hour MVP ko derail kar sakte hain.

---

# 33. LoveTrack ka final MVP

```text
❤️ LOVETrack

LOGIN
  ↓
PAIR
  ↓
CONSENT
  ↓
DASHBOARD
  │
  ├── 📷 CHECK IN
  │       ├─ Fresh Camera
  │       ├─ Fresh Location
  │       ├─ Server Time
  │       ├─ Nonce
  │       └─ Risk Check
  │
  ├── 🍱 LUNCH
  │       ├─ Location
  │       ├─ Timestamp
  │       └─ Fresh Video
  │
  ├── 🔴 CHECK OUT
  │
  ├── 📝 LEAVE
  │
  └── ❤️ PARTNER
          ├─ Activity
          ├─ Location
          └─ Timeline

ADMIN
  ├─ Users
  ├─ Attendance
  ├─ Leaves
  ├─ Live Activity
  ├─ Evidence
  ├─ Suspicious
  ├─ Emails
  └─ Audit Logs
```

**Ye architecture tumhare use-case ke liye best balance hai: 18-hour MVP + zero/near-zero hosting cost + GitHub + PWA + premium Love theme + camera/location verification + lunch video + emails + admin + Playwright MCP.**

Ek cheez ko deliberately “secure-by-design” rakho: **partner tracking sirf mutual consent/pairing ke baad** ho aur ek visible **“Stop Sharing Location”** control hamesha available ho. Isse LoveTrack useful bhi rahega aur hidden surveillance tool me convert nahi hoga.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia...?utm_source=chatgpt.com "MediaDevices: getUserMedia() method - Web APIs | MDN"
[2]: https://supabase.com/pricing?utm_source=chatgpt.com "Pricing & Fees | Supabase"
[3]: https://resend.com/pricing/?utm_source=chatgpt.com "Pricing · Resend"
[4]: https://developers.cloudflare.com/pages/platform/limits/?utm_source=chatgpt.com "Limits · Cloudflare Pages docs"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API?utm_source=chatgpt.com "Geolocation API - Web APIs | MDN"
[6]: https://developers.cloudflare.com/r2/pricing/?utm_source=chatgpt.com "Pricing · Cloudflare R2 docs"
[7]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation?utm_source=chatgpt.com "Permissions-Policy: geolocation directive - HTTP | MDN"
[8]: https://playwright.dev/docs/getting-started-mcp?utm_source=chatgpt.com "Playwright MCP | Playwright"
