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
import { verifyXTask } from "@/lib/xverify";

export const dynamic = "force-dynamic";

// TODO(prod): `wallet` is the prototype identity. Production MUST require a
// signed message (e.g. Solana signMessage) to prove wallet ownership.

const TASKS = ["like", "comment", "retweet"] as const;
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
      { error: "task must be one of: like, comment, retweet" },
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

  // Real X verification only when X_BEARER_TOKEN is set; otherwise demo mode.
  let mode: "x-api" | "demo" | "demo-fallback" = "demo";
  let note = "DEMO — self-confirmed. Set X_BEARER_TOKEN for real verification.";
  if (process.env.X_BEARER_TOKEN) {
    const postUrl = process.env.NEXT_PUBLIC_LAUNCH_POST_URL || "";
    const res = await verifyXTask(
      user.x_handle || "",
      task as Task,
      postUrl
    );
    if (res.ok) {
      mode = "x-api";
      note = res.note;
    } else {
      mode = "demo-fallback";
      note = `X API check inconclusive (${res.note}) — demo self-confirm used.`;
    }
  }

  await ignoreTask(wallet, task);

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
    mode,
    note,
    bundleComplete,
    bundleAwarded,
    referralCode,
  });
}
