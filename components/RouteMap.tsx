"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchWalkingRoute, type LatLng } from "@/lib/route-api";

export type { LatLng };

type RouteMapProps = {
  start: LatLng;
  end: LatLng;
  /** 計画経路（スタート→避難先）。未指定または2点のみのときは道路経路を取得して表示 */
  plannedRoute?: LatLng[];
  /** GPSで記録した実際の移動軌跡（緑で表示。計画経路との差が改善の余地としてフィードバックされる） */
  gpsTrack?: LatLng[];
  /** スタート地点の表示名（例: 浜松駅・串本町役場） */
  startLabel?: string;
  className?: string;
  height?: number;
};

export function RouteMap({
  start,
  end,
  plannedRoute,
  gpsTrack,
  startLabel = "スタート",
  className = "",
  height = 280,
}: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const plannedLineRef = useRef<L.Polyline | null>(null);
  const gpsLineRef = useRef<L.Polyline | null>(null);
  const [roadRoute, setRoadRoute] = useState<LatLng[] | null>(null);
  const [roadRouteAttempted, setRoadRouteAttempted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2],
      zoom: 15,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    L.circleMarker([start.lat, start.lng], {
      radius: 10,
      fillColor: "#2563eb",
      color: "#1d4ed8",
      weight: 2,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindTooltip(`スタート（${startLabel}）`, { permanent: false, direction: "top" });

    L.circleMarker([end.lat, end.lng], {
      radius: 10,
      fillColor: "#ea580c",
      color: "#c2410c",
      weight: 2,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindTooltip("避難先", { permanent: false, direction: "top" });

    mapRef.current = map;
    return () => {
      plannedLineRef.current?.remove();
      plannedLineRef.current = null;
      gpsLineRef.current?.remove();
      gpsLineRef.current = null;
      map.remove();
      mapRef.current = null;
      setRoadRoute(null);
      setRoadRouteAttempted(false);
    };
  }, [start.lat, start.lng, end.lat, end.lng, startLabel]);

  // 道路に沿った歩行経路を取得（青破線用）
  useEffect(() => {
    setRoadRouteAttempted(false);
    let cancelled = false;
    fetchWalkingRoute(start, end).then((route) => {
      if (!cancelled) {
        setRoadRouteAttempted(true);
        if (route && route.length >= 2) setRoadRoute(route);
      }
    });
    return () => { cancelled = true; };
  }, [start.lat, start.lng, end.lat, end.lng]);

  // 青破線：道路経路を優先。取得失敗時のみ直線（取得試行前は描画しない）
  useEffect(() => {
    if (!mapRef.current) return;
    const fallback = plannedRoute && plannedRoute.length >= 2 ? plannedRoute : [start, end];
    const points = roadRoute ?? (roadRouteAttempted ? fallback : null);
    if (!points || points.length < 2) return;
    plannedLineRef.current?.remove();
    plannedLineRef.current = null;
    const line = L.polyline(
      points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      { color: "#2563eb", weight: 4, opacity: 0.8, dashArray: "8,8" }
    ).addTo(mapRef.current);
    plannedLineRef.current = line;
  }, [roadRoute, roadRouteAttempted, plannedRoute, start.lat, start.lng, end.lat, end.lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    gpsLineRef.current?.remove();
    gpsLineRef.current = null;
    if (gpsTrack && gpsTrack.length >= 2) {
      const line = L.polyline(
        gpsTrack.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: "#16a34a", weight: 5, opacity: 0.9 }
      ).addTo(mapRef.current);
      gpsLineRef.current = line;
    }
  }, [gpsTrack]);

  useEffect(() => {
    if (!mapRef.current) return;
    const points: L.LatLngExpression[] = [[start.lat, start.lng], [end.lat, end.lng]];
    const plannedPoints = roadRoute ?? (plannedRoute && plannedRoute.length >= 2 ? plannedRoute : [start, end]);
    plannedPoints.forEach((p) => points.push([p.lat, p.lng]));
    if (gpsTrack && gpsTrack.length >= 2) {
      gpsTrack.forEach((p) => points.push([p.lat, p.lng]));
    }
    mapRef.current.fitBounds(L.latLngBounds(points as L.LatLngBoundsLiteral).pad(0.2));
  }, [start, end, gpsTrack, roadRoute, plannedRoute]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-border"
        style={{ height }}
      />
    </div>
  );
}
