"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Waves, Bike, PersonStanding, Activity, Settings, History, Gift, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadUserSettings,
  getLevel,
  getExpInCurrentLevel,
  XP_PER_LEVEL,
} from "@/lib/settings";
import { getUserId } from "@/lib/user-id";

const MOBILITY_MODES = [
  { id: "walk", label: "歩く", icon: PersonStanding, desc: "無理のない歩行で避難" },
  { id: "run", label: "走る", icon: Activity, desc: "駆け足で素早く避難" },
  { id: "bicycle", label: "自転車に乗る", icon: Bike, desc: "自転車で速やかに避難" },
] as const;

export default function Home() {
  const [exp, setExp] = useState(0);
  const [voucherTotal, setVoucherTotal] = useState<number | null>(null);

  useEffect(() => {
    const s = loadUserSettings();
    setExp(s.exp ?? 0);
  }, []);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    fetch("/api/vouchers", { headers: { "X-User-Id": userId } })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const total = data.reduce((s: number, v: { remainingAmount?: number }) => s + (v.remainingAmount ?? 0), 0);
          setVoucherTotal(total);
        }
      })
      .catch(() => {});
  }, []);

  const level = getLevel(exp);
  const expInLevel = getExpInCurrentLevel(exp);
  const xpToNext = XP_PER_LEVEL - expInLevel;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Waves className="size-6 text-primary" aria-hidden />
            <h1 className="text-lg font-semibold text-foreground">
              いっとき避難トレーニング
            </h1>
          </div>
          <Link
            href="/settings"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="設定"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        {/* 現在のレベル・次のレベルまでの必要経験値 */}
        <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">避難レベル</p>
                <p className="text-2xl font-bold text-foreground">Lv.{level}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>次のレベルまで</span>
                  <span className="font-medium tabular-nums">{xpToNext} XP</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${(expInLevel / XP_PER_LEVEL) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {expInLevel} / {XP_PER_LEVEL} XP（現在のレベル内）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 地域振興券フォルダ（QRコード決済で利用可能） */}
        <section>
          <Link href="/vouchers" className="block">
            <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Gift className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">地域振興券</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <QrCode className="size-3.5" aria-hidden />
                    QRコード決済で利用できます
                  </p>
                  {voucherTotal != null && voucherTotal > 0 && (
                    <p className="mt-1 text-sm font-medium text-primary">
                      利用可能 {voucherTotal.toLocaleString()} 円
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground" aria-hidden>→</span>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section>
          <Card className="overflow-hidden border-2 border-accent/40 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>南海トラフ地震・津波に備えて</CardDescription>
              <CardTitle className="text-xl leading-tight text-foreground sm:text-2xl">
                いつか必ず来る。だから今から、
                <span className="mt-1 block text-accent">「一時避難」を身につける</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                歩く・走る・自転車のそれぞれの状態で避難訓練ができます。あなたの情報やスタート地点の登録は設定から行えます。
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>避難訓練の移動手段</CardTitle>
              <CardDescription>
                次の3つの状態それぞれで避難訓練ができます。どれからでも選べます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-3">
                {MOBILITY_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <li key={mode.id}>
                      <div
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-4 text-center"
                        )}
                      >
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="size-6" />
                        </div>
                        <span className="font-medium text-foreground">
                          {mode.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {mode.desc}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
                <Link
                  href="/training?region=hamamatsu"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  訓練を行う（浜松ver.）
                </Link>
                <Link
                  href="/training?region=kushimoto"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "border-accent text-accent-foreground hover:bg-accent/10"
                  )}
                >
                  訓練を行う（串本町ver.）
                </Link>
              </div>
              <div className="flex justify-center pt-3">
                <Link
                  href="/history"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="mr-2 size-4" />
                  過去の訓練記録を見る
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
