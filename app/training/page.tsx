"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Waves,
  ChevronLeft,
  Clock,
  MapPin,
  PersonStanding,
  Activity,
  Bike,
  Pause,
  Play,
  Square,
  RotateCcw,
  Home,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvacuationSpot } from "@/components/EvacuationMap";
import type { LatLng } from "@/components/RouteMap";

type DrillPhase = "idle" | "running" | "paused" | "ended";

/** 端末に保存する訓練記録 */
export type DrillLog = {
  id: string;
  dateIso: string;
  start: LatLng;
  destination: { name: string; lat: number; lng: number };
  targetMinutes: number;
  remainingSeconds: number;
  /** 計画経路（スタート→避難先） */
  plannedRoute: LatLng[];
  /** GPSで記録した実際の移動軌跡 */
  gpsTrack: LatLng[];
};

const DRILL_LOGS_KEY = "disaster-app-drill-logs";

function loadDrillLogs(): DrillLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRILL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrillLog(log: DrillLog) {
  const logs = loadDrillLogs();
  logs.unshift(log);
  localStorage.setItem(DRILL_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
}

const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((m) => ({ default: m.RouteMap })),
  { ssr: false }
);

const EvacuationMap = dynamic(
  () => import("@/components/EvacuationMap").then((m) => ({ default: m.EvacuationMap })),
  { ssr: false }
);

const TIME_OPTIONS = [
  { id: 3, label: "3分" },
  { id: 5, label: "5分" },
  { id: 10, label: "10分" },
] as const;

const MOBILITY_OPTIONS = [
  { id: "walk", label: "歩く", icon: PersonStanding },
  { id: "run", label: "走る", icon: Activity },
  { id: "bicycle", label: "自転車に乗る", icon: Bike },
] as const;

// 今回の避難訓練のスタート地点：浜松駅（静岡県浜松市）
const HAMAMATSU_STATION = { lat: 34.7034, lng: 137.7343 };

// 浜松駅周辺の実在施設（標高m + 建物高さm を参考に津波避難の最適な順で利用）
// 出典：施設名・座標は公式・公開情報、標高・建物高さは概算
const SPOTS_NEAR_HAMAMATSU_STATION: {
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  buildingHeightM: number;
  estimatedMinutes: number;
  distance: string;
}[] = [
  {
    name: "浜松アクトタワー（津波避難ビル等）",
    lat: 34.705454,
    lng: 137.735687,
    elevationM: 8,
    buildingHeightM: 213,
    estimatedMinutes: 4,
    distance: "約350m",
  },
  {
    name: "浜松城公園（高台）",
    lat: 34.711784,
    lng: 137.724887,
    elevationM: 45,
    buildingHeightM: 0,
    estimatedMinutes: 12,
    distance: "約1.0km",
  },
  {
    name: "浜松駅前ビル",
    lat: 34.7038,
    lng: 137.734,
    elevationM: 8,
    buildingHeightM: 32,
    estimatedMinutes: 2,
    distance: "約100m",
  },
  {
    name: "浜松市役所",
    lat: 34.710896,
    lng: 137.72594,
    elevationM: 12,
    buildingHeightM: 24,
    estimatedMinutes: 10,
    distance: "約0.9km",
  },
  {
    name: "東小学校（津波避難ビル指定想定）",
    lat: 34.711874,
    lng: 137.738015,
    elevationM: 10,
    buildingHeightM: 12,
    estimatedMinutes: 11,
    distance: "約0.9km",
  },
  {
    name: "浜松中部学園（小・中学校）",
    lat: 34.712763,
    lng: 137.722751,
    elevationM: 14,
    buildingHeightM: 15,
    estimatedMinutes: 13,
    distance: "約1.1km",
  },
  {
    name: "双葉小学校",
    lat: 34.700249,
    lng: 137.730388,
    elevationM: 7,
    buildingHeightM: 12,
    estimatedMinutes: 5,
    distance: "約400m",
  },
  {
    name: "西小学校",
    lat: 34.70627,
    lng: 137.72111,
    elevationM: 11,
    buildingHeightM: 12,
    estimatedMinutes: 9,
    distance: "約0.8km",
  },
];

/** 標高+建物高さの大きい順で、避難可能な範囲（時間内）のトップ5を返す */
function getEvacuationSpots(
  timeLimit: number,
  _mobility: string
): EvacuationSpot[] {
  const withTotal = SPOTS_NEAR_HAMAMATSU_STATION.map((s) => ({
    ...s,
    elevationPlusHeightM: s.elevationM + s.buildingHeightM,
  }));
  const sorted = [...withTotal].sort(
    (a, b) => (b.elevationM + b.buildingHeightM) - (a.elevationM + a.buildingHeightM)
  );
  return sorted
    .filter((s) => s.estimatedMinutes <= timeLimit)
    .slice(0, 5)
    .map((s, i) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      estimatedMinutes: s.estimatedMinutes,
      distance: s.distance,
      rank: i + 1,
      elevationPlusHeightM: s.elevationPlusHeightM,
    }));
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrainingPage() {
  const [timeLimit, setTimeLimit] = useState<3 | 5 | 10>(5);
  const [mobility, setMobility] = useState<"walk" | "run" | "bicycle">("walk");
  const [selectedSpotIndex, setSelectedSpotIndex] = useState<number | null>(null);
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  const [drillPhase, setDrillPhase] = useState<DrillPhase>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const drillSpotRef = useRef<EvacuationSpot | null>(null);
  const targetSecondsRef = useRef(0);
  const remainingAtEndRef = useRef(0);
  const gpsTrackRef = useRef<LatLng[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const reflectionLogRef = useRef<DrillLog | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const topFive = useMemo(
    () => getEvacuationSpots(timeLimit, mobility),
    [timeLimit, mobility]
  );

  // 時間・移動手段を変えたら選択をクリア（訓練中でなければ）
  useEffect(() => {
    if (drillPhase === "idle") setSelectedSpotIndex(null);
  }, [timeLimit, mobility, drillPhase]);

  // カウントダウンタイマー
  useEffect(() => {
    if (drillPhase !== "running") return;
    const id = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          setDrillPhase("ended");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [drillPhase]);

  const startDrill = () => {
    setShowReadyConfirm(false);
    if (selectedSpotIndex == null || !topFive[selectedSpotIndex]) return;
    const spot = topFive[selectedSpotIndex];
    const total = spot.estimatedMinutes * 60;
    drillSpotRef.current = spot;
    targetSecondsRef.current = total;
    setSecondsRemaining(total);
    gpsTrackRef.current = [];
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          gpsTrackRef.current.push({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
    setDrillPhase("running");
  };

  const pauseDrill = () => setDrillPhase("paused");
  const resumeDrill = () => setDrillPhase("running");
  const openEndConfirm = () => setShowEndConfirm(true);

  const confirmEndDrill = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    remainingAtEndRef.current = secondsRemaining;
    const spot = drillSpotRef.current;
    if (spot) {
      const log: DrillLog = {
        id: `drill-${Date.now()}`,
        dateIso: new Date().toISOString(),
        start: HAMAMATSU_STATION,
        destination: { name: spot.name, lat: spot.lat, lng: spot.lng },
        targetMinutes: spot.estimatedMinutes,
        remainingSeconds: secondsRemaining,
        plannedRoute: [HAMAMATSU_STATION, { lat: spot.lat, lng: spot.lng }],
        gpsTrack: [...gpsTrackRef.current],
      };
      saveDrillLog(log);
      reflectionLogRef.current = log;
    }
    setShowEndConfirm(false);
    setDrillPhase("idle");
    setShowReflection(true);
  };

  const closeReflection = () => {
    setShowReflection(false);
    setSelectedSpotIndex(null);
    drillSpotRef.current = null;
    reflectionLogRef.current = null;
    setSubmitStatus("idle");
  };

  const submitToHamamatsu = async () => {
    const log = reflectionLogRef.current;
    if (!log) return;
    setSubmitStatus("sending");
    const url = process.env.NEXT_PUBLIC_HAMAMATSU_SUBMIT_URL ?? "";
    try {
      if (url) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log),
        });
        if (!res.ok) throw new Error(res.statusText);
      } else {
        await new Promise((r) => setTimeout(r, 800));
      }
      setSubmitStatus("ok");
    } catch {
      setSubmitStatus("error");
    }
  };

  // 振り返り画面
  if (showReflection && reflectionLogRef.current) {
    const log = reflectionLogRef.current;
    const spot = log.destination;
    const remaining = log.remainingSeconds;

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/90 backdrop-blur">
          <div className="container mx-auto flex items-center gap-2 px-4 py-3">
            <Waves className="size-6 text-primary" aria-hidden />
            <h1 className="text-lg font-semibold text-foreground">避難訓練の振り返り</h1>
          </div>
        </header>
        <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
          <Card>
            <CardHeader>
              <CardTitle>今回の避難訓練の振り返り</CardTitle>
              <CardDescription>
                スタート地点と避難先までの経路、GPSに基づく移動軌跡を表示します。記録は端末に保存されています。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 経路地図：スタート・避難先・計画経路・GPS軌跡 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">経路（スタート → 避難先）</p>
                <RouteMap
                  start={log.start}
                  end={{ lat: spot.lat, lng: spot.lng }}
                  plannedRoute={log.plannedRoute}
                  gpsTrack={log.gpsTrack.length >= 2 ? log.gpsTrack : undefined}
                  height={260}
                />
                <p className="text-xs text-muted-foreground">
                  青＝スタート（浜松駅）　オレンジ＝避難先　青破線＝計画経路　緑＝GPSで記録した移動軌跡
                </p>
              </div>

              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">避難先</dt>
                  <dd className="font-medium text-foreground">{spot.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">目標時間（予測所要時間）</dt>
                  <dd className="font-medium text-foreground">約{log.targetMinutes}分</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">訓練結果</dt>
                  <dd className="font-medium text-foreground">
                    終了時点の残り時間：{formatTime(remaining)}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                本番では、この時間内に避難先へ向かうことを目指しましょう。経路の確認や家族との共有もおすすめです。
              </p>

              {/* 浜松市に提出 */}
              <div className="pt-2 border-t border-border">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={submitToHamamatsu}
                  disabled={submitStatus === "sending"}
                >
                  <Send className="mr-2 size-4" />
                  {submitStatus === "sending"
                    ? "送信中…"
                    : submitStatus === "ok"
                      ? "送信しました"
                      : submitStatus === "error"
                        ? "送信に失敗しました"
                        : "この訓練記録を浜松市に提出する"}
                </Button>
              </div>

              {/* ホームに戻る・もう一度訓練する */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={closeReflection}
                >
                  <RotateCcw className="mr-2 size-4" />
                  もう一度訓練する
                </Button>
                <Link
                  href="/"
                  className={cn(
                    "inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Home className="size-4" />
                  ホームに戻る
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
          <Waves className="size-6 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">
            避難訓練
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        {/* 時間制限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" aria-hidden />
              時間制限
            </CardTitle>
            <CardDescription>
              この時間以内に避難できる地点を推奨します（目安）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  variant={timeLimit === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeLimit(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 移動手段 */}
        <Card>
          <CardHeader>
            <CardTitle>移動手段</CardTitle>
            <CardDescription>
              歩く・走る・自転車のいずれかで、避難可能な地点を表示します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-3 gap-2">
              {MOBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setMobility(opt.id)}
                      className={cn(
                        "flex w-full flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors",
                        mobility === opt.id
                          ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                          : "border-border bg-card hover:bg-muted/50"
                      )}
                    >
                      <Icon className="size-6 text-foreground" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* 避難可能な推奨地点 トップ5 ＋ 地図 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-5" aria-hidden />
              避難可能な推奨地点（トップ5）
            </CardTitle>
            <CardDescription>
              スタート地点は浜松駅。{timeLimit}分以内に{MOBILITY_OPTIONS.find((m) => m.id === mobility)?.label}
              で到達できる範囲のうち、<strong>標高＋建物の高さ</strong>が大きい順にトップ5を表示しています。地図で位置関係を確認できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 地図：現在地と推奨地点を同時表示 */}
            {topFive.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <EvacuationMap
                  currentPosition={HAMAMATSU_STATION}
                  spots={topFive}
                  selectedIndex={selectedSpotIndex}
                  className="w-full"
                />
                <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                  青＝浜松駅（スタート）　オレンジの数字＝推奨地点（標高+建物高さの高い順・タップで強調）
                </p>
              </div>
            )}

            {topFive.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                この時間・移動手段では表示できる地点がありません。時間を延ばすか、別の移動手段を選んでください。
              </p>
            ) : (
              <ol className="space-y-2">
                {topFive.map((spot, index) => (
                  <li key={`${spot.name}-${index}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpotIndex(selectedSpotIndex === index ? null : index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                        selectedSpotIndex === index
                          ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                          : "border-border bg-muted/20 hover:bg-muted/40"
                      )}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{spot.name}</p>
                        <p className="text-xs text-muted-foreground">
                          目安 {spot.estimatedMinutes}分 ・ {spot.distance}
                          {spot.elevationPlusHeightM != null && (
                            <> ・ 標高+建物高さ 約{spot.elevationPlusHeightM}m</>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {/* 選択時：未開始なら開始ボタン、訓練中ならタイマー＋中断/再開/終了 */}
            {selectedSpotIndex != null && topFive[selectedSpotIndex] && drillPhase === "idle" && (
              <div className="rounded-lg border-2 border-accent/50 bg-accent/5 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  選択中の避難先：{topFive[selectedSpotIndex].name}
                </p>
                <p className="text-lg font-semibold text-foreground">
                  予測所要時間：約{topFive[selectedSpotIndex].estimatedMinutes}分
                </p>
                <Button
                  size="lg"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => setShowReadyConfirm(true)}
                >
                  避難訓練を開始する
                </Button>
              </div>
            )}

            {/* 訓練中・一時停止中・時間切れ：カウントダウン＋中断/再開/終了 */}
            {(drillPhase === "running" || drillPhase === "paused" || drillPhase === "ended") && (
              <div className="rounded-lg border-2 border-accent/50 bg-accent/5 p-4 space-y-4">
                <p className="text-sm font-medium text-foreground">
                  避難先：{drillSpotRef.current?.name}
                </p>
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold tabular-nums text-foreground">
                    {formatTime(secondsRemaining)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {drillPhase === "paused"
                      ? "一時停止中"
                      : drillPhase === "ended"
                        ? "時間になりました"
                        : "残り時間"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {drillPhase === "running" && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={pauseDrill}
                    >
                      <Pause className="mr-2 size-4" />
                      中断する
                    </Button>
                  )}
                  {drillPhase === "paused" && (
                    <Button
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={resumeDrill}
                    >
                      <Play className="mr-2 size-4" />
                      再開
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className={drillPhase === "ended" ? "flex-1" : "flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"}
                    onClick={openEndConfirm}
                  >
                    <Square className="mr-2 size-4" />
                    避難訓練終了
                  </Button>
                </div>
              </div>
            )}

            {/* 避難訓練終了の確認 */}
            {showEndConfirm && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-end-title"
              >
                <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
                  <h2 id="confirm-end-title" className="text-lg font-semibold text-foreground">
                    タイマーを停止し訓練を終了しますがよろしいですか？
                  </h2>
                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowEndConfirm(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={confirmEndDrill}
                    >
                      はい
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 準備ができましたか？ 確認 */}
            {showReadyConfirm && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-ready-title"
              >
                <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
                  <h2 id="confirm-ready-title" className="text-lg font-semibold text-foreground">
                    準備ができましたか？
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    避難訓練を開始してよろしければ「開始する」を押してください。
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowReadyConfirm(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={startDrill}
                    >
                      開始する
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              今回の訓練は浜松駅をスタート地点としています。標高・建物高さは参考値です。実際の避難先・指定は浜松市ハザードマップ等でご確認ください。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
