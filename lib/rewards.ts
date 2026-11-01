import { OFF_TOPIC_REDIRECT, INJECTION_REFUSAL, GREETING_REPLIES, buildSystemPrompt } from "./knowledge";

// Reward constants — MUST match ~/workspace/yapfi/CONCEPT.md
export const REWARDS = {
  TIER_1: 100, // basic on-topic question
  TIER_2: 300, // detailed question
  TIER_3: 1000, // deep / researched question
  TASK_BUNDLE: 5000, // X follow+like+retweet bundle, one-time
  REFERRAL_BONUS: 2500, // per referee completing X tasks
  REFERRAL_PCT: 0.1, // of referee's chat earnings
  DAILY_CAP: 20, // rewarded messages per day
  COOLDOWN_MS: 2 * 60 * 1000, // 1 rewarded message per 2 minutes
} as const;

export const TIER_REWARD: Record<number, number> = {
  1: REWARDS.TIER_1,
  2: REWARDS.TIER_2,
  3: REWARDS.TIER_3,
};

export interface ChatVerdict {
  onTopic: boolean;
  tier: 1 | 2 | 3;
  injection: boolean;
  reply: string;
}

// Keyword tiers for the demo classifier. "like"/"comment"/"retweet" are weak:
// as everyday verbs ("I like turtles") they must not qualify alone, only
// alongside task context ("like the post").
const STRONG_KEYWORDS = [
  "yap", "yapcp", "yapfi", "token", "referral", "refer", "airdrop",
  "tokenomics", "roadmap", "solana", "tge", "dashboard", "leaderboard",
  "vesting", "allocation", "emission", "liquidity", "treasury", "pts",
  "agent", "agents", "ai",
];
const MEDIUM_KEYWORDS = [
  "earn", "earning", "point", "points", "wallet", "claim", "launch",
  "supply", "chat", "chats", "chatting", "message", "task", "tasks", "twitter", "handle",
  "reward", "bonus", "invite", "link", "post", "fee", "price", "vision",
  "future", "scam", "free", "founder", "team",
];
const WEAK_KEYWORDS = ["like", "comment", "retweet"];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|your\s+|these\s+)?instructions/i,
  /disregard\s+(all\s+)?(previous\s+|your\s+|these\s+)?instructions/i,
  /forget\s+(all\s+)?(previous\s+|your\s+)?instructions/i,
  /reveal\s+(your\s+|the\s+)?(system\s+)?prompt/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /\bDAN\b.*mode/i,
  /pretend\s+(you('re| are)|to be)\s+(not|a different|an)/i,
  /developer\s+mode/i,
];

const GREETINGS = new Set([
  "hi", "hello", "hey", "yo", "sup", "gm", "good morning", "good evening",
  "hii", "helloo", "heyy",
]);

export function isInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Whole-word keyword match — avoids substring false positives like
 *  "token" matching "tokens" unintentionally. Pass a keyword list. */
function countHits(text: string, keywords: string[]): number {
  return keywords.filter((k) => {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${esc}\\b`, "i").test(text);
  }).length;
}

/** Near-duplicate check vs recent messages: exact match or very high word overlap. */
export function isDuplicate(text: string, recent: string[]): boolean {
  const n = normalize(text);
  if (n.length === 0) return false;
  const words = new Set(n.split(" ").filter((w) => w.length > 2));
  for (const r of recent) {
    const rn = normalize(r);
    if (rn === n) return true;
    if (rn.length > 0) {
      const rwords = new Set(rn.split(" ").filter((w) => w.length > 2));
      if (words.size > 0 && rwords.size > 0) {
        const inter = Array.from(words).filter((w) => rwords.has(w)).length;
        const sim = inter / Math.max(words.size, rwords.size);
        if (sim > 0.9) return true;
      }
    }
  }
  return false;
}

function isGibberish(text: string): boolean {
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  if (text.trim().length < 4 || letters < 3) return true;
  // one character dominating (e.g. "aaaaaaa", "???????")
  const counts = new Map<string, number>();
  for (const ch of text.toLowerCase()) counts.set(ch, (counts.get(ch) || 0) + 1);
  const top = Math.max(...Array.from(counts.values()));
  return top / text.length > 0.7;
}

export function classifyDemo(text: string): { onTopic: boolean; tier: 1 | 2 | 3 } {
  const n = normalize(text);
  if (GREETINGS.has(n) || isGibberish(n)) return { onTopic: false, tier: 1 };
  const strong = countHits(n, STRONG_KEYWORDS);
  const medium = countHits(n, MEDIUM_KEYWORDS);
  const weak = countHits(n, WEAK_KEYWORDS);
  const onTopic =
    strong >= 1 || medium >= 1 || weak >= 2 || (weak >= 1 && medium >= 1);
  if (!onTopic) return { onTopic: false, tier: 1 };
  const qMarks = (text.match(/\?/g) || []).length;
  const deep = /tokenomics|roadmap|vesting|allocation|supply|emission|liquidity|treasury/i.test(text);
  let tier: 1 | 2 | 3 = 1;
  if (text.length > 150 && (deep || qMarks >= 2)) tier = 3;
  else if (text.length > 60 || deep || /referral|claim|dashboard|task|launch/i.test(text)) tier = 2;
  return { onTopic: true, tier };
}

const CANNED: { pattern: RegExp; replies: string[] }[] = [
  {
    pattern: /what is (yapfi|\$?yapcp)|about (yapfi|\$?yapcp)|explain yapfi/i,
    replies: [
      "YapFi is a chat-to-earn AI wrapper around the $YAPCP token — Ask. Learn. Earn. You connect a Solana wallet, link your X account, finish the follow/like/retweet tasks, then earn points by chatting with me about $YAPCP. Points convert 1:1 to $YAPCP, claimable after launch. What part do you want to dig into?",
      "Think of YapFi as getting paid to learn. It's an AI chat app built around the $YAPCP token: ask me quality questions about the project and earn 100–1,000 points per answer. Those points become $YAPCP 1:1 when the token launches. Curious about the earning tiers or the tokenomics?",
      "YapFi = chat-to-earn for $YAPCP. Connect wallet, do the X tasks, chat with me, refer friends — every step earns points, and points become tokens after launch. It's that loop: the more you yap, the more you earn. Want the full breakdown of how earning works?",
    ],
  },
  {
    pattern: /how (do|can) (i|you|we) earn|how to earn|earning|make money|get points/i,
    replies: [
      "Three ways to earn: (1) Chat — quality questions about $YAPCP earn 100, 300, or 1,000 pts per message depending on depth, up to 20 rewarded messages a day. (2) X tasks — follow, like and retweet for a one-time 5,000 pts. (3) Referrals — 2,500 pts per friend who finishes the tasks, plus 10% of everything they earn chatting.",
      "Earning here is simple: chat with me about $YAPCP (100–1,000 pts per good question, 20 a day max), smash the X task bundle for 5,000 pts one-time, and refer friends for 2,500 pts each plus 10% of their chat earnings forever. Quality beats quantity — one thoughtful question out-earns ten shallow ones.",
      "You've got three income streams: the X tasks pay 5,000 pts once, chatting pays 100/300/1,000 pts per quality message (20/day), and referrals pay 2,500 pts per converted friend plus a 10% cut of their earnings. Which one do you want to start with?",
    ],
  },
  {
    pattern: /referral|refer|invite/i,
    replies: [
      "After you finish the X tasks you get a unique referral link. You earn 2,500 pts for every friend who completes the tasks, plus 10% of everything they earn chatting — paid from a referral pool, never taken from your friend. Referrals are single-level only.",
      "Your referral link unlocks once the X tasks are done. Every friend who joins with it and finishes their tasks nets you 2,500 pts, and then you keep earning 10% of whatever they make chatting — forever, and it never comes out of their pocket. Share it wide.",
    ],
  },
  {
    pattern: /task|like|retweet|follow/i,
    replies: [
      "The X task bundle is: follow the official X handle, like and retweet the launch post, then tap “i did this” on each. All three done = a one-time 5,000 pts bonus, plus chat and your referral link unlock.",
      "Three quick tasks: follow the X handle, like the launch post, retweet it — then mark each “i did this”. That unlocks everything (chat + referrals) and drops 5,000 pts in your balance instantly.",
    ],
  },
  {
    pattern: /claim|launch|tge|when.*(token|live|airdrop)/i,
    replies: [
      "$YAPCP isn't launched yet — no date announced. Right now you earn points at 1 point = 1 $YAPCP, claimable after launch. The claim button on your dashboard stays locked until then; after launch, weekly batch claim settlements. Anyone selling you $YAPCP today is scamming you.",
      "We're pre-launch: no token, no date announced, just points stacking at 1:1 to future $YAPCP. The dashboard claim button unlocks after launch with weekly batch settlements. Stack now while the earning is easy.",
    ],
  },
  {
    pattern: /tokenomics|supply|allocation|how many|distribution/i,
    replies: [
      "$YAPCP is an SPL token on Solana with a total supply of 100,000,000,000 (100B). Example allocation: 40% chat & task rewards, 15% referral pool, 15% liquidity, 15% team (vested), 15% treasury. Chat rewards come from a fixed daily pool (example 30M pts/day in year 1, halving yearly), split pro-rata.",
      "100B total supply on Solana. The split: 40% goes to chat & task rewards (that's your pool), 15% referrals, 15% liquidity, 15% team with vesting, 15% treasury. Daily emissions halve yearly, starting around 30M pts/day — early earners get the fattest share.",
    ],
  },
  {
    pattern: /dashboard/i,
    replies: [
      "Your dashboard shows your total points with the split across chat, tasks, and referrals, today's progress (rewarded messages out of 20), your X task checklist, your referral panel (link, clicks, conversions, earnings), and the claim button — locked until $YAPCP launches.",
      "The dashboard is your mission control: total balance, where it came from (chat/tasks/referrals), today's 20-message progress bar, referral stats, and the claim button waiting for launch day.",
    ],
  },
  {
    pattern: /wallet|solana|connect|phantom|solfare|solflare/i,
    replies: [
      "Connect a Solana wallet to start — Phantom or Solflare, one wallet per account. Your wallet is your identity here; linking your X handle comes next, then the tasks. We never ask for your seed phrase — anyone who does is a scammer.",
      "Tap “connect wallet”, pick Phantom or Solflare, approve in your wallet app. No email, no password — the wallet IS the login, and every point saves to it. Don't have one? Both are free to install.",
    ],
  },
  {
    pattern: /roadmap|v2|future|next|coming soon|plans/i,
    replies: [
      "v1 (live now): landing, wallet connect, X tasks, chat with points, dashboard, referrals. v2 (planned): $YAPCP token launch, claim flow, on-chain referral payouts. v3 (planned): knowledge retrieval, leaderboard, admin panel, advanced anti-fraud. And the big future prospect: Agent Rooms — AI agents debating $YAPCP live while users jump in and earn.",
      "Right now you're in v1. Next up: the $YAPCP launch with claims and on-chain referral payouts (v2), then leaderboards and deeper anti-fraud (v3). The moonshot on the roadmap is Agent Rooms — multiple AI agents with different personas debating live, users voting and earning for participating. Which part excites you most?",
    ],
  },
  {
    pattern: /why.*(yapfi|exist|built|made)|vision|purpose|point of/i,
    replies: [
      "Most launches reward whoever shouts loudest — farmers, bots, hype. The people who actually learn get nothing. YapFi flips that: attention with substance. If you understand $YAPCP well enough to ask good questions, you've earned your allocation. Learning is the proof of work.",
      "The idea is simple: the community that understands the token should be the community that holds it. Instead of airdrops to wallets that dump on day one, YapFi pays people for learning — so launch day holders are believers, not mercenaries.",
    ],
  },
  {
    pattern: /agent/i,
    replies: [
      "Agent Rooms are the big future prospect: live rooms where multiple AI agents — say, the bull, the skeptic, the analyst — debate $YAPCP topics in real time. Users watch, jump into the conversation, vote for the strongest arguments, and earn points for participating. Later: seasonal agent tournaments, and eventually users deploying their own agent personas. Not live yet — it's on the roadmap.",
      "Imagine a live debate stage, but the debaters are AI agents with different takes on $YAPCP, and you earn points for jumping in with the sharpest questions. That's the Agent Rooms vision — agents chatting together, humans in the mix, attention rewarded. Future prospect, not live yet.",
    ],
  },
  {
    pattern: /free|cost|price|pay/i,
    replies: [
      "100% free. Connecting, tasks, chatting, referring — all free. You just need a Solana wallet, which is free to create. If anyone asks you to pay for YapFi or $YAPCP right now, it's a scam.",
    ],
  },
  {
    pattern: /who (built|made|created)|founder|team|behind/i,
    replies: [
      "YapFi is built by an independent builder (Aryan). Small team, big vision: make learning the way people earn their way into token launches. We're not affiliated with X, Phantom, or Solflare.",
    ],
  },
  {
    pattern: /is this (a )?scam|legit|trust|safe/i,
    replies: [
      "Healthy skepticism. Here's the checkable stuff: YapFi never asks for your seed phrase, never asks for money, and there's no token to buy yet — so there's nothing to rug. Points are free rewards for engaging. The code's reward rules are exactly as documented. Always verify, never trust blindly.",
    ],
  },
];

const FALLBACK_REPLIES = [
  "Good question — here's the short version: YapFi pays you in points for engaging with $YAPCP. Chat with me to earn 100–1,000 pts per quality question (20 a day max), finish the X tasks for 5,000 pts, and refer friends for 2,500 pts plus 10% of their chat earnings. Ask me about earning, referrals, tokenomics, or the roadmap.",
  "Here's the deal: everything on YapFi earns. Quality chat messages get 100–1,000 pts (20/day), the X task bundle pays 5,000 pts once, referrals pay 2,500 pts per friend plus 10% of their earnings. Points become $YAPCP 1:1 after launch. What do you want to explore first?",
  "The loop is simple — connect wallet, do the X tasks, chat with me about $YAPCP, refer friends. Every step stacks points, and points convert 1:1 to $YAPCP at launch. Go deeper with me: ask about the tiers, the tokenomics, or where this is all headed.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function cannedReply(text: string): string {
  for (const c of CANNED) {
    if (c.pattern.test(text)) return pick(c.replies);
  }
  return pick(FALLBACK_REPLIES);
}

/** Demo-mode verdict: keyword classifier + varied KB answers. No key needed. */
export function demoVerdict(text: string): ChatVerdict {
  if (isInjection(text)) {
    return { onTopic: false, tier: 1, injection: true, reply: INJECTION_REFUSAL };
  }
  const n = normalize(text);
  if (GREETINGS.has(n)) {
    return { onTopic: false, tier: 1, injection: false, reply: pick(GREETING_REPLIES) };
  }
  const { onTopic, tier } = classifyDemo(text);
  if (!onTopic) {
    return { onTopic: false, tier: 1, injection: false, reply: OFF_TOPIC_REDIRECT };
  }
  return { onTopic: true, tier, injection: false, reply: cannedReply(text) };
}

interface GroqChoice {
  message?: { content?: string };
}
interface GroqResponse {
  choices?: GroqChoice[];
}

/** Groq verdict: one call returns the reply + classification as JSON.
 *  `history` = the user's recent messages (newest last) for conversation context. */
export async function groqVerdict(
  text: string,
  history: string[] = []
): Promise<ChatVerdict> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return demoVerdict(text);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.7,
        max_tokens: 800,
        messages: [
          { role: "system", content: buildSystemPrompt(history) },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const data = (await res.json()) as GroqResponse;
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    // Extract the JSON object (model may wrap it in code fences)
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json in groq reply");
    const parsed = JSON.parse(match[0]) as {
      reply?: string;
      on_topic?: boolean;
      tier?: number;
      injection?: boolean;
    };
    const injection = parsed.injection === true || isInjection(text);
    const onTopic = parsed.on_topic === true && !injection;
    const tier = onTopic && (parsed.tier === 2 || parsed.tier === 3) ? parsed.tier : 1;
    return {
      onTopic,
      tier: tier as 1 | 2 | 3,
      injection,
      reply:
        typeof parsed.reply === "string" && parsed.reply.length > 0
          ? parsed.reply
          : onTopic
            ? cannedReply(text)
            : OFF_TOPIC_REDIRECT,
    };
  } catch {
    // Any Groq failure falls back to demo mode rather than breaking chat.
    return demoVerdict(text);
  }
}
