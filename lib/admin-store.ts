/**
 * 行政向け：提出ログ・地域振興券のインメモリストア。
 * 本番では DB に置き換える想定。
 */

export type RegionId = "hamamatsu" | "kushimoto";

export type SubmittedLog = {
  id: string;
  regionId: RegionId;
  userId: string;
  displayName: string;
  age: number | null;
  startLabel: string;
  start: { lat: number; lng: number };
  destinationName: string;
  destination: { lat: number; lng: number };
  targetMinutes: number;
  durationMinutes: number;
  reachedTarget: boolean;
  submittedAt: string;
  logId: string;
};

export type VoucherCampaign = {
  id: string;
  regionId: RegionId;
  budget: number;
  priorityLabel: string;
  totalAmount: number;
  perPersonAmount: number;
  distributedUserIds: string[];
  distributedAt: string;
};

export type UserVoucher = {
  id: string;
  userId: string;
  regionId: RegionId;
  campaignId: string;
  amount: number;
  distributedAt: string;
  /** 残高（利用で減る）。QR決済で利用可能 */
  remainingAmount: number;
};

const submissionsByRegion: Record<RegionId, SubmittedLog[]> = {
  hamamatsu: [],
  kushimoto: [],
};

const userVouchers: UserVoucher[] = [];
const campaigns: VoucherCampaign[] = [];

export function addSubmission(regionId: RegionId, log: Omit<SubmittedLog, "id">): SubmittedLog {
  if (!submissionsByRegion[regionId]) submissionsByRegion[regionId] = [];
  const id = `sub-${regionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: SubmittedLog = { ...log, id };
  submissionsByRegion[regionId].push(entry);
  return entry;
}

export function getSubmissions(
  regionId: RegionId,
  filters?: {
    displayName?: string;
    ageMin?: number;
    ageMax?: number;
    reachedTarget?: boolean;
    startLabel?: string;
    destinationName?: string;
  }
): SubmittedLog[] {
  let list = [...(submissionsByRegion[regionId] ?? [])];
  if (filters?.displayName?.trim()) {
    const q = filters.displayName.trim().toLowerCase();
    list = list.filter((s) => s.displayName.toLowerCase().includes(q));
  }
  if (filters?.ageMin != null) list = list.filter((s) => s.age != null && s.age >= filters.ageMin!);
  if (filters?.ageMax != null) list = list.filter((s) => s.age != null && s.age <= filters.ageMax!);
  if (filters?.reachedTarget !== undefined)
    list = list.filter((s) => s.reachedTarget === filters.reachedTarget);
  if (filters?.startLabel?.trim()) {
    const q = filters.startLabel.trim().toLowerCase();
    list = list.filter((s) => s.startLabel.toLowerCase().includes(q));
  }
  if (filters?.destinationName?.trim()) {
    const q = filters.destinationName.trim().toLowerCase();
    list = list.filter((s) => s.destinationName.toLowerCase().includes(q));
  }
  return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/** 配布優先順位のソートキー（複数指定時は先に選んだ条件を優先） */
export type SortCriterion =
  | "age_desc"   // 年齢 高齢者優先
  | "age_asc"   // 年齢 若年優先
  | "start_asc" // 開始地点 あいうえお順
  | "start_desc" // 開始地点 逆順
  | "reachRate_desc" // 過去の到達率 高い順
  | "maxSurplus_desc"; // 目標時間−所要時間が最大の訓練ログ（余裕）大きい順

export type UserAggregate = {
  userId: string;
  displayName: string;
  age: number | null;
  startLabel: string;
  /** この地域の提出のうち到達した割合 0〜1 */
  reachRate: number;
  /** 目標時間−所要時間の最大（分）。余裕が多かった訓練 */
  maxSurplusMinutes: number;
  /** 代表提出 id（表示用） */
  latestSubmissionId: string;
};

export function getUserAggregates(
  regionId: RegionId,
  filters?: Parameters<typeof getSubmissions>[1]
): UserAggregate[] {
  const list = getSubmissions(regionId, filters);
  const byUser = new Map<string, SubmittedLog[]>();
  for (const s of list) {
    const arr = byUser.get(s.userId) ?? [];
    arr.push(s);
    byUser.set(s.userId, arr);
  }
  const aggregates: UserAggregate[] = [];
  for (const [userId, subs] of byUser) {
    const sorted = [...subs].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const latest = sorted[0];
    const reached = subs.filter((s) => s.reachedTarget).length;
    const maxSurplus = Math.max(...subs.map((s) => s.targetMinutes - s.durationMinutes), 0);
    aggregates.push({
      userId,
      displayName: latest.displayName,
      age: latest.age,
      startLabel: latest.startLabel,
      reachRate: subs.length > 0 ? reached / subs.length : 0,
      maxSurplusMinutes: maxSurplus,
      latestSubmissionId: latest.id,
    });
  }
  return aggregates;
}

export function getTopUserIdsByPriority(
  regionId: RegionId,
  filters: Parameters<typeof getSubmissions>[1] | undefined,
  sortOrder: SortCriterion[],
  limit: number
): string[] {
  const aggregates = getUserAggregates(regionId, filters);
  const order = sortOrder.filter((o) => o.length > 0);
  const compare = (a: UserAggregate, b: UserAggregate): number => {
    if (order.length === 0) {
      return (b.latestSubmissionId || "").localeCompare(a.latestSubmissionId || "");
    }
    for (const key of order) {
      let cmp = 0;
      switch (key) {
        case "age_desc":
          cmp = (b.age ?? -1) - (a.age ?? -1);
          break;
        case "age_asc":
          cmp = (a.age ?? 999) - (b.age ?? 999);
          break;
        case "start_asc":
          cmp = (a.startLabel || "").localeCompare(b.startLabel || "");
          break;
        case "start_desc":
          cmp = (b.startLabel || "").localeCompare(a.startLabel || "");
          break;
        case "reachRate_desc":
          cmp = b.reachRate - a.reachRate;
          break;
        case "maxSurplus_desc":
          cmp = b.maxSurplusMinutes - a.maxSurplusMinutes;
          break;
        default:
          break;
      }
      if (cmp !== 0) return cmp;
    }
    return (b.latestSubmissionId || "").localeCompare(a.latestSubmissionId || "");
  };
  aggregates.sort(compare);
  return aggregates.slice(0, limit).map((u) => u.userId);
}

export type SubmitFilters = Parameters<typeof getSubmissions>[1];

export function distributeVouchers(
  regionId: RegionId,
  params: {
    filters?: SubmitFilters;
    sortOrder: SortCriterion[];
    budget: number;
    priorityLabel: string;
    perPersonAmount: number;
  }
): { campaign: VoucherCampaign; vouchers: UserVoucher[]; error?: string } {
  const { filters, sortOrder, budget, priorityLabel, perPersonAmount } = params;
  if (!perPersonAmount || perPersonAmount <= 0) {
    return { campaign: {} as VoucherCampaign, vouchers: [], error: "1人あたりの金額を正しく入力してください。" };
  }
  const maxRecipients = Math.floor(budget / perPersonAmount);
  if (maxRecipients <= 0) {
    return { campaign: {} as VoucherCampaign, vouchers: [], error: "予算が1人あたり金額より少ないです。" };
  }
  const userIds = getTopUserIdsByPriority(regionId, filters, sortOrder, maxRecipients);
  const totalAmount = userIds.length * perPersonAmount;
  if (totalAmount > budget) {
    return {
      campaign: {} as VoucherCampaign,
      vouchers: [],
      error: `予算（${budget.toLocaleString()}円）を超えます。${userIds.length}人×${perPersonAmount.toLocaleString()}円＝${totalAmount.toLocaleString()}円`,
    };
  }
  const campaignId = `camp-${Date.now()}`;
  const distributedAt = new Date().toISOString();
  const campaign: VoucherCampaign = {
    id: campaignId,
    regionId,
    budget,
    priorityLabel,
    totalAmount,
    perPersonAmount,
    distributedUserIds: userIds,
    distributedAt,
  };
  campaigns.push(campaign);
  const vouchers: UserVoucher[] = [];
  for (const userId of userIds) {
    const v: UserVoucher = {
      id: `v-${campaignId}-${userId}`,
      userId,
      regionId,
      campaignId,
      amount: perPersonAmount,
      distributedAt,
      remainingAmount: perPersonAmount,
    };
    userVouchers.push(v);
    vouchers.push(v);
  }
  return { campaign, vouchers };
}

export function getUserVouchers(userId: string): UserVoucher[] {
  return userVouchers.filter((v) => v.userId === userId && v.remainingAmount > 0);
}

export function getCampaigns(regionId: RegionId): VoucherCampaign[] {
  return campaigns.filter((c) => c.regionId === regionId);
}
