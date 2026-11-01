import { NextRequest, NextResponse } from "next/server";
import { getUser, getSplit, countClicks, countConversions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() || "";
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json({ error: "unknown wallet" }, { status: 404 });
  }

  const clicks = user.referral_code ? await countClicks(user.referral_code) : 0;
  const conversions = await countConversions(wallet);
  const split = await getSplit(wallet);

  return NextResponse.json({
    code: user.referral_code,
    link: user.referral_code
      ? `${req.nextUrl.origin}/?r=${user.referral_code}`
      : null,
    clicks,
    conversions,
    earnings: split.referrals,
  });
}
