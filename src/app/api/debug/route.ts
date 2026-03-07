import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getToday, getDaysAgo } from "@/lib/date";

export async function GET() {
  try {
    const today = getToday();
    const profile = await prisma.userProfile.findFirst();

    // Check food entries per day
    const dayChecks: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = getDaysAgo(i);
      const count = await prisma.foodEntry.count({ where: { date: d } });
      dayChecks[d] = count;
    }

    // Calculate streak
    let streak = 0;
    const startOffset = dayChecks[today] === 0 ? 1 : 0;
    for (let i = startOffset; i < 7; i++) {
      const d = getDaysAgo(i);
      if (dayChecks[d] > 0) streak++;
      else break;
    }

    return NextResponse.json({
      today,
      profile: profile ? { name: profile.name, id: profile.id } : null,
      foodByDay: dayChecks,
      calculatedStreak: streak,
      startOffset,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message });
  }
}
