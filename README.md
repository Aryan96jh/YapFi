# YapFi — v1 prototype

**Ask. Learn. Earn.** A chat-to-earn AI wrapper for the **$YAPCP** token
(100,000,000,000 supply, SPL on Solana — pre-launch).

Users connect a wallet → link their X handle → like / comment / retweet the
launch post → chat with a $YAPCP-only AI assistant and earn points per quality
message → refer friends → watch it all on the dashboard. Points convert 1:1 to
$YAPCP, claimable after launch.

Full product spec: [`../CONCEPT.md`](../CONCEPT.md). Brand assets (logo, videos):
[`../assets/`](../assets/).

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, one deployable unit.
API routes included. SQLite via `better-sqlite3` at `data/yapfi.db`, behind
`lib/db.ts` — swap that module for Postgres in production.

## Run it

```bash
npm install
cp .env.example .env   # optional — see below
npm run dev            # http://localhost:3000
npm run build          # must pass with zero errors
npm start
```

## Environment

| Variable | Required | What it does |
|---|---|---|
| `GROQ_API_KEY` | No | Real AI assistant (`llama-3.3-70b-versatile`). Without it, chat runs in **DEMO mode**: keyword topic classifier + canned answers from the built-in knowledge base. |
| `NEXT_PUBLIC_LAUNCH_POST_URL` | No | URL of the official X launch post for the like/comment/retweet tasks. Defaults to `#`. |
| `X_BEARER_TOKEN` | No | Real X API v2 verification of likes/retweets/comments. Without it, task verification is a clearly-labeled **DEMO self-confirm**. |

No secrets are stored in code. `.env` and `data/*.db` are gitignored.

## Demo mode vs real keys

Out of the box (no keys), everything works end to end:
- Wallet = any typed-in address (prototype identity — see TODO in the API
  routes: production must require signed-message auth).
- X handle link = stored as typed (production: X OAuth).
- Task verification = "I've done it" self-confirm, labeled DEMO.
- Chat = keyword classifier (on-topic/off-topic), heuristic quality tiers
  (100 / 300 / 1,000 pts), 2-minute cooldown, 20 rewarded messages/day cap,
  duplicate detection, prompt-injection refusal — all enforced.
- Referrals, dashboard, points ledger all live.

With keys:
- `GROQ_API_KEY` → the assistant answers from the $YAPCP knowledge base and
  returns its own on-topic/tier classification as JSON (falls back to demo
  scoring if the call fails).
- `X_BEARER_TOKEN` → the verify endpoint attempts real X API checks
  (liking_users / retweeted_by / conversation search); on any inconclusive
  result it falls back to labeled demo confirm rather than blocking the user.

## Reward numbers (must match CONCEPT.md)

- Chat: 100 / 300 / 1,000 pts per message by quality tier
- Daily cap: 20 rewarded messages (~20,000 pts/day max), 1 per 2 min cooldown
- X task bundle: 5,000 pts, one-time
- Referral: 2,500 pts per converted referee + 10% of referee chat earnings
- Token: $YAPCP, 100B supply, points 1:1, claimable after launch (claim button
  disabled until then)

## Project structure

```
app/
  page.tsx                 Landing: hero, 5 steps, rewards table, ?r=CODE capture
  app/
    layout.tsx             App shell: nav, logo, wallet bar, demo banner
    chat/page.tsx          Chatbox UI
    tasks/page.tsx         X handle link + 3 task cards + referral link reveal
    dashboard/page.tsx     Balance, split, progress, checklist, referrals, claim
    api/
      chat/route.ts        Reward pipeline: gate → cooldown → cap → dup → classify → score
      users/link/route.ts  Wallet+X handle link (1 wallet per handle), referral attribution
      tasks/verify/route.ts Task verify (+bundle award, referral code, referrer bonus)
      dashboard/route.ts   Full dashboard payload
      referral/route.ts    Referral stats
      referral/click/route.ts Click counting for ?r= links
  components/
    WalletProvider.tsx     Wallet identity via localStorage (prototype)
    WalletBar.tsx          Connect/disconnect UI
  lib/
    db.ts                  better-sqlite3, schema, helpers (swap for Postgres later)
    knowledge.ts           $YAPCP knowledge base + Groq system prompt (CONCEPT.md only)
    rewards.ts             Reward constants, demo classifier/scorer, Groq client
    xverify.ts             Best-effort X API verification
  public/logo.webp         YapFi logo
data/                      SQLite database lives here (gitignored)
```

## Deploy notes (Vercel)

- Works as a standard Next.js app: import the `app/` directory as the project
  root, framework preset Next.js, no custom build command.
- **SQLite does not persist on serverless.** `data/yapfi.db` is ephemeral on
  Vercel — every deploy / cold start can wipe it. For anything beyond a demo,
  swap `lib/db.ts` for Postgres (Neon, Supabase, etc.) and set
  `DATABASE_URL`; the schema is already written as plain SQL.
- Set `GROQ_API_KEY`, `NEXT_PUBLIC_LAUNCH_POST_URL`, and `X_BEARER_TOKEN` in
  the Vercel project environment variables when ready.
