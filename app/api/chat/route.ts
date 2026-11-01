import { NextRequest, NextResponse } from "next/server";
import {
  getUser,
  addLedger,
  countTasks,
  countRewardedToday,
  lastRewardedAt,
  recentMessageTexts,
  insertMessage,
} from "@/lib/db";
import {
  REWARDS,
  TIER_REWARD,
  demoVerdict,
  groqVerdict,
  isDuplicate,
  type ChatVerdict,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Identity: the connected Solana wallet's public key (via wallet adapter).
// Future hardening: require a signed message (Solana signMessage) to prove
// wallet ownership before accepting it as an identity.

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

  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json(
      { error: "unknown wallet — connect and link your X handle first" },
      { status: 403 }
    );
  }
  const taskCount = await countTasks(wallet);
  if (taskCount < 3) {
    return NextResponse.json(
      { error: "finish X tasks first" },
      { status: 403 }
    );
  }

  const todayUsed = await countRewardedToday(wallet);

  let verdict: ChatVerdict;
  let reward = 0;
  let note: string | null = null;

  // (b) rate limit: max 1 rewarded message per 2 minutes
  const lastRewarded = await lastRewardedAt(wallet);
  if (
    lastRewarded &&
    Date.now() - Date.parse(lastRewarded) < REWARDS.COOLDOWN_MS
  ) {
    verdict = demoVerdict(message);
    note = "cooldown — next rewarded message available soon";
  } else if (todayUsed >= REWARDS.DAILY_CAP) {
    // (c) daily cap
    verdict = demoVerdict(message);
    note = "daily cap reached (20/20) — come back tomorrow";
  } else {
    // (d) duplicate detection
    const recent = await recentMessageTexts(wallet, 50);
    if (isDuplicate(message, recent)) {
      verdict = demoVerdict(message);
      note = "duplicate message — no points for repeats";
    } else {
      // (e)+(f) classify + score + reply (Groq when keyed, demo otherwise).
      // Pass recent user messages as conversation context (newest last).
      const history = (await recentMessageTexts(wallet, 6)).reverse();
      verdict = process.env.GROQ_API_KEY
        ? await groqVerdict(message, history)
        : demoVerdict(message);
      if (verdict.onTopic && !verdict.injection) {
        reward = TIER_REWARD[verdict.tier] ?? 0;
      }
    }
  }

  // persist the message either way (audit trail)
  await insertMessage(wallet, message, verdict.onTopic, reward, verdict.tier);

  if (reward > 0) {
    await addLedger(wallet, reward, "chat");
    // referrer earns 10% of referee's chat earnings (from referral pool)
    if (user.referred_by) {
      const bonus = Math.floor(reward * REWARDS.REFERRAL_PCT);
      if (bonus > 0) await addLedger(user.referred_by, bonus, "referral");
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
