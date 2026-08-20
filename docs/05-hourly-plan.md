# 18-Hour Execution Timeline

Ye hourly breakdown [04-phases-and-tasks.md](./04-phases-and-tasks.md) ke 12 phases ko time-boxed slots me maps karta hai. Realistic goal: **18 hours me "very strong MVP"** — enterprise-grade production nahi.

| Hour | Phase | Focus |
|---|---|---|
| 0–1 | Phase 1 | Architecture, repo, Next.js, environment setup |
| 1–3 | Phase 2 | Auth, database, roles, RLS, profile |
| 3–6 | Phase 3 + 4 | Pairing, dashboard, camera, location, check-in/out, server timestamps |
| 6–8 | Phase 5 | Lunch flow, MediaRecorder, R2, signed URLs |
| 8–10 | Phase 6 | Leave, reminders, Resend email integration |
| 10–12 | Phase 8 | Admin dashboard — users, attendance, leaves, audit |
| 12–14 | Phase 10 | Theme, motion, responsive design, PWA |
| 14–16 | Phase 9 | Security hardening, rate limiting, risk engine, permissions |
| 16–17 | Phase 11 | Playwright tests, critical flows, mobile tests, accessibility |
| 17–18 | Phase 12 | Production deploy, GitHub, README, .env docs, smoke testing, final fixes |

Note: Phase 7 (Partner activity) is naturally interleaved during Hour 3–8 window since it shares data with attendance/pairing — timeline me explicit slot Phase 3+4 ke saath cover ho jaata hai in practice; agar time bache to Hour 8-10 ke baad standalone polish milta hai.

## Milestone reporting format

Har phase complete hone par is format me summary do (Hinglish me):

```text
PHASE COMPLETE
What I built:
What I tested:
What remains:
Manual action required:
```

## Time pressure principles

Jab bhi "perfect but slow" vs "secure, maintainable and working" ka choice aaye — **doosra choose karo**. Over-engineering avoid karo:

```text
❌ microservices
❌ Kubernetes
❌ Redis
❌ GraphQL
❌ complex/paid AI APIs
❌ large third-party dependencies
❌ AI face recognition / deepfake detection
❌ native Android/iOS app
❌ WebRTC location stream
❌ custom map backend
❌ biometric auth
❌ real-time 1-second location engine
```

Priority order jab time kam pade: **security > privacy > correctness > mobile UX > working core flows** — sabse pehle inhe protect karo, baaki polish baad me.
