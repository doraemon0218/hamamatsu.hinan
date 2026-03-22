/**
 * 避難訓練の地域別設定（スタート地点・推奨避難スポット）
 * 他地域展開用。浜松・串本町・大阪梅田を定義。
 */

export type RegionId = "hamamatsu" | "kushimoto" | "umeda";

export type SpotSource = {
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  buildingHeightM: number;
  estimatedMinutes: number;
  distance: string;
  /**
   * 行政の公開データ（オープンデータ・公式ページ）と施設名等を照合した結果。
   * 根拠・URL は `docs/EVACUATION-OFFICIAL-DATA.md` および `getEvacuationOfficialMeta` を参照。
   */
  isDesignatedEvacuationSite: boolean;
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
    // 静岡県 221309 指定緊急避難場所 CSV の名称に該当なし。市「津波避難ビル一覧」HTML でも当該名称未確認。
    isDesignatedEvacuationSite: false,
  },
  {
    name: "浜松城公園（高台）",
    lat: 34.711784,
    lng: 137.724887,
    elevationM: 45,
    buildingHeightM: 0,
    estimatedMinutes: 12,
    distance: "約1.0km",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "浜松駅前ビル",
    lat: 34.7038,
    lng: 137.734,
    elevationM: 8,
    buildingHeightM: 32,
    estimatedMinutes: 2,
    distance: "約100m",
    isDesignatedEvacuationSite: false,
  },
  {
    name: "浜松市役所",
    lat: 34.710896,
    lng: 137.72594,
    elevationM: 12,
    buildingHeightM: 24,
    estimatedMinutes: 10,
    distance: "約0.9km",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "東小学校",
    lat: 34.711874,
    lng: 137.738015,
    elevationM: 10,
    buildingHeightM: 12,
    estimatedMinutes: 11,
    distance: "約0.9km",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "浜松中部学園（小・中学校）",
    lat: 34.712763,
    lng: 137.722751,
    elevationM: 14,
    buildingHeightM: 15,
    estimatedMinutes: 13,
    distance: "約1.1km",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "双葉小学校",
    lat: 34.700249,
    lng: 137.730388,
    elevationM: 7,
    buildingHeightM: 12,
    estimatedMinutes: 5,
    distance: "約400m",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "西小学校",
    lat: 34.70627,
    lng: 137.72111,
    elevationM: 11,
    buildingHeightM: 12,
    estimatedMinutes: 9,
    distance: "約0.8km",
    isDesignatedEvacuationSite: true,
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
    isDesignatedEvacuationSite: true,
  },
  {
    name: "東牟婁振興局串本建設部（高台・海抜約53m）",
    lat: 33.4824,
    lng: 135.7808,
    elevationM: 53,
    buildingHeightM: 0,
    estimatedMinutes: 3,
    distance: "約250m",
    // BODiK 串本町避難先 CSV に当該施設名の行なし
    isDesignatedEvacuationSite: false,
  },
  {
    name: "串本町立串本中学校",
    lat: 33.4826,
    lng: 135.7838,
    elevationM: 12,
    buildingHeightM: 12,
    estimatedMinutes: 2,
    distance: "約200m",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "串本古座高等学校",
    lat: 33.4859,
    lng: 135.7858,
    elevationM: 18,
    buildingHeightM: 15,
    estimatedMinutes: 7,
    distance: "約600m",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "サンゴ台集会所",
    lat: 33.4829,
    lng: 135.7815,
    elevationM: 15,
    buildingHeightM: 0,
    estimatedMinutes: 2,
    distance: "約150m",
    isDesignatedEvacuationSite: true,
  },
  {
    name: "串本橋北詰付近（高台）",
    lat: 33.4839,
    lng: 135.7885,
    elevationM: 22,
    buildingHeightM: 0,
    estimatedMinutes: 8,
    distance: "約700m",
    isDesignatedEvacuationSite: false,
  },
];

/** 大阪梅田・HEP Five（1F）周辺（大阪市北区角田町） */
const SPOTS_UMEDA: SpotSource[] = [
  {
    name: "大阪駅（JRタワー・駅ビル群）",
    lat: 34.7024,
    lng: 135.4956,
    elevationM: 5,
    buildingHeightM: 120,
    estimatedMinutes: 5,
    distance: "約450m",
    // 大阪市北区「民間施設」津波避難ビル一覧の表に「大阪駅」等の記載なし
    isDesignatedEvacuationSite: false,
  },
  {
    name: "グランフロント大阪（北館）",
    lat: 34.7041,
    lng: 135.4938,
    elevationM: 6,
    buildingHeightM: 170,
    estimatedMinutes: 7,
    distance: "約650m",
    // 北区一覧 No.5「グランフロント大阪 南館、北館」に該当
    isDesignatedEvacuationSite: true,
  },
  {
    name: "梅田スカイビル（高層・展望施設）",
    lat: 34.7054,
    lng: 135.4903,
    elevationM: 8,
    buildingHeightM: 173,
    estimatedMinutes: 12,
    distance: "約1.1km",
    isDesignatedEvacuationSite: false,
  },
  {
    name: "阪急百貨店うめだ本店（周辺ビル）",
    lat: 34.7026,
    lng: 135.4988,
    elevationM: 5,
    buildingHeightM: 45,
    estimatedMinutes: 2,
    distance: "約150m",
    isDesignatedEvacuationSite: false,
  },
  {
    name: "梅田ツインタワーズ・南タワー",
    lat: 34.7056,
    lng: 135.497,
    elevationM: 6,
    buildingHeightM: 192,
    estimatedMinutes: 8,
    distance: "約750m",
    isDesignatedEvacuationSite: false,
  },
  {
    name: "ヒルトン大阪（北新地側・高層）",
    lat: 34.6988,
    lng: 135.4968,
    elevationM: 4,
    buildingHeightM: 140,
    estimatedMinutes: 9,
    distance: "約850m",
    isDesignatedEvacuationSite: false,
  },
  {
    name: "大阪梅田駅（地下鉄・阪神）周辺ビル",
    lat: 34.7006,
    lng: 135.4975,
    elevationM: 5,
    buildingHeightM: 38,
    estimatedMinutes: 4,
    distance: "約350m",
    isDesignatedEvacuationSite: false,
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
  umeda: {
    id: "umeda",
    label: "大阪梅田ver.",
    startLabel: "HEP Five（1F）",
    start: { lat: 34.7022, lng: 135.4992 },
    spots: SPOTS_UMEDA,
    submitLabel: "大阪梅田",
  },
};

export function getRegion(regionId: string | null): RegionConfig {
  if (regionId === "kushimoto") return REGIONS.kushimoto;
  if (regionId === "umeda") return REGIONS.umeda;
  return REGIONS.hamamatsu;
}

/** 自治体・エリアごとの履歴表示順 */
export const REGION_IDS_FOR_HISTORY: RegionId[] = ["hamamatsu", "kushimoto", "umeda"];

/** 古いログ等：スタート座標から地域を推定（梅田は緯度経度の矩形で判定） */
export function inferRegionIdFromStart(start: { lat: number; lng: number }): RegionId {
  if (start.lat < 34) return "kushimoto";
  if (start.lat >= 34.64 && start.lat <= 34.76 && start.lng >= 135.44 && start.lng <= 135.56) return "umeda";
  return "hamamatsu";
}
