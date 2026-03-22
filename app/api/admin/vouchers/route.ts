import { NextRequest, NextResponse } from "next/server";
import { distributeVouchers } from "@/lib/admin-store";
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

/** 行政：地域振興券を配布。予算と1人あたりで人数を自動計算し、優先順位（複数条件ソート）の上位から配布。 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      regionId,
      filters,
      sortOrder,
      budget,
      priorityLabel,
      perPersonAmount,
    } = body as {
      regionId: RegionId;
      filters?: {
        displayName?: string;
        ageMin?: number;
        ageMax?: number;
        reachedTarget?: boolean;
        startLabel?: string;
        destinationName?: string;
      };
      sortOrder?: string[];
      budget: number;
      priorityLabel: string;
      perPersonAmount: number;
    };
    if (!REGIONS.includes(regionId)) {
      return NextResponse.json({ error: "Invalid regionId" }, { status: 400 });
    }
    const order = (Array.isArray(sortOrder) ? sortOrder : []).filter((k) =>
      SORT_CRITERIA.includes(k as SortCriterion)
    ) as SortCriterion[];
    const result = distributeVouchers(regionId, {
      filters: filters ?? undefined,
      sortOrder: order,
      budget: Number(budget) || 0,
      priorityLabel: String(priorityLabel ?? ""),
      perPersonAmount: Number(perPersonAmount) || 0,
    });
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      campaign: result.campaign,
      vouchers: result.vouchers,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
