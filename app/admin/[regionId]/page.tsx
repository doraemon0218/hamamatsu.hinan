"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Gift, Filter, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RegionId } from "@/lib/regions";
import { REGIONS } from "@/lib/regions";
import type { SortCriterion } from "@/lib/admin-store";

type SubmittedLog = {
  id: string;
  regionId: string;
  userId: string;
  displayName: string;
  age: number | null;
  startLabel: string;
  destinationName: string;
  targetMinutes: number;
  durationMinutes: number;
  reachedTarget: boolean;
  submittedAt: string;
};

const REGION_IDS: RegionId[] = ["hamamatsu", "kushimoto"];

const SORT_OPTIONS: { value: SortCriterion; label: string }[] = [
  { value: "age_desc", label: "年齢（高齢者優先）" },
  { value: "age_asc", label: "年齢（若年優先）" },
  { value: "start_asc", label: "開始地点（あいうえお順）" },
  { value: "start_desc", label: "開始地点（逆順）" },
  { value: "reachRate_desc", label: "過去の到達率（高い順）" },
  { value: "maxSurplus_desc", label: "余裕（目標時間−所要時間の最大・大きい順）" },
];

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const [regionId, setRegionId] = useState<RegionId>("hamamatsu");
  const [logs, setLogs] = useState<SubmittedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherBudget, setVoucherBudget] = useState("");
  const [voucherPerPerson, setVoucherPerPerson] = useState("");
  const [voucherPriorityLabel, setVoucherPriorityLabel] = useState("");
  const [sortPriority1, setSortPriority1] = useState<SortCriterion | "">("");
  const [sortPriority2, setSortPriority2] = useState<SortCriterion | "">("");
  const [sortPriority3, setSortPriority3] = useState<SortCriterion | "">("");
  const [sortPriority4, setSortPriority4] = useState<SortCriterion | "">("");
  const [voucherSending, setVoucherSending] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [filterDisplayName, setFilterDisplayName] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState("");
  const [filterAgeMax, setFilterAgeMax] = useState("");
  const [filterReached, setFilterReached] = useState<"" | "true" | "false">("");
  const [filterStart, setFilterStart] = useState("");
  const [filterDest, setFilterDest] = useState("");

  useEffect(() => {
    params.then((p) => {
      const id = REGION_IDS.includes(p.regionId as RegionId) ? (p.regionId as RegionId) : "hamamatsu";
      setRegionId(id);
    });
  }, [params]);

  const fetchLogs = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    const q = new URLSearchParams();
    if (filterDisplayName) q.set("displayName", filterDisplayName);
    if (filterAgeMin) q.set("ageMin", filterAgeMin);
    if (filterAgeMax) q.set("ageMax", filterAgeMax);
    if (filterReached) q.set("reachedTarget", filterReached);
    if (filterStart) q.set("startLabel", filterStart);
    if (filterDest) q.set("destinationName", filterDest);
    const res = await fetch(`/api/submit/${regionId}?${q.toString()}`);
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [regionId, filterDisplayName, filterAgeMin, filterAgeMax, filterReached, filterStart, filterDest]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const config = REGIONS[regionId];

  const budgetNum = Number(voucherBudget) || 0;
  const perPersonNum = Number(voucherPerPerson) || 0;
  const recipientCount = perPersonNum > 0 ? Math.floor(budgetNum / perPersonNum) : 0;
  const totalVoucherAmount = recipientCount * perPersonNum;
  const overBudget = totalVoucherAmount > budgetNum && budgetNum > 0;

  const buildSortOrder = (): SortCriterion[] => {
    const order: SortCriterion[] = [];
    for (const v of [sortPriority1, sortPriority2, sortPriority3, sortPriority4]) {
      if (v && order.indexOf(v) === -1) order.push(v);
    }
    return order;
  };

  const buildFilters = () => {
    const f: Record<string, string> = {};
    if (filterDisplayName) f.displayName = filterDisplayName;
    if (filterAgeMin) f.ageMin = filterAgeMin;
    if (filterAgeMax) f.ageMax = filterAgeMax;
    if (filterReached) f.reachedTarget = filterReached;
    if (filterStart) f.startLabel = filterStart;
    if (filterDest) f.destinationName = filterDest;
    return f;
  };

  const handleDistribute = async () => {
    const budget = Number(voucherBudget) || 0;
    const perPerson = Number(voucherPerPerson) || 0;
    if (!budget || !perPerson) {
      setVoucherError("予算と1人あたりの金額を入力してください。");
      return;
    }
    if (recipientCount <= 0) {
      setVoucherError("予算を1人あたりの金額で割った人数が0人です。予算か1人あたりを調整してください。");
      return;
    }
    setVoucherSending(true);
    setVoucherError("");
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId,
          filters: buildFilters(),
          sortOrder: buildSortOrder(),
          budget,
          priorityLabel: voucherPriorityLabel.trim() || "避難訓練参加",
          perPersonAmount: perPerson,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setVoucherError(data.error || "配布に失敗しました");
        return;
      }
      setShowVoucherModal(false);
      setVoucherBudget("");
      setVoucherPerPerson("");
      setVoucherPriorityLabel("");
      setSortPriority1("");
      setSortPriority2("");
      setSortPriority3("");
      setSortPriority4("");
      fetchLogs();
    } catch {
      setVoucherError("通信エラー");
    } finally {
      setVoucherSending(false);
    }
  };

  if (!regionId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="トップへ戻る"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">
            行政ダッシュボード（{config.submitLabel}）
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-4 px-4 py-6 pb-24">
        <p className="text-sm text-muted-foreground">
          {config.submitLabel}に提出された訓練ログ一覧。フィルターで絞り込み、地域振興券の配布ができます。
        </p>

        {/* フィルター */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4" />
              フィルター
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">ユーザー名</Label>
                <Input
                  placeholder="表示名で検索"
                  value={filterDisplayName}
                  onChange={(e) => setFilterDisplayName(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">年齢（以上）</Label>
                <Input
                  type="number"
                  placeholder="例: 20"
                  value={filterAgeMin}
                  onChange={(e) => setFilterAgeMin(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">年齢（以下）</Label>
                <Input
                  type="number"
                  placeholder="例: 65"
                  value={filterAgeMax}
                  onChange={(e) => setFilterAgeMax(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">目標到達</Label>
                <select
                  value={filterReached}
                  onChange={(e) => setFilterReached(e.target.value as "" | "true" | "false")}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">すべて</option>
                  <option value="true">到達した</option>
                  <option value="false">未到達</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">開始地点</Label>
                <Input
                  placeholder="例: 浜松駅"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">目標（避難先）</Label>
                <Input
                  placeholder="避難先名で検索"
                  value={filterDest}
                  onChange={(e) => setFilterDest(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchLogs}>
              再読み込み
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => {
              setVoucherError("");
              setShowVoucherModal(true);
            }}
          >
            <Gift className="mr-2 size-4" />
            地域振興券を配る
          </Button>
        </div>

        {/* 一覧（チェックなし） */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">提出ログ一覧</CardTitle>
            <CardDescription>
              ユーザー名・年齢・開始地点・目標・所要時間・目標時間・到達有無でフィルター可能
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">読み込み中…</p>
            ) : logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">提出ログはまだありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 text-left font-medium">ユーザー名</th>
                    <th className="p-2 text-left font-medium">年齢</th>
                    <th className="p-2 text-left font-medium">開始地点</th>
                    <th className="p-2 text-left font-medium">目標（避難先）</th>
                    <th className="p-2 text-right font-medium">所要時間</th>
                    <th className="p-2 text-right font-medium">目標時間</th>
                    <th className="p-2 text-center font-medium">到達</th>
                    <th className="p-2 text-left font-medium">提出日時</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-2">{row.displayName || "匿名"}</td>
                      <td className="p-2">{row.age != null ? `${row.age}歳` : "—"}</td>
                      <td className="p-2">{row.startLabel}</td>
                      <td className="p-2">{row.destinationName}</td>
                      <td className="p-2 text-right tabular-nums">{row.durationMinutes} 分</td>
                      <td className="p-2 text-right tabular-nums">{row.targetMinutes} 分</td>
                      <td className="p-2 text-center">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs font-medium",
                            row.reachedTarget ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {row.reachedTarget ? "到達" : "未到達"}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {new Date(row.submittedAt).toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 pt-4">
          {REGION_IDS.filter((id) => id !== regionId).map((id) => (
            <Link key={id} href={`/admin/${id}`}>
              <Button variant="outline" size="sm">
                行政ダッシュボード（{REGIONS[id].submitLabel}）
              </Button>
            </Link>
          ))}
        </div>
      </main>

      {/* 地域振興券配布モーダル */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">地域振興券を配布する</CardTitle>
              <button
                type="button"
                onClick={() => !voucherSending && setShowVoucherModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="閉じる"
              >
                <X className="size-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                合計予算と1人あたりの金額を入力すると配布人数が自動で決まります。配布優先順位で複数条件を選ぶと、その順でソートした上位のユーザーに配布します（重複なし）。
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>予算（円）</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="例: 100000"
                    value={voucherBudget}
                    onChange={(e) => setVoucherBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>1人あたりの金額（円）</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="例: 3000"
                    value={voucherPerPerson}
                    onChange={(e) => setVoucherPerPerson(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">配布人数・総額（自動）</p>
                <p className="mt-1 text-muted-foreground">
                  配布人数: <span className="font-medium tabular-nums text-foreground">{recipientCount} 人</span>
                  {perPersonNum > 0 && (
                    <>
                      {" "}
                      総額:{" "}
                      <span className={cn("tabular-nums font-medium", overBudget && "text-destructive")}>
                        {totalVoucherAmount.toLocaleString()} 円
                      </span>
                      {overBudget && "（予算超過）"}
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>配布優先順位（メモ・任意）</Label>
                <Input
                  placeholder="例: 避難訓練参加・目標到達者優先"
                  value={voucherPriorityLabel}
                  onChange={(e) => setVoucherPriorityLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>配布優先順位（ソート条件・複数可）</Label>
                <p className="text-xs text-muted-foreground">
                  上の条件ほど優先。同じ条件は1回だけ使用。現在のフィルター対象のユーザーを、選択した順でソートし、上位から配布します。
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">優先1</span>
                    <select
                      value={sortPriority1}
                      onChange={(e) => setSortPriority1(e.target.value as SortCriterion | "")}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">なし</option>
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">優先2</span>
                    <select
                      value={sortPriority2}
                      onChange={(e) => setSortPriority2(e.target.value as SortCriterion | "")}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">なし</option>
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">優先3</span>
                    <select
                      value={sortPriority3}
                      onChange={(e) => setSortPriority3(e.target.value as SortCriterion | "")}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">なし</option>
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">優先4</span>
                    <select
                      value={sortPriority4}
                      onChange={(e) => setSortPriority4(e.target.value as SortCriterion | "")}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">なし</option>
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {voucherError && (
                <p className="text-sm text-destructive">{voucherError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleDistribute}
                  disabled={voucherSending || recipientCount <= 0 || overBudget}
                >
                  <Send className="mr-2 size-4" />
                  {voucherSending ? "配布中…" : "配布する"}
                </Button>
                <Button variant="outline" onClick={() => setShowVoucherModal(false)} disabled={voucherSending}>
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}