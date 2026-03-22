"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Waves,
  Bike,
  PersonStanding,
  Activity,
  Settings,
  History,
  Gift,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadUserSettings,
  getLevel,
  getExpInCurrentLevel,
  XP_PER_LEVEL,
  getAgeFromBirthDate,
} from "@/lib/settings";
import { getUserId } from "@/lib/user-id";
import {
  getMobilityDisplays,
  MOBILITY_STALE_DAYS,
  type MobilityDisplay,
} from "@/lib/mobility-profile";

const MOBILITY_MODES = [
  { id: "walk", label: "歩く", icon: PersonStanding, desc: "無理のない歩行で避難" },
  { id: "run", label: "走る", icon: Activity, desc: "駆け足で素早く避難" },
  { id: "bicycle", label: "自転車に乗る", icon: Bike, desc: "自転車で速やかに避難" },
] as const;

function formatLastTrain(iso: string | null) {
  if (!iso) return "最終更新: まだ訓練記録なし";
  return `最終更新: ${new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
}

export default function Home() {
  const [exp, setExp] = useState(0);
  const [voucherTotal, setVoucherTotal] = useState<number | null>(null);
  const [mobilityRows, setMobilityRows] = useState<MobilityDisplay[]>(() => {
    if (typeof window === "undefined") return [];
    const age = getAgeFromBirthDate(loadUserSettings().birthDate ?? "");
    return getMobilityDisplays(age);
  });
  const refreshMobility = useCallback(() => {
    const s = loadUserSettings();
    const age = getAgeFromBirthDate(s.birthDate ?? "");
    setMobilityRows(getMobilityDisplays(age));
  }, []);

  useEffect(() => {
    const s = loadUserSettings();
    setExp(s.exp ?? 0);
  }, []);

  useEffect(() => {
    refreshMobility();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshMobility();
    };
    window.addEventListener("focus", refreshMobility);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refreshMobility);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshMobility]);

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
            <h1 className="text-lg font-semibold text-foreground">ココイコ</h1>
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

        {/* 獲得した地域振興券を使う（QRコード決済で利用可能） */}
        <section>
          <Link href="/vouchers" className="block">
            <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Gift className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">獲得した地域振興券を使う</p>
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
              <CardDescription className="text-foreground/80">
                南海トラフ地震・巨大津波。来ないことを願うだけでは、足りないときがあります。
              </CardDescription>
              <CardTitle className="text-xl leading-snug text-foreground sm:text-2xl">
                あなたができる最善の
                <span className="mt-1 block text-accent">一次避難を、設計しましょう。</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                ここから始めるのは、あなた自身です。歩く・走る・自転車——いまのからだのままで、避難のイメージを少しずつ具体化できます。
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                遅れたと責めるのではなく、一歩ずつを応援するために。スタート地点やあなたの情報は設定から整えられ、迷ったときもこの画面に戻ってこれます。
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>避難訓練の移動手段</CardTitle>
              <CardDescription>
                3つの移動手段それぞれで訓練できます。訓練を終えるたびに、最終更新日が記録されます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-3">
                {MOBILITY_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const row = mobilityRows.find((r) => r.id === mode.id);
                  return (
                    <li key={mode.id}>
                      <div
                        className={cn(
                          "flex h-full flex-col gap-2 rounded-lg border bg-card px-3 py-3 text-left sm:px-4 sm:py-4",
                          row?.isStale
                            ? "border-amber-500/50 ring-1 ring-amber-500/25"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-12">
                            <Icon className="size-5 sm:size-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground">{mode.label}</span>
                            <p className="mt-1 text-xs leading-snug text-muted-foreground">{mode.desc}</p>
                          </div>
                        </div>
                        {row && (
                          <>
                            <p className="text-xs text-muted-foreground">{formatLastTrain(row.lastTrainedAtIso)}</p>
                            {row.isStale && (
                              <p className="flex items-start gap-1 rounded-md bg-amber-500/15 px-2 py-1.5 text-[11px] font-medium text-amber-950 dark:text-amber-100">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                <span>
                                  {!row.lastTrainedAtIso
                                    ? "この手段での訓練がまだありません。"
                                    : `約${MOBILITY_STALE_DAYS}日以上訓練していません${
                                        row.daysSinceTrain != null ? `（最終から${row.daysSinceTrain}日経過）` : ""
                                      }。`}
                                </span>
                              </p>
                            )}
                            <Link
                              href={`/training?region=hamamatsu&mobility=${mode.id}`}
                              className="mt-1 text-center text-xs font-medium text-primary underline-offset-2 hover:underline"
                            >
                              この手段で訓練へ
                            </Link>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                <Link
                  href="/training?region=hamamatsu"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  訓練を行う（浜松ver.）
                </Link>
                <Link
                  href="/training?region=kushimoto"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "w-full border-accent text-accent-foreground hover:bg-accent/10"
                  )}
                >
                  訓練を行う（串本町ver.）
                </Link>
                <Link
                  href="/training?region=umeda"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "w-full border-primary/40 text-foreground hover:bg-primary/10"
                  )}
                >
                  訓練を行う（大阪梅田ver.）
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
