"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LatLng = { lat: number; lng: number };

type RouteMapProps = {
  start: LatLng;
  end: LatLng;
  /** 計画経路（スタート→避難先）。未指定なら直線 */
  plannedRoute?: LatLng[];
  /** GPSで記録した実際の移動軌跡 */
  gpsTrack?: LatLng[];
  className?: string;
  height?: number;
};

export function RouteMap({
  start,
  end,
  plannedRoute,
  gpsTrack,
  className = "",
  height = 280,
}: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const plannedLineRef = useRef<L.Polyline | null>(null);
  const gpsLineRef = useRef<L.Polyline | null>(null);

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
      .bindTooltip("スタート（浜松駅）", { permanent: false, direction: "top" });

    L.circleMarker([end.lat, end.lng], {
      radius: 10,
      fillColor: "#ea580c",
      color: "#c2410c",
      weight: 2,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindTooltip("避難先", { permanent: false, direction: "top" });

    const routePoints = plannedRoute && plannedRoute.length >= 2
      ? plannedRoute
      : [start, end];
    const planned = L.polyline(
      routePoints.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      { color: "#2563eb", weight: 4, opacity: 0.8, dashArray: "8,8" }
    ).addTo(map);
    plannedLineRef.current = planned;

    mapRef.current = map;
    return () => {
      plannedLineRef.current?.remove();
      gpsLineRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [start.lat, start.lng, end.lat, end.lng]);

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
    if (gpsTrack && gpsTrack.length >= 2) {
      gpsTrack.forEach((p) => points.push([p.lat, p.lng]));
    }
    mapRef.current.fitBounds(L.latLngBounds(points as L.LatLngBoundsLiteral).pad(0.2));
  }, [start, end, gpsTrack]);

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
