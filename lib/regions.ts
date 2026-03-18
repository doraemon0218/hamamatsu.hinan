/**
 * 避難訓練の地域別設定（スタート地点・推奨避難スポット）
 * 他地域展開用。浜松・串本町を定義。
 */

export type RegionId = "hamamatsu" | "kushimoto";

export type SpotSource = {
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  buildingHeightM: number;
  estimatedMinutes: number;
  distance: string;
};

export type RegionConfig = {
  id: RegionId;
  label: string;
  startLabel: string;
  start: { lat: number; lng: number };
  spots: SpotSource[];
  /** 提出先表示名（例: 浜松市・串本町） */
  submitLabel: string;
};

/** 浜松駅周辺（静岡県浜松市） */
const SPOTS_HAMAMATSU: SpotSource[] = [
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

/** 串本町役場周辺（和歌山県東牟婁郡串本町・サンゴ台）
 * 座標は公式地図・OSMで確認できるサンゴ台付近の値（北緯33.48°、東経135.78°付近）
 */
const SPOTS_KUSHIMOTO: SpotSource[] = [
  {
    name: "県営住宅串本団地（津波避難ビル等）",
    lat: 33.4816,
    lng: 135.7888,
    elevationM: 8,
    buildingHeightM: 27,
    estimatedMinutes: 6,
    distance: "約500m",
  },
  {
    name: "東牟婁振興局串本建設部（高台・海抜約53m）",
    lat: 33.4824,
    lng: 135.7808,
    elevationM: 53,
    buildingHeightM: 0,
    estimatedMinutes: 3,
    distance: "約250m",
  },
  {
    name: "串本町立串本中学校",
    lat: 33.4826,
    lng: 135.7838,
    elevationM: 12,
    buildingHeightM: 12,
    estimatedMinutes: 2,
    distance: "約200m",
  },
  {
    name: "串本古座高等学校",
    lat: 33.4859,
    lng: 135.7858,
    elevationM: 18,
    buildingHeightM: 15,
    estimatedMinutes: 7,
    distance: "約600m",
  },
  {
    name: "サンゴ台集会所",
    lat: 33.4829,
    lng: 135.7815,
    elevationM: 15,
    buildingHeightM: 0,
    estimatedMinutes: 2,
    distance: "約150m",
  },
  {
    name: "串本橋北詰付近（高台）",
    lat: 33.4839,
    lng: 135.7885,
    elevationM: 22,
    buildingHeightM: 0,
    estimatedMinutes: 8,
    distance: "約700m",
  },
];

export const REGIONS: Record<RegionId, RegionConfig> = {
  hamamatsu: {
    id: "hamamatsu",
    label: "浜松ver.",
    startLabel: "浜松駅",
    start: { lat: 34.7034, lng: 137.7343 },
    spots: SPOTS_HAMAMATSU,
    submitLabel: "浜松市",
  },
  kushimoto: {
    id: "kushimoto",
    label: "串本町ver.",
    startLabel: "串本町役場",
    start: { lat: 33.482, lng: 135.7823 }, // 串本町役場（サンゴ台）北緯33.48°東経135.78°付近
    spots: SPOTS_KUSHIMOTO,
    submitLabel: "串本町",
  },
};

export function getRegion(regionId: string | null): RegionConfig {
  const id = regionId === "kushimoto" ? "kushimoto" : "hamamatsu";
  return REGIONS[id];
}

/** 自治体ごとの履歴表示順 */
export const REGION_IDS_FOR_HISTORY: RegionId[] = ["hamamatsu", "kushimoto"];
