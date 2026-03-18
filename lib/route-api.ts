/**
 * OSRM 経路API（Leaflet に依存しない）。
 * サーバー/クライアント両方で import 可能。履歴ページのプリレンダで使用。
 */

export type LatLng = { lat: number; lng: number };

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

/** スタート→終点の歩行経路（道路に沿った最短経路）を取得。失敗時は null。リトライあり */
export async function fetchWalkingRoute(
  start: LatLng,
  end: LatLng,
  retries = 2
): Promise<LatLng[] | null> {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `${OSRM_BASE}/foot/${coords}?overview=full&geometries=geojson`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) continue;
      const coordsGeo = data.routes[0].geometry.coordinates as [number, number][];
      return coordsGeo.map(([lng, lat]) => ({ lat, lng }));
    } catch {
      if (attempt === retries) return null;
    }
  }
  return null;
}

/** 複数点を経由する歩行経路（道路）を取得。デモ用・履歴ページの緑線用 */
export async function fetchWalkingRouteVia(
  start: LatLng,
  end: LatLng,
  viaOffsetMeters: number = 60
): Promise<LatLng[] | null> {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const perpLat = (-dx / len) * (viaOffsetMeters / 111320);
  const perpLng = (dy / len) * (viaOffsetMeters / (111320 * Math.cos((midLat * Math.PI) / 180)));
  const via: LatLng = {
    lat: midLat + perpLat,
    lng: midLng + perpLng,
  };
  const coords = `${start.lng},${start.lat};${via.lng},${via.lat};${end.lng},${end.lat}`;
  const url = `${OSRM_BASE}/foot/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) return null;
    const coordsGeo = data.routes[0].geometry.coordinates as [number, number][];
    return coordsGeo.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}
