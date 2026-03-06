import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const profile = await prisma.userProfile.findFirst();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    dates.push(format(subDays(today, i), "yyyy-MM-dd"));
  }

  const entries = await prisma.foodEntry.findMany({
    where: {
      userId: profile.id,
      date: { in: dates },
    },
  });

  const dailyData = dates.map((date) => {
    const dayEntries = entries.filter((e) => e.date === date);
    const calories = Math.round(dayEntries.reduce((s, e) => s + e.calories, 0));
    const proteinG = Math.round(dayEntries.reduce((s, e) => s + e.proteinG, 0));
    const carbsG = Math.round(dayEntries.reduce((s, e) => s + e.carbsG, 0));
    const fatG = Math.round(dayEntries.reduce((s, e) => s + e.fatG, 0));
    const hasEntries = dayEntries.length > 0;

    // Adherence: within 10% of target = green, within 20% = yellow, else red
    let adherence: "none" | "green" | "yellow" | "red" = "none";
    if (hasEntries) {
      const calDiff = Math.abs(calories - profile.calorieTarget) / profile.calorieTarget;
      const protDiff = Math.abs(proteinG - profile.proteinTargetG) / profile.proteinTargetG;
      const avgDiff = (calDiff + protDiff) / 2;
      if (avgDiff <= 0.1) adherence = "green";
      else if (avgDiff <= 0.25) adherence = "yellow";
      else adherence = "red";
    }

    return { date, calories, proteinG, carbsG, fatG, hasEntries, adherence };
  });

  const daysWithEntries = dailyData.filter((d) => d.hasEntries);
  const avgCalories = daysWithEntries.length > 0
    ? Math.round(daysWithEntries.reduce((s, d) => s + d.calories, 0) / daysWithEntries.length)
    : 0;
  const avgProtein = daysWithEntries.length > 0
    ? Math.round(daysWithEntries.reduce((s, d) => s + d.proteinG, 0) / daysWithEntries.length)
    : 0;
  const adherenceRate = daysWithEntries.length > 0
    ? Math.round((daysWithEntries.filter((d) => d.adherence === "green").length / daysWithEntries.length) * 100)
    : 0;

  return NextResponse.json({
    dailyData,
    summary: {
      avgCalories,
      avgProtein,
      adherenceRate,
      daysTracked: daysWithEntries.length,
      totalDays: days,
    },
    targets: {
      calories: profile.calorieTarget,
      proteinG: profile.proteinTargetG,
    },
  });
}
