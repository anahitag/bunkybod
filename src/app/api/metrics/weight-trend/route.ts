import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "90");

  const profile = await prisma.userProfile.findFirst();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const logs = await prisma.weightLog.findMany({
    where: { userId: profile.id },
    orderBy: { date: "asc" },
    take: days,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      date: l.date,
      weightLbs: Math.round(l.weightKg * 2.20462 * 10) / 10,
    })),
    currentWeightLbs: profile.currentWeightKg
      ? Math.round(profile.currentWeightKg * 2.20462 * 10) / 10
      : null,
  });
}
