import { NextRequest, NextResponse } from "next/server";
import {
  getUser,
  getBalance,
  getSplit,
  taskTypes,
  countRewardedToday,
  countClicks,
  countConversions,
} from "@/lib/db";
import { REWARDS } from "@/lib/rewards";

export const dynamic = "force-dynamic";

const TASK_TYPES = ["like", "comment", "retweet"];

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() || "";
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json({ error: "unknown wallet" }, { status: 404 });
  }

  const doneTasks = await taskTypes(wallet);
  const tasks: Record<string, boolean> = {};
  for (const t of TASK_TYPES) tasks[t] = doneTasks.includes(t);

  const todayUsed = await countRewardedToday(wallet);

  const clicks = user.referral_code ? await countClicks(user.referral_code) : 0;
  const conversions = await countConversions(wallet);

  const split = await getSplit(wallet);
  const link = user.referral_code
    ? `${req.nextUrl.origin}/?r=${user.referral_code}`
    : null;

  return NextResponse.json({
    wallet,
    x_handle: user.x_handle,
    balance: await getBalance(wallet),
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
