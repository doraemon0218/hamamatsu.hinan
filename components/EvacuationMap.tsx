"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type EvacuationSpot = {
  name: string;
  estimatedMinutes: number;
  distance: string;
  lat: number;
  lng: number;
  rank: number;
  /** 標高+建物高さ（m）。津波避難の目安として表示用 */
  elevationPlusHeightM?: number;
  /** 行政公開データ照合結果（詳細は docs/EVACUATION-OFFICIAL-DATA.md） */
  isDesignatedEvacuationSite: boolean;
};

type EvacuationMapProps = {
  /** 現在地 */
  currentPosition: { lat: number; lng: number };
  /** 推奨地点トップ5（座標付き） */
  spots: EvacuationSpot[];
  /** 選択中の地点のインデックス（0〜4）。リストで選んだ場所を地図でハイライト */
  selectedIndex: number | null;
  className?: string;
};

export function EvacuationMap({
  currentPosition,
  spots,
  selectedIndex,
  className = "",
}: EvacuationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const currentMarkerRef = useRef<L.CircleMarker | null>(null);
  const selectedPinRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [currentPosition.lat, currentPosition.lng],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // 現在地マーカー（青い円）
    const currentIcon = L.circleMarker([currentPosition.lat, currentPosition.lng], {
      radius: 12,
      fillColor: "#2563eb",
      color: "#1d4ed8",
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);
    currentIcon.bindTooltip("現在地", {
      permanent: false,
      direction: "top",
    });
    currentMarkerRef.current = currentIcon;

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      selectedPinRef.current?.remove();
      selectedPinRef.current = null;
      currentMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [currentPosition.lat, currentPosition.lng]);

  // 推奨地点マーカーを更新
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    selectedPinRef.current?.remove();
    selectedPinRef.current = null;

    spots.forEach((spot, index) => {
      const isSelected = selectedIndex === index;
      const designatedClass = spot.isDesignatedEvacuationSite
        ? "evacuation-marker-inner--designated"
        : "evacuation-marker-inner--reference";
      const designatedLabel = spot.isDesignatedEvacuationSite
        ? "🏛️ 指定避難場所（公開データに掲載）"
        : "📌 参考（公開一覧に当該施設名なし）";
      const marker = L.marker([spot.lat, spot.lng], {
        icon: L.divIcon({
          className: "evacuation-marker",
          html: `<span class="evacuation-marker-inner ${designatedClass} ${isSelected ? "evacuation-marker-selected" : ""}">${spot.rank}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      }).addTo(mapRef.current!);

      marker.bindTooltip(
        `<strong>${spot.name}</strong><br/>${designatedLabel}<br/>目安 ${spot.estimatedMinutes}分 ・ ${spot.distance}`,
        {
          permanent: false,
          direction: "top",
        }
      );
      marker.bindPopup(
        `${spot.name}<br/>${designatedLabel}<br/>目安 ${spot.estimatedMinutes}分 ・ ${spot.distance}`
      );

      markersRef.current.push(marker);
    });

    // 選択された地点にピンを落とす（建物の場所を明確に）
    if (selectedIndex != null && spots[selectedIndex]) {
      const spot = spots[selectedIndex];
      const pinMarker = L.marker([spot.lat, spot.lng], {
        icon: L.divIcon({
          className: "evacuation-selected-pin",
          html: `<div class="evacuation-pin-icon" title="${spot.name}">📍</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        }),
      }).addTo(mapRef.current!);
      pinMarker.bindTooltip(`選択中: ${spot.name}`, { permanent: false, direction: "top" });
      selectedPinRef.current = pinMarker;
      // 選択した建物の位置が地図内で見えるように少しパン
      mapRef.current.panTo([spot.lat, spot.lng], { animate: true, duration: 0.3 });
    }
  }, [spots, selectedIndex]);

  // 全点が収まるようにフィット
  useEffect(() => {
    if (!mapRef.current || spots.length === 0) return;

    const points: L.LatLngExpression[] = [
      [currentPosition.lat, currentPosition.lng],
      ...spots.map((s) => [s.lat, s.lng] as L.LatLngExpression),
    ];
    const bounds = L.latLngBounds(points).pad(0.15);
    mapRef.current.fitBounds(bounds, { maxZoom: 17 });
  }, [currentPosition, spots]);

  return (
    <div className={className} style={{ position: "relative", minHeight: 280 }}>
      <div
        ref={containerRef}
        className="h-full min-h-[280px] w-full rounded-lg overflow-hidden z-0"
        style={{ height: 280 }}
      />
    </div>
  );
}
