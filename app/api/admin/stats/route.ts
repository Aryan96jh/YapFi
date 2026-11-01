import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminStats } from "@/lib/db";

export const dynamic = "force-dynamic";

// Private admin analytics. Gate: request header `x-admin-key` must equal the
// ADMIN_KEY env var (timing-safe compare). Set ADMIN_KEY in Vercel env, then
// open /admin and enter it. Never log or expose the key.
export async function GET(req: NextRequest) {
  const key = process.env.ADMIN_KEY;
  if (!key) {
    return NextResponse.json({ error: "admin not configured" }, { status: 503 });
  }
  const provided = req.headers.get("x-admin-key") ?? "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(key, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await adminStats());
}
