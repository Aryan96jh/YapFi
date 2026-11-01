import { NextRequest, NextResponse } from "next/server";
import { getDb, getUser, getSplit } from "@/lib/db";

export const dynamic = "force-dynamic";

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
