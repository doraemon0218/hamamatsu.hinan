/**
 * 訓練ログの「いいね」管理。
 * いいねしたログは、今後提供予定の有事モード（オフライン時）で
 * GPS記録をナビゲーション用として活用できる想定。
 *
 * 有事モードでの利用想定:
 * - loadLikedLogIds() でいいね済みログID一覧を取得
 * - 各地域の訓練ログ（disaster-app-drill-logs-{regionId}）から
 *   そのIDに一致するログを抽出し、gpsTrack をナビ経路として利用
 */

const LIKED_LOG_IDS_KEY = "disaster-app-liked-log-ids";

export function loadLikedLogIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LIKED_LOG_IDS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveLikedLogIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIKED_LOG_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function toggleLikedLogId(id: string): boolean {
  const ids = loadLikedLogIds();
  if (ids.has(id)) {
    ids.delete(id);
  } else {
    ids.add(id);
  }
  saveLikedLogIds(ids);
  return ids.has(id);
}

export function isLikedLogId(id: string): boolean {
  return loadLikedLogIds().has(id);
}
