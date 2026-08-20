# Database Schema (Supabase PostgreSQL)

## Tables overview

```text
users / profiles
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

Sab tables me **UUID primary keys** use karo jahan appropriate ho.

## Key tables (detail)

### `attendance`

```text
id
user_id
attendance_date
check_in_at
check_out_at
status
check_in_id            -- FK to attendance_verifications
check_out_id           -- FK to attendance_verifications
created_at
updated_at
```

### `attendance_verifications`

```text
id
attendance_id
type                    -- 'check_in' | 'check_out' | 'lunch_start' | 'lunch_end'
nonce_hash
server_timestamp        -- authoritative, never client time
latitude
longitude
accuracy
ip_hash
device_id
risk_score
verification_status     -- PASS | SUSPICIOUS | REJECTED
failure_reason
created_at
```

### `pairs`

```text
id
requester_id
receiver_id
status                  -- PENDING | ACCEPTED | REJECTED | REVOKED
created_at
accepted_at
revoked_at
```

### `pair_permissions`

Per-pair, granular sharing controls (location on/off, activity timeline on/off, etc.) — user dono side se control kar sake.

### `devices` (`user_device`)

```text
id
user_id
public_key       -- WebCrypto device key (private key never leaves device)
browser
os
created_at
last_seen
trusted
revoked
```

### `lunch_sessions` / `lunch_proofs`

Lunch start/end timestamps + associated video proof metadata (R2 path, duration, challenge phrase shown, verification status). Video content **kabhi bhi Supabase storage me nahi** — sirf R2, path yahan reference hota hai.

### `leave_requests`

```text
id
user_id
leave_date
reason              -- mandatory, non-empty
status              -- PENDING | APPROVED | REJECTED
created_at
reviewed_by
reviewed_at
```

### `notifications` / `email_logs`

User-facing notifications aur email delivery tracking — duplicate reminders avoid karne ke liye log check hota hai.

### `audit_logs`

Har sensitive admin action (suspend user, revoke device, revoke pair, approve leave, change settings) yahan record hoti hai — kaun, kab, kya.

### `risk_events`

Har suspicious signal (bad accuracy, IP mismatch, timezone mismatch, impossible movement, device change) individually logged, taaki risk score explainable rahe.

### `system_settings`

Configurable thresholds — location accuracy limits, max fix age, plausible-speed limit, risk score bands, reminder schedule — hardcoded nahi, DB-driven. (Geofence radius **nahi** hai — koi fixed location restriction nahi.)

## Indexes (mandatory)

- `user_id` (har user-scoped table par)
- `attendance_date`
- `created_at`
- pair relationship columns (`requester_id`, `receiver_id`)
- `status` columns
- `risk_events` par user_id + created_at composite

## Row Level Security (RLS) — non-negotiable rules

```text
User A
   ↓ can read/write
   own data only

Partner A (paired + permission granted)
   ↓ can read
   Partner B's explicitly shared data only

Admin (role = admin, server-verified)
   ↓ full access, but every action audit-logged
```

Explicit denials:

```text
User A   ❌ cannot update User B's attendance
Partner A ❌ cannot access User B's private media without permission
Normal user ❌ cannot access admin tables
```

**Frontend role checks kabhi bhi sufficient nahi hain** — admin authorization hamesha server-side (RLS + server function check) verify hoti hai.

## Media path convention (R2, DB se linked)

```text
users/{userId}/attendance/{attendanceId}/checkin/{uuid}.webp
users/{userId}/attendance/{attendanceId}/checkout/{uuid}.webp
users/{userId}/attendance/{attendanceId}/lunch/{uuid}.webm
```

DB me sirf path/metadata store hota hai — actual binary R2 me, bucket private, access sirf short-lived signed URL (~5 min expiry) se.
