/** 1レベル上がるのに必要な経験値 */
export const XP_PER_LEVEL = 100;

/** 端末に保持するユーザー設定（あなたの情報・スタート地点・ゲーミフィケーション） */
export type UserSettings = {
  /** 表示名（行政ダッシュボード・振興券配布で利用） */
  displayName: string;
  height: string;
  weight: string;
  birthDate: string;
  gender: string;
  hasMobilityDisability: boolean;
  useInsulin: boolean;
  insulinUnitsPerDay: string;
  /** 累計経験値（訓練完了で加算。Lv1からスタート） */
  exp: number;
  homeAddress: string;
  workAddress: string;
  familyAddress: string;
};

const STORAGE_KEY = "disaster-app-user-settings";

const defaults: UserSettings = {
  displayName: "",
  height: "",
  weight: "",
  birthDate: "",
  gender: "",
  hasMobilityDisability: false,
  useInsulin: false,
  insulinUnitsPerDay: "",
  exp: 0,
  homeAddress: "",
  workAddress: "",
  familyAddress: "",
};

/** 生年月日から年齢を算出（今日時点）。空の場合は null */
export function getAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

/** 経験値から避難レベルを算出（Lv1〜） */
export function getLevel(exp: number): number {
  return Math.floor(exp / XP_PER_LEVEL) + 1;
}

/** 現在レベル内での経験値進捗（0〜XP_PER_LEVEL-1） */
export function getExpInCurrentLevel(exp: number): number {
  return exp % XP_PER_LEVEL;
}

/** 訓練完了時に経験値を加算 */
export function addExp(amount: number): void {
  const s = loadUserSettings();
  s.exp = (s.exp ?? 0) + amount;
  saveUserSettings(s);
}

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    const merged = { ...defaults, ...parsed };
    if (typeof merged.exp !== "number") merged.exp = 0;
    if (typeof merged.displayName !== "string") merged.displayName = "";
    return merged;
  } catch {
    return { ...defaults };
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
