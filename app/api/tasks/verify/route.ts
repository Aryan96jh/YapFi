import { NextRequest, NextResponse } from "next/server";
import {
  getUser,
  addLedger,
  genReferralCode,
  countTasks,
  ignoreTask,
  hasTaskBundleAward,
  setReferralCode,
  ignoreReferral,
} from "@/lib/db";
import { REWARDS } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Task completion is self-reported: the user marks each task done after doing
// it on X. No API check (X_BEARER_TOKEN path parked in lib/xverify.ts for later).

const TASKS = ["follow", "like", "retweet"] as const;
type Task = (typeof TASKS)[number];

export async function POST(req: NextRequest) {
  let body: { wallet?: unknown; task?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const task = typeof body.task === "string" ? body.task : "";
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  if (!(TASKS as readonly string[]).includes(task)) {
    return NextResponse.json(
      { error: "task must be one of: follow, like, retweet" },
      { status: 400 }
    );
  }

  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json(
      { error: "unknown wallet — link your X handle first" },
      { status: 404 }
    );
  }

  await ignoreTask(wallet, task as Task);

  const doneCount = await countTasks(wallet);
  const bundleComplete = doneCount >= 3;

  let bundleAwarded = false;
  let referralCode: string | null = user.referral_code;
  if (bundleComplete) {
    const already = await hasTaskBundleAward(wallet);
    if (!already) {
      await addLedger(wallet, REWARDS.TASK_BUNDLE, "task");
      referralCode = await genReferralCode();
      await setReferralCode(wallet, referralCode);
      if (user.referred_by) {
        await addLedger(user.referred_by, REWARDS.REFERRAL_BONUS, "referral");
        await ignoreReferral(user.referred_by, wallet);
      }
      bundleAwarded = true;
    }
  }

  return NextResponse.json({
    verified: true,
    task,
    mode: "self-reported",
    note: "self-reported — complete each task on X, then mark it done.",
    bundleComplete,
    bundleAwarded,
    referralCode,
  });
}
