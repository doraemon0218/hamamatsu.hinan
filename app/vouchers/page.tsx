"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Gift, QrCode } from "lucide-react";
import { getUserId } from "@/lib/user-id";

type Voucher = {
  id: string;
  userId: string;
  regionId: string;
  campaignId: string;
  amount: number;
  distributedAt: string;
  remainingAmount: number;
};

const REGION_LABELS: Record<string, string> = {
  hamamatsu: "浜松市",
  kushimoto: "串本町",
};

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch("/api/vouchers", {
      headers: { "X-User-Id": userId },
    })
      .then((res) => res.json())
      .then((data) => {
        setVouchers(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalRemaining = vouchers.reduce((s, v) => s + v.remainingAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="ホームへ戻る"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Gift className="size-6 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">地域振興券</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <QrCode className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">利用可能残高</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalRemaining.toLocaleString()} 円
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  QRコード決済で利用できます
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>受け取った地域振興券</CardTitle>
            <CardDescription>
              自治体から配布された地域振興券です。加盟店でQRコード決済に利用できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">読み込み中…</p>
            ) : vouchers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                届いた地域振興券はありません。訓練記録を自治体に提出すると、配布対象になることがあります。
              </p>
            ) : (
              <ul className="space-y-3">
                {vouchers.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {REGION_LABELS[v.regionId] ?? v.regionId} 配布
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.distributedAt).toLocaleDateString("ja-JP")} 配布
                      </p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {v.remainingAmount.toLocaleString()} 円
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          加盟店のレジで「地域振興券で支払い」を選択し、画面に表示されるQRコードを提示してください。
        </p>
      </main>
    </div>
  );
}
