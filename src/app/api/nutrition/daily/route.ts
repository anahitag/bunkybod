import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const entries = await prisma.foodEntry.findMany({
    where: { userId: profile.id, date },
    orderBy: { createdAt: "asc" },
  });

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
      fiberG: acc.fiberG + e.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );

  return NextResponse.json({
    date,
    totals: {
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG),
      carbsG: Math.round(totals.carbsG),
      fatG: Math.round(totals.fatG),
      fiberG: Math.round(totals.fiberG),
    },
    targets: {
      calories: profile.calorieTarget,
      proteinG: profile.proteinTargetG,
      carbsG: profile.carbTargetG,
      fatG: profile.fatTargetG,
      fiberG: profile.fiberTargetG,
    },
    entries,
  });
}
