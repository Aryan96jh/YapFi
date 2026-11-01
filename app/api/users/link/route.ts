import { NextRequest, NextResponse } from "next/server";
import {
  getUserByReferralCode,
  findWalletByHandle,
  upsertUser,
  getUserPublic,
} from "@/lib/db";

export const dynamic = "force-dynamic";

// TODO(prod): `wallet` is the prototype identity. Production MUST require a
// signed message (e.g. Solana signMessage) to prove wallet ownership.

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export async function POST(req: NextRequest) {
  let body: { wallet?: unknown; x_handle?: unknown; referred_by?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  let handle = typeof body.x_handle === "string" ? body.x_handle.trim() : "";
  if (handle.startsWith("@")) handle = handle.slice(1);
  const referredBy =
    typeof body.referred_by === "string" && body.referred_by.trim()
      ? body.referred_by.trim().toUpperCase()
      : null;

  if (!wallet || wallet.length > 64) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json(
      { error: "invalid X handle (letters, numbers, underscore, max 15 chars)" },
      { status: 400 }
    );
  }

  // 1 wallet per X handle
  const clashWallet = await findWalletByHandle(handle);
  if (clashWallet && clashWallet !== wallet) {
    return NextResponse.json(
      { error: "this X handle is already linked to another wallet" },
      { status: 409 }
    );
  }

  // validate referral code
  let referrerWallet: string | null = null;
  if (referredBy) {
    const referrer = await getUserByReferralCode(referredBy);
    if (!referrer) {
      return NextResponse.json({ error: "invalid referral code" }, { status: 400 });
    }
    if (referrer.wallet === wallet) {
      return NextResponse.json(
        { error: "you cannot refer yourself" },
        { status: 400 }
      );
    }
    referrerWallet = referrer.wallet;
  }

  try {
    await upsertUser(wallet, handle, referrerWallet);
  } catch {
    return NextResponse.json(
      { error: "this X handle is already linked to another wallet" },
      { status: 409 }
    );
  }

  const user = await getUserPublic(wallet);
  return NextResponse.json({ ok: true, ...user });
}
