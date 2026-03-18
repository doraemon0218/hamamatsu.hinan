"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadLikedLogIds, saveLikedLogIds } from "@/lib/liked-logs";
import { REGIONS, REGION_IDS_FOR_HISTORY } from "@/lib/regions";
import type { RegionId } from "@/lib/regions";
import { fetchWalkingRouteVia, type LatLng } from "@/components/RouteMap";

const DRILL_LOGS_KEY_PREFIX = "disaster-app-drill-logs-";
const DRILL_LOGS_KEY_LEGACY = "disaster-app-drill-logs";

function getDrillLogsKey(regionId: string): string {
  return `${DRILL_LOGS_KEY_PREFIX}${regionId}`;
}

/** スタート座標から地域を推定。串本町は北緯33°台、浜松は34°台 */
function inferRegionIdFromStart(start: { lat: number; lng: number }): RegionId {
  if (start.lat < 34) return "kushimoto";
  return "hamamatsu";
}

function resolveRegionId(item: Record<string, unknown>): RegionId {
  const r = item.regionId as string | undefined;
  if (r === "kushimoto" || r === "hamamatsu") return r;
  const start = item.start as { lat: number; lng: number } | undefined;
  if (start && typeof start.lat === "number") return inferRegionIdFromStart(start);
  return "hamamatsu";
}

/** 旧キーから地域別へ移行（regionId 未設定はスタート座標で推定） */
function migrateAndLoadByRegion(regionId: RegionId): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const rawLegacy = localStorage.getItem(DRILL_LOGS_KEY_LEGACY);
    if (rawLegacy) {
      const arr = JSON.parse(rawLegacy) as unknown[];
      if (Array.isArray(arr) && arr.length > 0) {
        const byRegion: Record<string, unknown[]> = {};
        for (const item of arr) {
          const o = item as Record<string, unknown>;
          const rid = resolveRegionId(o);
          if (!byRegion[rid]) byRegion[rid] = [];
          byRegion[rid].push(item);
        }
        for (const [rid, logs] of Object.entries(byRegion)) {
          localStorage.setItem(getDrillLogsKey(rid), JSON.stringify((logs as unknown[]).slice(0, 100)));
        }
        localStorage.removeItem(DRILL_LOGS_KEY_LEGACY);
      }
    }
    const raw = localStorage.getItem(getDrillLogsKey(regionId));
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}

/** 各地域キー内のログをスタート座標で再振り分け（串本町ログが浜松に入っている場合の修復） */
function repairHistoryByRegion() {
  if (typeof window === "undefined") return;
  try {
    const regionIds: RegionId[] = ["hamamatsu", "kushimoto"];
    const all: unknown[] = [];
    for (const rid of regionIds) {
      const raw = localStorage.getItem(getDrillLogsKey(rid));
      if (raw) {
        const arr = JSON.parse(raw) as unknown[];
        if (Array.isArray(arr)) all.push(...arr);
      }
    }
    const byRegion: Record<string, unknown[]> = { hamamatsu: [], kushimoto: [] };
    for (const item of all) {
      const o = item as Record<string, unknown>;
      const rid = resolveRegionId(o);
      byRegion[rid].push(item);
    }
    for (const rid of regionIds) {
      localStorage.setItem(getDrillLogsKey(rid), JSON.stringify((byRegion[rid] ?? []).slice(0, 100)));
    }
  } catch {
    // ignore
  }
}

type HistoryLog = {
  id: string;
  dateIso: string;
  start: LatLng;
  destination: { name: string; lat: number; lng: number };
  plannedRoute: LatLng[];
  gpsTrack: Array<{ lat: number; lng: number }>;
  regionId?: string;
};

function parseHistoryLog(item: unknown): HistoryLog {
  const o = item as Record<string, unknown>;
  const gpsTrack = Array.isArray(o.gpsTrack)
    ? (o.gpsTrack as Array<{ lat: number; lng: number }>).map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
      }))
    : [];
  return {
    id: String(o.id ?? ""),
    dateIso: String(o.dateIso ?? ""),
    start: o.start as LatLng,
    destination: o.destination as HistoryLog["destination"],
    plannedRoute: Array.isArray(o.plannedRoute) ? (o.plannedRoute as LatLng[]) : [],
    gpsTrack,
    regionId: o.regionId as string | undefined,
  };
}

function loadHistoryLogsByRegion(regionId: RegionId): HistoryLog[] {
  const arr = migrateAndLoadByRegion(regionId);
  return arr.map(parseHistoryLog);
}

/** 表示用：GPSが無い場合のシミュレーション経路（デモ用と同様） */
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

const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((m) => ({ default: m.RouteMap })),
  { ssr: false }
);

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const [logsByRegion, setLogsByRegion] = useState<Record<RegionId, HistoryLog[]>>({
    hamamatsu: [],
    kushimoto: [],
  });
  /** GPSが無いログ用：道路に沿った経路（緑線）を取得してキャッシュ */
  const [roadTracks, setRoadTracks] = useState<Record<string, LatLng[]>>({});
  const requestedTrackIds = useRef<Set<string>>(new Set());
  /** いいねしたログID（有事モードでナビに利用する記録） */
  const [likedLogIds, setLikedLogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    repairHistoryByRegion();
    setLogsByRegion({
      hamamatsu: loadHistoryLogsByRegion("hamamatsu"),
      kushimoto: loadHistoryLogsByRegion("kushimoto"),
    });
    setLikedLogIds(loadLikedLogIds());
  }, []);

  const toggleLike = (logId: string) => {
    const next = new Set(likedLogIds);
    if (next.has(logId)) next.delete(logId);
    else next.add(logId);
    setLikedLogIds(next);
    saveLikedLogIds(next);
  };

  useEffect(() => {
    const allLogs = [...logsByRegion.hamamatsu, ...logsByRegion.kushimoto];
    for (const log of allLogs) {
      if (log.gpsTrack.length >= 2) continue;
      if (requestedTrackIds.current.has(log.id)) continue;
      requestedTrackIds.current.add(log.id);
      fetchWalkingRouteVia(log.start, log.destination).then((route) => {
        if (route && route.length >= 2) {
          setRoadTracks((prev) => ({ ...prev, [log.id]: route }));
        }
      });
    }
  }, [logsByRegion.hamamatsu, logsByRegion.kushimoto]);

  const hasAny = logsByRegion.hamamatsu.length > 0 || logsByRegion.kushimoto.length > 0;

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
          <Waves className="size-6 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">過去の訓練記録</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-8 px-4 py-6 pb-24">
        <p className="text-sm text-muted-foreground">
          振り返りで表示した地図（推奨ルートと実際の移動経路）を自治体ごとに蓄積して表示しています。
        </p>
        <p className="text-xs text-muted-foreground">
          良い記録には「いいね！」を付けておくと、今後提供予定の有事モードで、インターネットが使えないときのナビゲーションにそのGPS記録を活用できます。
        </p>

        {!hasAny ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              まだ訓練記録がありません。訓練を行うと、ここに地図が蓄積されていきます。
            </CardContent>
          </Card>
        ) : (
          <>
            {REGION_IDS_FOR_HISTORY.map((regionId) => {
              const logs = logsByRegion[regionId];
              const regionConfig = REGIONS[regionId];
              if (logs.length === 0) return null;
              return (
                <section key={regionId}>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    {regionConfig.submitLabel}
                  </h2>
                  <ul className="space-y-4">
                    {logs.map((log) => {
                      const displayTrack =
                        log.gpsTrack.length >= 2
                          ? log.gpsTrack
                          : roadTracks[log.id] ??
                              generateSimulatedTrack(log.start, log.destination);
                      return (
                        <li key={log.id}>
                          <Card>
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-base">
                                    {formatDate(log.dateIso)}
                                  </CardTitle>
                                  <p className="text-sm text-muted-foreground">
                                    避難先：{log.destination.name}
                                  </p>
                                </div>
                                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                                  <input
                                    type="checkbox"
                                    checked={likedLogIds.has(log.id)}
                                    onChange={() => toggleLike(log.id)}
                                    className={cn(
                                      "size-4 rounded border-border accent-accent",
                                      "focus:ring-2 focus:ring-accent/50 focus:ring-offset-2"
                                    )}
                                    aria-label="いいね（有事モードでナビに利用）"
                                  />
                                  いいね！
                                </label>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="overflow-hidden rounded-lg border border-border">
                                <RouteMap
                                  start={log.start}
                                  end={log.destination}
                                  plannedRoute={
                                    log.plannedRoute.length >= 2
                                      ? log.plannedRoute
                                      : [log.start, log.destination]
                                  }
                                  gpsTrack={displayTrack}
                                  startLabel={regionConfig.startLabel}
                                  height={220}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                青破線＝道路に沿った想定経路　緑＝実際に移動した経路
                              </p>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </>
        )}

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="size-4" />
            ホームに戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
