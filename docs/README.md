# LoveTrack — Documentation Index

Ye `docs/` folder LoveTrack project ka pura documentation hub hai. `project.md` (root me) original spec/brief hai — ye docs usi ko analyze karke, structured aur actionable form me todte hain taaki development ke dauraan reference karna easy ho.

## Files kya kya hain

| File | Kya milega |
|---|---|
| [00-project-state.md](./00-project-state.md) | Abhi project kis stage me hai, kya ban chuka hai, kya baaki hai |
| [01-architecture.md](./01-architecture.md) | System architecture, stack, data flow diagrams |
| [02-database-schema.md](./02-database-schema.md) | Saari tables, columns, relationships, RLS strategy |
| [03-security-anti-fraud.md](./03-security-anti-fraud.md) | Security model, anti-spoofing design, risk scoring |
| [04-phases-and-tasks.md](./04-phases-and-tasks.md) | 12 development phases, har phase ke tasks aur exit criteria |
| [05-hourly-plan.md](./05-hourly-plan.md) | 18-hour hour-by-hour execution timeline |
| [06-testing-plan.md](./06-testing-plan.md) | Unit + Playwright E2E test matrix |
| [07-deployment.md](./07-deployment.md) | Deployment steps, manual actions, ₹0 setup guide |

## Project ek line me

**LoveTrack** = couples/friends ke liye **consent-based** attendance + activity verification PWA. Hidden tracking app nahi — har sharing explicit consent + revoke-anytime control ke saath hoti hai.

## Kaise use karo ye docs

1. Naya session shuru karte time [00-project-state.md](./00-project-state.md) sabse pehle padho — pata chalega abhi kahan ho.
2. Implementation shuru karne se pehle [04-phases-and-tasks.md](./04-phases-and-tasks.md) me current phase dhoondo.
3. Koi security-related decision lena ho to [03-security-anti-fraud.md](./03-security-anti-fraud.md) authoritative source hai.
4. Deployment/env-setup ke time [07-deployment.md](./07-deployment.md) follow karo.

Ye docs project ke saath evolve karne chahiye — jaise-jaise phases complete hote hain, `00-project-state.md` update karte raho.
