import { NextResponse } from "next/server";
import { foundingSpotsTaken, isFounding100, FOUNDING_CAP, FOUNDING_MULTIPLIER } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: Founding 100 status. ?wallet=… also reports whether that wallet
// holds a founding spot.
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() || "";
  const spotsTaken = await foundingSpotsTaken();
  return NextResponse.json({
    cap: FOUNDING_CAP,
    spotsTaken,
    spotsLeft: Math.max(0, FOUNDING_CAP - spotsTaken),
    multiplier: FOUNDING_MULTIPLIER,
    isFounding: wallet ? await isFounding100(wallet) : false,
  });
}
