import { NextRequest, NextResponse } from "next/server";
import { addSubmission, getSubmissions } from "@/lib/admin-store";
import type { RegionId } from "@/lib/admin-store";

const REGIONS: RegionId[] = ["hamamatsu", "kushimoto"];

function parseBody(
  log: unknown,
  userId: string,
  displayName?: string,
  age?: number | null,
  startLabel?: string
) {
  const o = log as Record<string, unknown>;
  const start = o.start as { lat: number; lng: number };
  const dest = o.destination as { name: string; lat: number; lng: number };
  const targetMinutes = Number(o.targetMinutes) || 0;
  const remainingSeconds = Number(o.remainingSeconds) ?? 0;
  const durationSeconds = targetMinutes * 60 - remainingSeconds;
  const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10;
  const reachedTarget = remainingSeconds >= 0;
  return {
    regionId: o.regionId as RegionId,
    userId,
    displayName: typeof displayName === "string" ? displayName : "匿名",
    age: age ?? null,
    startLabel: typeof startLabel === "string" && startLabel.trim() ? startLabel.trim() : "スタート",
    start: start ?? { lat: 0, lng: 0 },
    destinationName: dest?.name ?? "",
    destination: dest ? { lat: dest.lat, lng: dest.lng } : { lat: 0, lng: 0 },
    targetMinutes,
    durationMinutes,
    reachedTarget,
    submittedAt: new Date().toISOString(),
    logId: String(o.id ?? ""),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  if (!REGIONS.includes(regionId as RegionId)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { log, userId, displayName, age, startLabel } = body;
    if (!log || !userId) {
      return NextResponse.json({ error: "log and userId required" }, { status: 400 });
    }
    const entry = parseBody(log, userId, displayName, age, startLabel);
    entry.regionId = regionId as RegionId;
    const added = addSubmission(regionId as RegionId, entry);
    return NextResponse.json({ ok: true, id: added.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  if (!REGIONS.includes(regionId as RegionId)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
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
  const list = getSubmissions(regionId as RegionId, filters);
  return NextResponse.json(list);
}
