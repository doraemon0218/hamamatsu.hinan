/**
 * 移動手段ごとの「参考能力値」と最終訓練日。
 * 参考値は設定の年齢に応じた簡略化した目安（厚生労働省の身体活動・運動に関する
 * 公開資料＝アクティブガイド等で示される一般的な強度・歩行を含む活動の目安を参考。
 * 医療的助言ではなく、避難訓練の目安表示用です。
 */

export type MobilityId = "walk" | "run" | "bicycle";

const STORAGE_KEY = "disaster-app-mobility-profile";

/** 訓練が「空いている」とみなす日数（この期間を超えるとトップで注意表示） */
export const MOBILITY_STALE_DAYS = 21;

export type MobilityStored = {
  lastTrainedAtIso: string | null;
};

function defaultStored(): Record<MobilityId, MobilityStored> {
  return {
    walk: { lastTrainedAtIso: null },
    run: { lastTrainedAtIso: null },
    bicycle: { lastTrainedAtIso: null },
  };
}

export function loadMobilityStored(): Record<MobilityId, MobilityStored> {
  if (typeof window === "undefined") return defaultStored();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStored();
    const parsed = JSON.parse(raw) as Partial<Record<MobilityId, MobilityStored>>;
    const base = defaultStored();
    for (const id of Object.keys(base) as MobilityId[]) {
      const p = parsed[id];
      if (p && typeof p.lastTrainedAtIso === "string") base[id] = { lastTrainedAtIso: p.lastTrainedAtIso };
      else if (p && p.lastTrainedAtIso === null) base[id] = { lastTrainedAtIso: null };
    }
    return base;
  } catch {
    return defaultStored();
  }
}

function saveMobilityStored(data: Record<MobilityId, MobilityStored>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** 訓練完了時に呼び出す（該当する移動手段の最終日を更新） */
export function recordMobilityTraining(mobility: MobilityId) {
  const s = loadMobilityStored();
  s[mobility] = { lastTrainedAtIso: new Date().toISOString() };
  saveMobilityStored(s);
}

/** 年齢別の参考数値（公的資料の一般的目安を簡略化。年齢未設定時は成人中央付近） */
function referenceWalkMPerMin(age: number | null): number {
  if (age == null) return 80;
  if (age < 40) return 83;
  if (age < 65) return 78;
  if (age < 75) return 72;
  return 65;
}

function referenceRunKmH(age: number | null): number {
  if (age == null) return 8.5;
  if (age < 50) return 9;
  if (age < 65) return 8;
  return 7;
}

function referenceBikeKmH(age: number | null): number {
  if (age == null) return 14;
  if (age < 65) return 14;
  return 12;
}

export type MobilityDisplay = {
  id: MobilityId;
  /** 一覧用の短い能力表示 */
  abilityLine: string;
  /** 脚注用 */
  referenceDetail: string;
  lastTrainedAtIso: string | null;
  isStale: boolean;
  daysSinceTrain: number | null;
};

export function getMobilityDisplays(age: number | null): MobilityDisplay[] {
  const stored = loadMobilityStored();
  const now = Date.now();
  const staleMs = MOBILITY_STALE_DAYS * 24 * 60 * 60 * 1000;

  const walkM = referenceWalkMPerMin(age);
  const runK = referenceRunKmH(age);
  const bikeK = referenceBikeKmH(age);

  const defs: { id: MobilityId; abilityLine: string; referenceDetail: string }[] = [
    {
      id: "walk",
      abilityLine: `参考 歩行の目安 約 ${walkM} m/分`,
      referenceDetail:
        "歩行速度の目安（年齢で調整）。アクティブガイド等で示される歩行を含む身体活動の一般的な強度の考え方を参考にしています。",
    },
    {
      id: "run",
      abilityLine: `参考 ゆったり走る目安 約 ${runK} km/h`,
      referenceDetail:
        "軽いジョギング程度の目安（年齢で調整）。無理のない範囲で、心拍・呼吸が少し上がる程度を想定した参考値です。",
    },
    {
      id: "bicycle",
      abilityLine: `参考 自転車（平坦・安全運転）約 ${bikeK} km/h`,
      referenceDetail:
        "平坦・安全な走行を前提とした一般的なレクリエーション強度の目安（年齢で調整）。交通ルール・体調に合わせて調整してください。",
    },
  ];

  return defs.map((d) => {
    const last = stored[d.id].lastTrainedAtIso;
    const lastMs = last ? new Date(last).getTime() : NaN;
    const hasTrain = last && !Number.isNaN(lastMs);
    const daysSinceTrain = hasTrain ? Math.floor((now - lastMs) / 86400000) : null;
    const isStale = !hasTrain || now - lastMs >= staleMs;
    return {
      id: d.id,
      abilityLine: d.abilityLine,
      referenceDetail: d.referenceDetail,
      lastTrainedAtIso: hasTrain ? last : null,
      isStale,
      daysSinceTrain,
    };
  });
}

export const MOBILITY_REFERENCE_FOOTNOTE =
  "表示は、設定の生年月日から算出した年齢と、厚生労働省の公開資料（身体活動・運動の基準等）に基づく一般的な目安を簡略化した参考値です。個人差が大きく、医療的助言ではありません。";
