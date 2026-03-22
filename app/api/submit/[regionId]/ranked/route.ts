import { NextRequest, NextResponse } from "next/server";
import { getUserAggregates, getTopUserIdsByPriority } from "@/lib/admin-store";
import type { RegionId, SortCriterion } from "@/lib/admin-store";
import { REGION_IDS_FOR_HISTORY } from "@/lib/regions";

const REGIONS: RegionId[] = [...REGION_IDS_FOR_HISTORY];
const SORT_CRITERIA: SortCriterion[] = [
  "age_desc",
  "age_asc",
  "start_asc",
  "start_desc",
  "reachRate_desc",
  "maxSurplus_desc",
];

/** 行政：フィルター＋優先順位でソートした上位ユーザー一覧（配布プレビュー用） */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  if (!REGIONS.includes(regionId as RegionId)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 10));
  const sortOrderRaw = searchParams.get("sortOrder");
  const order = (sortOrderRaw ? sortOrderRaw.split(",") : []).filter((k) =>
    SORT_CRITERIA.includes(k as SortCriterion)
  ) as SortCriterion[];
  const filters = {
    displayName: searchParams.get("displayName") ?? undefined,
    ageMin: searchParams.get("ageMin") ? Number(searchParams.get("ageMin")) : undefined,
    ageMax: searchParams.get("ageMax") ? Number(searchParams.get("ageMax")) : undefined,
    reachedTarget:
      searchParams.get("reachedTarget") === "true"
        ? true
        : searchParams.get("reachedTarget") === "false"
          ? false
          : undefined,
    startLabel: searchParams.get("startLabel") ?? undefined,
    destinationName: searchParams.get("destinationName") ?? undefined,
  };
  const aggregates = getUserAggregates(regionId as RegionId, filters);
  const userIds = getTopUserIdsByPriority(regionId as RegionId, filters, order, limit);
  const byId = new Map(aggregates.map((a) => [a.userId, a]));
  const ranked = userIds.map((userId) => byId.get(userId)).filter(Boolean);
  return NextResponse.json(ranked);
}
