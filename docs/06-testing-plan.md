# Testing Plan

## Setup

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Ye official Playwright MCP setup command hai — isse Claude Code directly browser open karke real interactions kar sakta hai, sirf test-code likhna nahi.

Instruction jo dena hai:

```text
Use Playwright MCP aggressively during implementation.
Do not just write tests. Actually open the running LoveTrack
application and interact with it.

Validate: mobile layout, camera flow UI, location states,
disabled states, error messages, loading states, admin
navigation, partner activity, accessibility, visual consistency.

When something looks wrong, fix the implementation and retest.
```

## Unit tests (Vitest)

- [ ] Location validation rules (accuracy limit, stale-fix rejection, plausible-speed, zero-drift detection)
- [ ] Haversine distance + implied-speed calculation
- [ ] Risk score computation
- [ ] Nonce validation (fresh/expired/reused)
- [ ] Attendance state machine transitions
- [ ] Leave validation (mandatory reason etc.)
- [ ] Pairing permission checks
- [ ] Reminder eligibility logic

## E2E flows (Playwright — 26 flows)

1. Registration
2. Login
3. Logout
4. Forgot password flow
5. Pair request
6. Pair acceptance
7. Revoke pairing
8. Check-in
9. Gallery/file upload unavailable for attendance (negative test)
10. Location permission denied
11. Bad accuracy → rejected/flagged
12. Stale/cached location fix → rejected (check-in from any place is allowed; only fake/inaccurate readings are not)
13. Duplicate submission → rejected
14. Replay nonce → rejected
15. Lunch recording
16. Lunch upload
17. Leave request
18. Missing-attendance reminder
19. Partner activity view
20. Admin login
21. Admin attendance view
22. Suspicious activity flagging
23. Signed media URL access
24. Unauthorized media access (negative test)
25. Mobile viewport rendering
26. Keyboard navigation

## Attendance state machine (for reference during testing)

```text
NONE
 → CHECKIN_PENDING
 → CHECKED_IN
 → LUNCH_ACTIVE
 → LUNCH_VERIFIED
 → CHECKED_OUT
```

Invalid transitions jo explicitly block honi chahiye:

```text
❌ duplicate check-in
❌ checkout before check-in (unless explicitly configured otherwise)
❌ multiple lunch sessions
❌ lunch proof without active lunch session
❌ multiple checkout
```

## Accessibility checklist

```text
✅ keyboard navigation
✅ focus visible
✅ button labels / accessible names
✅ ARIA where needed
✅ contrast ratio
✅ screen reader semantics
✅ form error messages announced
✅ prefers-reduced-motion respected
✅ minimum touch target size
```

## Pre-milestone gate

Har phase "complete" call karne se pehle ye sab run + pass hone chahiye:

```text
lint
typecheck
unit tests
e2e tests (relevant flows)
build
```

Failures ko fix kiye bina milestone complete mat maano.
