# Ledgerly (demo site)

Ledgerly is a **fake bookkeeping/finance SaaS website** built as the controlled experiment target for **LaunchTown** (Push to Prod hackathon). It is not a real product — no backend, no auth, no external APIs.

See the LaunchTown PRD: https://github.com/perfect7613/launchtown/issues/1

## Pages

| Path | Purpose |
|---|---|
| `/` | Homepage — value prop, feature highlights, CTA to `/signup` |
| `/pricing` | Single plan, $29/mo, CTA to `/signup` |
| `/security` | Genuinely convincing security page (SOC 2, encryption, read-only Plaid access, deletion policy, security contact) |
| `/signup` | Signup flow with an **intentional friction flaw**: bank connection is requested at step 1, before account creation or any product value. **Do not fix this** — it is load-bearing for the experiment (Priya's negative memory → Rohan checking `/security` first). |

## Stack & deploy

Plain static HTML/CSS/vanilla JS, `cleanUrls` via `vercel.json`.

```sh
cd ledgerly
vercel --prod   # project: ledgerly-demo
```
