# YapFi — Ask. Learn. Earn.

> A **chat-to-earn AI wrapper** for the **$YAPCP** token. Chat with a project-only AI assistant, complete X engagement tasks, refer friends, and earn points convertible **1:1 to $YAPCP** at launch.

**Token:** $YAPCP · **Supply:** 100,000,000,000 · **Chain:** Solana (SPL) · **Phase:** Pre-launch (points now, claimable after TGE)

---

## What is YapFi?

YapFi turns community engagement into a game. Instead of airdropping tokens to mercenaries, it pays real users for learning about the project:

1. **Connect** a Solana wallet
2. **Link** your X (Twitter) account
3. **Engage** — like, comment, and retweet the official launch post (verified)
4. **Chat** with the $YAPCP AI assistant — it answers *only* project questions
5. **Refer** friends with your personal link and earn a cut of everything they earn
6. **Watch** your points grow on the dashboard, then **claim $YAPCP** after launch

The more you yap, the more you earn. Quality questions earn more than spam.

## Earning

| Action | Reward |
|---|---|
| Good question in chat | 100 pts |
| Detailed question | 300 pts |
| Deep / researched question | 1,000 pts |
| X task bundle (like + comment + retweet) | 5,000 pts (one-time) |
| Referral converts (finishes X tasks) | 2,500 pts |
| Referral chat earnings | 10% to referrer, forever |

**Limits that keep it fair:** 1 rewarded message per 2 minutes · 20 rewarded messages/day (~20,000 pts/day max) · 1 wallet per X account · off-topic messages earn nothing · chat rewards paid from a fixed daily pool (30M pts/day, halving yearly), so inflation can't spiral no matter how many users join.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind CSS — one deployable unit
- **Database:** SQLite (`better-sqlite3`) behind `lib/db.ts` — swap the module for Postgres in production
- **AI:** Groq (`llama-3.3-70b-versatile`) with the $YAPCP knowledge base, or built-in demo mode with zero keys
- **X verification:** X API v2 when `X_BEARER_TOKEN` is set, labeled demo self-confirm otherwise
- **Chain:** Solana (SPL $YAPCP at launch; prototype identity is the wallet address)

## Quickstart

```bash
npm install
cp .env.example .env   # optional — see Configuration
npm run dev            # http://localhost:3000
```

`npm run build` must pass with zero errors before deploying.

## Configuration

| Variable | Required | What it does |
|---|---|---|
| `GROQ_API_KEY` | No | Real AI assistant. Without it, chat runs in **demo mode**: keyword topic classifier + canned answers from the built-in $YAPCP knowledge base. |
| `NEXT_PUBLIC_LAUNCH_POST_URL` | No | URL of the official X launch post for the engagement tasks. Defaults to `#`. |
| `X_BEARER_TOKEN` | No | Real X API v2 verification of likes / retweets / comments. Without it, verification is a clearly-labeled demo self-confirm. |

No secrets are committed — `.env` and `data/*.db` are gitignored.

## Demo mode vs production

Out of the box (no keys), the full loop works end to end: wallet identity, X handle link, task verification, quality-tiered chat rewards with all anti-abuse guards, referrals, points ledger, dashboard. Add keys to graduate each piece to production behavior — the app detects what's configured and labels demo surfaces in the UI.

> **Prototype notes:** wallet identity is a typed-in address (production must require signed-message auth — see the TODOs in the API routes). X handle linking is stored as typed (production: X OAuth).

## Project structure

```
app/
  page.tsx               Landing: hero, 5 steps, rewards table, ?r=CODE capture
  app/
    chat/page.tsx        Chatbox UI
    tasks/page.tsx       X handle link + task cards + referral link reveal
    dashboard/page.tsx   Balance, split, progress, checklist, referrals, claim
    layout.tsx           App shell: nav, logo, wallet bar, demo banner
  api/
    chat/route.ts        Reward pipeline: gate → cooldown → cap → dup → classify → score
    users/link/route.ts  Wallet + X handle link (1 wallet per handle), referral attribution
    tasks/verify/route.ts Task verification (+ bundle award, referral code, referrer bonus)
    dashboard/route.ts   Full dashboard payload
    referral/route.ts    Referral stats (+ click counting)
lib/
  db.ts                  SQLite schema + helpers (swap for Postgres later)
  knowledge.ts           $YAPCP knowledge base + Groq system prompt
  rewards.ts             Reward constants, demo classifier/scorer, Groq client
  xverify.ts             Best-effort X API verification
public/logo.svg          YapFi mark (vector)
```

## Tokenomics — $YAPCP

**100,000,000,000** total supply (example allocation, tunable):

| Allocation | Share | Amount |
|---|---|---|
| Chat & task rewards | 40% | 40B |
| Referral pool | 15% | 15B |
| Liquidity | 15% | 15B |
| Team (vested) | 15% | 15B |
| Treasury / partnerships | 15% | 15B |

Pre-launch, users earn **points 1:1** to future $YAPCP. The claim window opens in the dashboard at TGE, followed by weekly batch settlements.

## Roadmap

- **v1** — this repo: full chat-to-earn loop on points ✅
- **v2** — $YAPCP SPL launch (100B), on-chain claim flow, referral payouts on-chain
- **v3** — RAG knowledge base, referral leaderboard + seasons, admin / moderation panel, advanced anti-fraud

## Deploy

Vercel-ready: import the repo, framework preset **Next.js**, root directory as-is, no build overrides.

**Database (required):** Vercel's serverless filesystem is read-only, so the app needs Postgres in production — set `DATABASE_URL` in the Vercel project settings (Environment Variables). Free options: [Neon](https://neon.tech) or [Supabase](https://supabase.com) — create a project, copy the connection string, paste it as `DATABASE_URL`, redeploy. The schema is created automatically on first request. Locally, with `DATABASE_URL` unset, the app uses SQLite (`data/yapfi.db`, gitignored) with zero config.

Optional: `GROQ_API_KEY` (real AI answers), `NEXT_PUBLIC_LAUNCH_POST_URL` (the X post for the engagement tasks), `X_BEARER_TOKEN` (real X verification). Without them the app runs in clearly-labeled demo mode.

## Concept & brand

- Product spec: [`../CONCEPT.md`](../CONCEPT.md) (local workspace copy)
- Logo, intro + explainer videos: [`../assets/`](../assets/) (local workspace copy)

## License

MIT — do what you want, attribution appreciated.
