import { NextRequest, NextResponse } from "next/server";
import { getUserByReferralCode, insertClick } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  // Only count clicks for codes that actually exist.
  if (!(await getUserByReferralCode(code))) {
    return NextResponse.json({ error: "unknown code" }, { status: 404 });
  }
  await insertClick(code);
  return NextResponse.json({ ok: true });
}
