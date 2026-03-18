import { NextRequest, NextResponse } from "next/server";
import { getUserVouchers } from "@/lib/admin-store";

/** ユーザー本人が自分の振興券一覧を取得。X-User-Id ヘッダで識別 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("X-User-Id") ?? req.nextUrl.searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const vouchers = getUserVouchers(userId);
  return NextResponse.json(vouchers);
}
