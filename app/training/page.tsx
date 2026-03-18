"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { addExp } from "@/lib/settings";
import { getRegion, type SpotSource } from "@/lib/regions";
import { loadLikedLogIds, saveLikedLogIds } from "@/lib/liked-logs";
import type { EvacuationSpot } from "@/components/EvacuationMap";
import { fetchWalkingRouteVia, type LatLng } from "@/lib/route-api";

type DrillPhase = "idle" | "running" | "paused" | "ended";

/** GPS 1点（時刻付き：信憑性評価用） */
export type GpsPoint = { lat: number; lng: number; atMs: number };

/** 一時停止・再開イベント（実時刻で記録） */
export type PhaseEvent = { atMs: number; phase: "paused" | "running" };

/** 訓練データの信憑性評価結果 */
export type DrillCredibility = {
  /** 0〜1。1に近いほど計測が停止中を含まず一貫している */
  score: number;
  /** 表示用ラベル */
  label: "信頼できる" | "要確認" | "評価不可";
  /** タイマーが動いていた時間（秒）。一時停止中は含まない */
  activeSeconds: number;
  /** 開始から終了までの実経過時間（秒） */
  totalRealSeconds: number;
  /** 一時停止があったか */
  hadPause: boolean;
  /** 全GPS軌跡の累計移動距離（m） */
  movementDistanceM: number;
  /** スタート→目的地の直線距離（m） */
  straightLineDistanceM: number;
  /** 一時停止中を除く「計測有効時間内」の移動距離（m） */
  activeMovementDistanceM: number;
  /** 補足説明 */
  note?: string;
};

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
  /** GPSで記録した実際の移動軌跡（時刻付きで信憑性評価に利用） */
  gpsTrack: (LatLng | GpsPoint)[];
  /** 訓練開始の実時刻（ms）。信憑性評価用 */
  startedAtMs?: number;
  /** 一時停止・再開の実時刻。信憑性評価用 */
  phaseEvents?: PhaseEvent[];
  /** 信憑性評価結果（保存時に算出） */
  credibility?: DrillCredibility;
  /** 地域ID（浜松・串本町など。履歴表示でスタート表示名に利用） */
  regionId?: string;
};

const DRILL_LOGS_KEY_PREFIX = "disaster-app-drill-logs-";
const DRILL_LOGS_KEY_LEGACY = "disaster-app-drill-logs";
const SUBMITTED_LOG_IDS_KEY = "disaster-app-submitted-log-ids";

function getDrillLogsKey(regionId: string): string {
  return `${DRILL_LOGS_KEY_PREFIX}${regionId}`;
}

/** スタート座標から地域を推定（regionId がない古いログ用）。串本町は北緯33°台、浜松は34°台 */
function inferRegionIdFromStart(start: { lat: number; lng: number }): "hamamatsu" | "kushimoto" {
  if (start.lat < 34) return "kushimoto";
  return "hamamatsu";
}

/** ログの地域IDを決定（保存済みならそのまま、未設定ならスタート座標から推定） */
function resolveRegionId(log: DrillLog): "hamamatsu" | "kushimoto" {
  if (log.regionId === "kushimoto" || log.regionId === "hamamatsu") return log.regionId;
  return inferRegionIdFromStart(log.start);
}

function loadSubmittedLogIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SUBMITTED_LOG_IDS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveSubmittedLogIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUBMITTED_LOG_IDS_KEY, JSON.stringify([...ids]));
  } catch {}
}

/** 2点間の直線距離（m）Haversine簡易版 */
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** 軌跡の累計移動距離（m） */
function trackDistanceM(points: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineM(points[i - 1], points[i]);
  }
  return d;
}

/** 信憑性評価を算出。startedAtMs / phaseEvents / 時刻付きgpsTrack がある場合のみ有効 */
function computeCredibility(
  log: Pick<DrillLog, "start" | "destination" | "gpsTrack" | "startedAtMs" | "phaseEvents">
): DrillCredibility | undefined {
  const started = log.startedAtMs;
  const events = log.phaseEvents ?? [];
  const track = log.gpsTrack;
  if (started == null || track.length < 2) {
    return undefined;
  }
  const hasTimestamps = track.every((p): p is GpsPoint => "atMs" in p && typeof (p as GpsPoint).atMs === "number");
  if (!hasTimestamps) {
    return undefined;
  }

  const endMs = (track as GpsPoint[]).reduce((max, p) => Math.max(max, p.atMs), started);
  const totalRealSeconds = (endMs - started) / 1000;

  // アクティブ（running）区間 [startMs, endMs)[]
  const activeRanges: [number, number][] = [];
  let rangeStart = started;
  for (const e of events) {
    if (e.phase === "paused") {
      activeRanges.push([rangeStart, e.atMs]);
    } else {
      rangeStart = e.atMs;
    }
  }
  activeRanges.push([rangeStart, endMs]);

  const activeSeconds = activeRanges.reduce((sum, [s, e]) => sum + (e - s) / 1000, 0);
  const hadPause = events.some((e) => e.phase === "paused");

  const isInActiveRange = (atMs: number) =>
    activeRanges.some(([s, e]) => atMs >= s && atMs <= e);
  const activePoints = (track as GpsPoint[]).filter((p) => isInActiveRange(p.atMs));
  const activeMovementDistanceM = activePoints.length >= 2 ? trackDistanceM(activePoints) : 0;
  const movementDistanceM = trackDistanceM(track);

  const dest = log.destination;
  const straightLineDistanceM = haversineM(log.start, { lat: dest.lat, lng: dest.lng });

  let score = 1;
  let label: DrillCredibility["label"] = "信頼できる";
  let note: string | undefined;

  if (hadPause) {
    score = Math.min(score, 0.6);
    label = "要確認";
    note = "計測中に一時停止があります。停止中の移動はタイマーに含まれません。";
  }
  const activeRatio = totalRealSeconds > 0 ? activeSeconds / totalRealSeconds : 0;
  if (activeRatio < 0.95 && !hadPause) {
    score = Math.min(score, 0.8);
  }
  if (activeRatio < 0.8) {
    score = Math.min(score, 0.5);
    if (label === "信頼できる") label = "要確認";
  }
  if (activeMovementDistanceM < straightLineDistanceM * 0.1 && straightLineDistanceM > 50) {
    score = Math.min(score, 0.4);
    label = "要確認";
    note = (note ? note + " " : "") + "有効計測時間中の移動距離が極端に短いです。";
  }

  if (score < 0.5) label = "要確認";
  if (totalRealSeconds < 10 && straightLineDistanceM > 100) {
    score = Math.min(score, 0.3);
    note = (note ? note + " " : "") + "実時間が短い一方で距離が長く、計測の整合性に注意が必要です。";
  }

  return {
    score,
    label,
    activeSeconds,
    totalRealSeconds,
    hadPause,
    movementDistanceM,
    straightLineDistanceM,
    activeMovementDistanceM,
    note,
  };
}

/** 旧キーから地域別キーへ1回だけ移行 */
function migrateDrillLogsFromLegacy() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DRILL_LOGS_KEY_LEGACY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr) || arr.length === 0) {
      localStorage.removeItem(DRILL_LOGS_KEY_LEGACY);
      return;
    }
    const byRegion: Record<string, DrillLog[]> = {};
    for (const item of arr) {
      const log = item as DrillLog;
      const rid = resolveRegionId(log);
      if (!byRegion[rid]) byRegion[rid] = [];
      byRegion[rid].push(log);
    }
    for (const [rid, logs] of Object.entries(byRegion)) {
      const key = getDrillLogsKey(rid);
      localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
    }
    localStorage.removeItem(DRILL_LOGS_KEY_LEGACY);
  } catch {
    localStorage.removeItem(DRILL_LOGS_KEY_LEGACY);
  }
}

/** 各地域キー内のログを resolveRegionId で再振り分け（誤って入ったログを正しいキーへ移動） */
function repairDrillLogsByRegion() {
  if (typeof window === "undefined") return;
  try {
    const regionIds = ["hamamatsu", "kushimoto"] as const;
    const all: DrillLog[] = [];
    for (const rid of regionIds) {
      const raw = localStorage.getItem(getDrillLogsKey(rid));
      if (raw) {
        const arr = JSON.parse(raw) as DrillLog[];
        if (Array.isArray(arr)) all.push(...arr);
      }
    }
    const byRegion: Record<string, DrillLog[]> = { hamamatsu: [], kushimoto: [] };
    for (const log of all) {
      const rid = resolveRegionId(log);
      byRegion[rid].push(log);
    }
    for (const rid of regionIds) {
      const list = (byRegion[rid] ?? []).slice(0, 100);
      localStorage.setItem(getDrillLogsKey(rid), JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

function loadDrillLogs(): DrillLog[] {
  if (typeof window === "undefined") return [];
  migrateDrillLogsFromLegacy();
  repairDrillLogsByRegion();
  try {
    const regionIds = ["hamamatsu", "kushimoto"] as const;
    const all: DrillLog[] = [];
    for (const rid of regionIds) {
      const raw = localStorage.getItem(getDrillLogsKey(rid));
      if (raw) {
        const arr = JSON.parse(raw) as DrillLog[];
        if (Array.isArray(arr)) all.push(...arr);
      }
    }
    all.sort((a, b) => (b.dateIso || "").localeCompare(a.dateIso || ""));
    return all.slice(0, 100);
  } catch {
    return [];
  }
}

function saveDrillLog(log: DrillLog) {
  const rid = resolveRegionId(log);
  const key = getDrillLogsKey(rid);
  try {
    const raw = localStorage.getItem(key);
    const logs: DrillLog[] = raw ? JSON.parse(raw) : [];
    logs.unshift(log);
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
  } catch {
    localStorage.setItem(key, JSON.stringify([log]));
  }
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

/** 標高+建物高さの大きい順で、避難可能な範囲（時間内）のトップ5を返す */
function getEvacuationSpots(
  spots: SpotSource[],
  timeLimit: number,
  _mobility: string
): EvacuationSpot[] {
  const withTotal = spots.map((s) => ({
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

/** デモ用：スタート→終点を「別経路」でつなぐシミュレーション軌跡（青破線と差が出るように迂回） */
function generateSimulatedTrack(start: LatLng, end: LatLng, numPoints = 32): LatLng[] {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const perpLng = -dy * 0.00025;
  const perpLat = dx * 0.00025;
  const points: LatLng[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const bulge = Math.sin(t * Math.PI);
    points.push({
      lat: start.lat + t * dy + perpLat * bulge,
      lng: start.lng + t * dx + perpLng * bulge,
    });
  }
  return points;
}

function TrainingContent() {
  const searchParams = useSearchParams();
  const regionConfig = getRegion(searchParams.get("region"));

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
  const gpsTrackRef = useRef<GpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number>(0);
  const phaseEventsRef = useRef<PhaseEvent[]>([]);
  const reflectionLogRef = useRef<DrillLog | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [demoRoadTrack, setDemoRoadTrack] = useState<LatLng[] | null>(null);
  const [submittedLogIds, setSubmittedLogIds] = useState<Set<string>>(new Set());
  const [likedLogIds, setLikedLogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSubmittedLogIds(loadSubmittedLogIds());
    setLikedLogIds(loadLikedLogIds());
  }, []);

  const topFive = useMemo(
    () => getEvacuationSpots(regionConfig.spots, timeLimit, mobility),
    [regionConfig.spots, timeLimit, mobility]
  );

  /** 過去ログに同じ目的地があるか（名前または座標で判定） */
  const sameDestination = (a: { name: string; lat: number; lng: number }, b: { name: string; lat: number; lng: number }) =>
    a.name === b.name || (Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5);

  const topFiveWithTrained = useMemo(() => {
    const logs = loadDrillLogs();
    return topFive.map((spot) => ({
      ...spot,
      trained: logs.some((l) => sameDestination(l.destination, { name: spot.name, lat: spot.lat, lng: spot.lng })),
    }));
  }, [topFive, showReflection]);

  // デモ時：振り返り画面で「道を使った別経路」を取得
  useEffect(() => {
    if (!showReflection || !reflectionLogRef.current) {
      setDemoRoadTrack(null);
      return;
    }
    const log = reflectionLogRef.current;
    const isDemo =
      searchParams.get("demo") === "1" || log.gpsTrack.length < 2;
    if (!isDemo) return;
    fetchWalkingRouteVia(log.start, {
      lat: log.destination.lat,
      lng: log.destination.lng,
    }).then(setDemoRoadTrack);
  }, [showReflection, searchParams]);

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
    const now = Date.now();
    startedAtMsRef.current = now;
    phaseEventsRef.current = [{ atMs: now, phase: "running" }];
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          gpsTrackRef.current.push({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            atMs: Date.now(),
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
    setDrillPhase("running");
  };

  const pauseDrill = () => {
    phaseEventsRef.current.push({ atMs: Date.now(), phase: "paused" });
    setDrillPhase("paused");
  };
  const resumeDrill = () => {
    phaseEventsRef.current.push({ atMs: Date.now(), phase: "running" });
    setDrillPhase("running");
  };
  const openEndConfirm = () => setShowEndConfirm(true);

  const confirmEndDrill = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    remainingAtEndRef.current = secondsRemaining;
    const spot = drillSpotRef.current;
    if (spot) {
      const rawLog: DrillLog = {
        id: `drill-${Date.now()}`,
        dateIso: new Date().toISOString(),
        start: regionConfig.start,
        destination: { name: spot.name, lat: spot.lat, lng: spot.lng },
        targetMinutes: spot.estimatedMinutes,
        remainingSeconds: secondsRemaining,
        plannedRoute: [regionConfig.start, { lat: spot.lat, lng: spot.lng }],
        gpsTrack: [...gpsTrackRef.current],
        startedAtMs: startedAtMsRef.current || undefined,
        phaseEvents: phaseEventsRef.current.length > 0 ? [...phaseEventsRef.current] : undefined,
        regionId: regionConfig.id,
      };
      const credibility = computeCredibility(rawLog);
      const log: DrillLog = { ...rawLog, credibility };
      saveDrillLog(log);
      addExp(10); // 訓練完了で経験値+10
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

  const submitToRegion = async () => {
    const log = reflectionLogRef.current;
    if (!log) return;
    if (submittedLogIds.has(log.id)) return;
    setSubmitStatus("sending");
    const url =
      regionConfig.id === "kushimoto"
        ? (process.env.NEXT_PUBLIC_KUSHIMOTO_SUBMIT_URL ?? "")
        : (process.env.NEXT_PUBLIC_HAMAMATSU_SUBMIT_URL ?? "");
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
      const next = new Set(submittedLogIds);
      next.add(log.id);
      setSubmittedLogIds(next);
      saveSubmittedLogIds(next);
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
              {/* 経路地図：青破線＝想定経路、緑＝実際の移動（デモ時はシミュレーション経路を表示） */}
              {(() => {
                const isDemo =
                  searchParams.get("demo") === "1" || log.gpsTrack.length < 2;
                const displayTrack = isDemo
                  ? (demoRoadTrack ??
                      generateSimulatedTrack(log.start, {
                        lat: spot.lat,
                        lng: spot.lng,
                      }))
                  : log.gpsTrack.length >= 2
                    ? log.gpsTrack.map((p) => ({ lat: p.lat, lng: p.lng }))
                    : undefined;
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      経路（スタート → 避難先）
                    </p>
                    <RouteMap
                      start={log.start}
                      end={{ lat: spot.lat, lng: spot.lng }}
                      plannedRoute={log.plannedRoute}
                      gpsTrack={displayTrack}
                      startLabel={regionConfig.startLabel}
                      height={260}
                    />
                    <p className="text-xs text-muted-foreground">
                      青＝スタート（{regionConfig.startLabel}）　オレンジ＝避難先　青破線＝道路に沿った想定経路　緑＝実際に移動した経路（GPS）
                    </p>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                      <p className="font-medium text-primary">振り返りのヒント</p>
                      <p className="mt-1 text-muted-foreground">
                        青破線と緑の経路に差があるほど、まだ短い経路や歩きやすい道の取り方など改善の余地があります。次回の訓練では経路を意識して歩いてみましょう。
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 信憑性評価：GPSと時間データの照合結果 */}
              {log.credibility && (
                <div
                  className={cn(
                    "rounded-lg border p-4 space-y-2",
                    log.credibility.label === "信頼できる"
                      ? "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-600/40 dark:bg-emerald-950/20"
                      : "border-amber-300/60 bg-amber-50/40 dark:border-amber-600/40 dark:bg-amber-950/20"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    訓練データの信憑性評価
                  </p>
                  <p className="text-lg font-bold text-foreground">{log.credibility.label}</p>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">タイマーが動いていた時間</dt>
                      <dd className="font-medium tabular-nums">
                        {Math.floor(log.credibility.activeSeconds / 60)}分
                        {Math.round(log.credibility.activeSeconds % 60)}秒
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">開始〜終了の実経過時間</dt>
                      <dd className="font-medium tabular-nums">
                        {Math.floor(log.credibility.totalRealSeconds / 60)}分
                        {Math.round(log.credibility.totalRealSeconds % 60)}秒
                      </dd>
                    </div>
                    {log.credibility.hadPause && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">一時停止</dt>
                        <dd className="font-medium">あり</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">有効計測時間中の移動距離</dt>
                      <dd className="font-medium tabular-nums">
                        {log.credibility.activeMovementDistanceM.toFixed(0)}m
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">スタート→目的地の直線距離</dt>
                      <dd className="font-medium tabular-nums">
                        {log.credibility.straightLineDistanceM.toFixed(0)}m
                      </dd>
                    </div>
                  </dl>
                  {log.credibility.note && (
                    <p className="text-xs text-muted-foreground mt-2">{log.credibility.note}</p>
                  )}
                </div>
              )}

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

              {/* いいね：良い記録として保存（有事モードでナビに利用） */}
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={likedLogIds.has(log.id)}
                    onChange={() => {
                      const next = new Set(likedLogIds);
                      if (next.has(log.id)) next.delete(log.id);
                      else next.add(log.id);
                      setLikedLogIds(next);
                      saveLikedLogIds(next);
                    }}
                    className={cn(
                      "size-4 rounded border-border accent-accent",
                      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-2"
                    )}
                    aria-label="いいね（有事モードでナビに利用）"
                  />
                  いいね！この記録を有事モードのナビに使う
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  インターネットが使えないとき、いいねした記録のGPSをナビゲーションに活用できます（有事モードは今後提供予定）。
                </p>
              </div>

              {/* 自治体に提出（1回のみ可能） */}
              {(() => {
                const alreadySubmitted = submittedLogIds.has(log.id);
                return (
                  <div className="pt-2 border-t border-border space-y-3">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={submitToRegion}
                      disabled={submitStatus === "sending" || alreadySubmitted}
                    >
                      <Send className="mr-2 size-4" />
                      {submitStatus === "sending"
                        ? "送信中…"
                        : alreadySubmitted || submitStatus === "ok"
                          ? "送信しました"
                          : submitStatus === "error"
                            ? "送信に失敗しました"
                            : `この訓練記録を${regionConfig.submitLabel}に提出する`}
                    </Button>
                    {(alreadySubmitted || submitStatus === "ok") && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
                        <p className="font-medium text-primary">{regionConfig.submitLabel}からのメッセージ</p>
                        <p className="mt-1">ありがとうございました。</p>
                        {alreadySubmitted && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            この訓練記録は1回のみ提出可能です。
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

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
            避難訓練（{regionConfig.label}）
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
              スタート地点は{regionConfig.startLabel}。{timeLimit}分以内に{MOBILITY_OPTIONS.find((m) => m.id === mobility)?.label}
              で到達できる範囲のうち、<strong>標高＋建物の高さ</strong>が大きい順にトップ5を表示しています。地図で位置関係を確認できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 地図：現在地と推奨地点を同時表示 */}
            {topFive.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <EvacuationMap
                  currentPosition={regionConfig.start}
                  spots={topFive}
                  selectedIndex={selectedSpotIndex}
                  className="w-full"
                />
                <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                  青＝{regionConfig.startLabel}（スタート）　オレンジの数字＝推奨地点（標高+建物高さの高い順・タップで強調）
                </p>
              </div>
            )}

            {topFive.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                この時間・移動手段では表示できる地点がありません。時間を延ばすか、別の移動手段を選んでください。
              </p>
            ) : (
              <ol className="space-y-2">
                {topFiveWithTrained.map((spot, index) => {
                  const trained = spot.trained;
                  const selected = selectedSpotIndex === index;
                  return (
                    <li key={`${spot.name}-${index}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedSpotIndex(selected ? null : index)}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                          trained
                            ? "border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-600/40 dark:bg-emerald-950/20"
                            : "border-accent/50 bg-accent/5 hover:border-accent hover:bg-accent/10",
                          selected && "ring-2 ring-accent ring-offset-2",
                          !trained && "sparkle-border"
                        )}
                      >
                        {!trained && (
                          <span className="absolute right-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                            NEW
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            trained
                              ? "bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200"
                              : "bg-accent/20 text-accent-foreground"
                          )}
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1 pr-12">
                          <p className="font-medium text-foreground">{spot.name}</p>
                          <p className="text-xs text-muted-foreground">
                            目安 {spot.estimatedMinutes}分 ・ {spot.distance}
                            {spot.elevationPlusHeightM != null && (
                              <> ・ 標高+建物高さ 約{spot.elevationPlusHeightM}m</>
                            )}
                          </p>
                          {trained && (
                            <span className="mt-1 inline-block text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              訓練済み
                            </span>
                          )}
                        </div>
                        {selected && <span className="sparkle-dot" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
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
              今回の訓練は{regionConfig.startLabel}をスタート地点としています。標高・建物高さは参考値です。実際の避難先・指定は各自治体のハザードマップ等でご確認ください。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          読み込み中...
        </div>
      }
    >
      <TrainingContent />
    </Suspense>
  );
}
