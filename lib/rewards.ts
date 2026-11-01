import { OFF_TOPIC_REDIRECT, INJECTION_REFUSAL, buildSystemPrompt } from "./knowledge";

// Reward constants — MUST match ~/workspace/yapfi/CONCEPT.md
export const REWARDS = {
  TIER_1: 100, // basic on-topic question
  TIER_2: 300, // detailed question
  TIER_3: 1000, // deep / researched question
  TASK_BUNDLE: 5000, // X like+comment+retweet bundle, one-time
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
];
const MEDIUM_KEYWORDS = [
  "earn", "earning", "point", "points", "wallet", "claim", "launch",
  "supply", "chat", "message", "task", "tasks", "twitter", "handle",
  "reward", "bonus", "invite", "link", "post", "fee", "price",
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

const CANNED: { pattern: RegExp; reply: string }[] = [
  {
    pattern: /what is (yapfi|\$?yapcp)|about (yapfi|\$?yapcp)/i,
    reply:
      "YapFi is a chat-to-earn AI wrapper around the $YAPCP token — tagline: Ask. Learn. Earn. You connect a wallet, link your X account, complete like/comment/retweet tasks on the launch post, then earn points by chatting with me about $YAPCP. Points convert 1:1 to $YAPCP, claimable after launch.",
  },
  {
    pattern: /how (do|can) (i|you|we) earn|how to earn|earning/i,
    reply:
      "Three ways to earn: (1) Chat — ask quality questions about $YAPCP and earn 100, 300, or 1,000 pts per message depending on depth, up to 20 rewarded messages a day. (2) X tasks — like, comment and retweet the launch post for a one-time 5,000 pts. (3) Referrals — 2,500 pts per friend who finishes the tasks, plus 10% of everything they earn chatting.",
  },
  {
    pattern: /referral|refer|invite/i,
    reply:
      "After you finish the X tasks you get a unique referral link. You earn 2,500 pts for every friend who completes the tasks, plus 10% of everything they earn chatting — paid from a referral pool, never taken from your friend. Referrals are single-level only.",
  },
  {
    pattern: /task|like|retweet|comment/i,
    reply:
      "The X task bundle is: Like, Comment, and Retweet the official launch post, then hit Verify on each. Completing all three earns a one-time 5,000 pts bonus and unlocks chat and your referral link.",
  },
  {
    pattern: /claim|launch|tge|when.*(token|live)/i,
    reply:
      "$YAPCP isn't launched yet — right now you earn points, 1 point = 1 $YAPCP, claimable after launch. The claim button on your dashboard is locked until then; after launch there are weekly batch claim settlements.",
  },
  {
    pattern: /tokenomics|supply|allocation|how many/i,
    reply:
      "$YAPCP is an SPL token on Solana with a total supply of 100,000,000,000 (100B). Example allocation: 40% chat & task rewards, 15% referral pool, 15% liquidity, 15% team (vested), 15% treasury. Chat rewards come from a fixed daily pool (example 30M pts/day in year 1, halving yearly), split pro-rata.",
  },
  {
    pattern: /dashboard/i,
    reply:
      "Your dashboard shows your total points balance with a split across chat, tasks, and referrals, today's progress (rewarded messages out of 20), your X task checklist, your referral panel (link, clicks, conversions, earnings), and the claim button — locked until $YAPCP launches.",
  },
  {
    pattern: /wallet|solana|connect/i,
    reply:
      "Connect a Solana wallet to start — one wallet per account. Your wallet is your identity in this prototype; linking your X handle comes next, then the tasks.",
  },
  {
    pattern: /roadmap|v2|future|next/i,
    reply:
      "v1 (this prototype): landing, wallet connect, X tasks, chat with points, dashboard, referrals. v2: $YAPCP token launch, claim flow, on-chain referral payouts. v3: knowledge retrieval, leaderboard, admin panel, advanced anti-fraud.",
  },
];

export function cannedReply(text: string): string {
  for (const c of CANNED) {
    if (c.pattern.test(text)) return c.reply;
  }
  return "Good question — here's the short version: YapFi pays you in points for engaging with $YAPCP. Chat with me to earn 100–1,000 pts per quality question (20 a day max), finish the X tasks for 5,000 pts, and refer friends for 2,500 pts plus 10% of their chat earnings. Ask me about earning, referrals, tokenomics, or the roadmap.";
}

/** Demo-mode verdict: keyword classifier + canned KB answers. No key needed. */
export function demoVerdict(text: string): ChatVerdict {
  if (isInjection(text)) {
    return { onTopic: false, tier: 1, injection: true, reply: INJECTION_REFUSAL };
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

/** Groq verdict: one call returns the reply + classification as JSON. */
export async function groqVerdict(text: string): Promise<ChatVerdict> {
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
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: "system", content: buildSystemPrompt() },
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
