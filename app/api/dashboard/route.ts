import { NextRequest, NextResponse } from "next/server";
import { getDb, getUser, getBalance, getSplit } from "@/lib/db";
import { REWARDS } from "@/lib/rewards";

export const dynamic = "force-dynamic";

const TASK_TYPES = ["like", "comment", "retweet"];

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() || "";
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  const db = getDb();
  const user = getUser(wallet);
  if (!user) {
    return NextResponse.json({ error: "unknown wallet" }, { status: 404 });
  }

  const doneTasks = (
    db
      .prepare("SELECT task_type FROM tasks WHERE user_wallet = ?")
      .all(wallet) as { task_type: string }[]
  ).map((r) => r.task_type);
  const tasks: Record<string, boolean> = {};
  for (const t of TASK_TYPES) tasks[t] = doneTasks.includes(t);

  const todayUsed = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE user_wallet = ? AND reward > 0 AND date(created_at) = date('now')"
      )
      .get(wallet) as { c: number }
  ).c;

  const clicks = user.referral_code
    ? (
        db
          .prepare("SELECT COUNT(*) AS c FROM referral_clicks WHERE code = ?")
          .get(user.referral_code) as { c: number }
      ).c
    : 0;
  const conversions = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM referrals WHERE referrer_wallet = ? AND converted_at IS NOT NULL"
      )
      .get(wallet) as { c: number }
  ).c;

  const split = getSplit(wallet);
  const link = user.referral_code
    ? `${req.nextUrl.origin}/?r=${user.referral_code}`
    : null;

  return NextResponse.json({
    wallet,
    x_handle: user.x_handle,
    balance: getBalance(wallet),
    split: { chat: split.chat, tasks: split.tasks, referrals: split.referrals },
    tasks: { ...tasks, allDone: TASK_TYPES.every((t) => tasks[t]) },
    referral: {
      code: user.referral_code,
      link,
      clicks,
      conversions,
      earnings: split.referrals,
    },
    daily: { used: todayUsed, cap: REWARDS.DAILY_CAP },
    claimOpen: false,
  });
}
