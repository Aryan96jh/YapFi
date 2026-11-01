import { NextRequest, NextResponse } from "next/server";
import { getDb, getUser, addLedger, nowIso } from "@/lib/db";
import {
  REWARDS,
  TIER_REWARD,
  demoVerdict,
  groqVerdict,
  isDuplicate,
  type ChatVerdict,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

// TODO(prod): `wallet` is the prototype identity. Production MUST require a
// signed message (e.g. Solana signMessage) to prove wallet ownership before
// accepting it as an identity.

export async function POST(req: NextRequest) {
  let body: { wallet?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.trim().slice(0, 2000);
  if (!wallet || !message) {
    return NextResponse.json(
      { error: "wallet and message are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const user = getUser(wallet);
  if (!user) {
    return NextResponse.json(
      { error: "unknown wallet — connect and link your X handle first" },
      { status: 403 }
    );
  }
  const taskCount = (
    db
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE user_wallet = ?")
      .get(wallet) as { c: number }
  ).c;
  if (taskCount < 3) {
    return NextResponse.json(
      { error: "finish X tasks first" },
      { status: 403 }
    );
  }

  const todayUsed = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE user_wallet = ? AND reward > 0 AND date(created_at) = date('now')"
      )
      .get(wallet) as { c: number }
  ).c;

  let verdict: ChatVerdict;
  let reward = 0;
  let note: string | null = null;

  // (b) rate limit: max 1 rewarded message per 2 minutes
  const lastRewarded = db
    .prepare(
      "SELECT created_at FROM messages WHERE user_wallet = ? AND reward > 0 ORDER BY id DESC LIMIT 1"
    )
    .get(wallet) as { created_at: string } | undefined;
  if (
    lastRewarded &&
    Date.now() - Date.parse(lastRewarded.created_at) < REWARDS.COOLDOWN_MS
  ) {
    verdict = demoVerdict(message);
    note = "cooldown — next rewarded message available soon";
  } else if (todayUsed >= REWARDS.DAILY_CAP) {
    // (c) daily cap
    verdict = demoVerdict(message);
    note = "daily cap reached (20/20) — come back tomorrow";
  } else {
    // (d) duplicate detection
    const recent = (
      db
        .prepare(
          "SELECT text FROM messages WHERE user_wallet = ? ORDER BY id DESC LIMIT 50"
        )
        .all(wallet) as { text: string }[]
    ).map((r) => r.text);
    if (isDuplicate(message, recent)) {
      verdict = demoVerdict(message);
      note = "duplicate message — no points for repeats";
    } else {
      // (e)+(f) classify + score + reply (Groq when keyed, demo otherwise)
      verdict = process.env.GROQ_API_KEY
        ? await groqVerdict(message)
        : demoVerdict(message);
      if (verdict.onTopic && !verdict.injection) {
        reward = TIER_REWARD[verdict.tier] ?? 0;
      }
    }
  }

  // persist the message either way (audit trail)
  db.prepare(
    "INSERT INTO messages (user_wallet, text, on_topic, reward, tier, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(wallet, message, verdict.onTopic ? 1 : 0, reward, verdict.tier, nowIso());

  if (reward > 0) {
    addLedger(wallet, reward, "chat");
    // referrer earns 10% of referee's chat earnings (from referral pool)
    if (user.referred_by) {
      const bonus = Math.floor(reward * REWARDS.REFERRAL_PCT);
      if (bonus > 0) addLedger(user.referred_by, bonus, "referral");
    }
  }

  return NextResponse.json({
    reply: verdict.reply,
    reward,
    tier: verdict.tier,
    onTopic: verdict.onTopic,
    dailyUsed: todayUsed + (reward > 0 ? 1 : 0),
    dailyCap: REWARDS.DAILY_CAP,
    note,
  });
}
