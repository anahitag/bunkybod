import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { getToday } from "@/lib/date";

export async function GET(request: NextRequest) {
  const endDate = request.nextUrl.searchParams.get("endDate") || getToday();

  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(format(subDays(new Date(endDate + "T12:00:00"), i), "yyyy-MM-dd"));
  }

  const entries = await prisma.foodEntry.findMany({
    where: {
      userId: profile.id,
      date: { in: dates },
    },
  });

  const days = dates.map((date) => {
    const dayEntries = entries.filter((e) => e.date === date);
    return {
      date,
      calories: Math.round(dayEntries.reduce((s, e) => s + e.calories, 0)),
      proteinG: Math.round(dayEntries.reduce((s, e) => s + e.proteinG, 0)),
      carbsG: Math.round(dayEntries.reduce((s, e) => s + e.carbsG, 0)),
      fatG: Math.round(dayEntries.reduce((s, e) => s + e.fatG, 0)),
    };
  });

  return NextResponse.json({
    days,
    targets: {
      calories: profile.calorieTarget,
      proteinG: profile.proteinTargetG,
      carbsG: profile.carbTargetG,
      fatG: profile.fatTargetG,
    },
  });
}
