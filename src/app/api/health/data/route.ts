import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    dates.push(format(subDays(today, i), "yyyy-MM-dd"));
  }

  const [metrics, workouts] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { date: { in: dates } },
      orderBy: { date: "asc" },
    }),
    prisma.workout.findMany({
      where: { date: { in: dates } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Build daily summary
  const daily = dates.map((date) => {
    const dayMetrics = metrics.filter((m) => m.date === date);
    const dayWorkouts = workouts.filter((w) => w.date === date);

    const get = (type: string) => dayMetrics.find((m) => m.type === type)?.value ?? null;

    return {
      date,
      steps: get("steps"),
      activeCalories: get("activeCalories"),
      restingHR: get("restingHR"),
      hrv: get("hrv"),
      exerciseMinutes: get("exerciseMinutes"),
      sleepMinutes: get("sleep") || get("sleepMinutes"),
      distanceWalkRun: get("distanceWalkRun"),
      flightsClimbed: get("flightsClimbed"),
      vo2Max: get("vo2Max"),
      weight: get("weight"),
      workouts: dayWorkouts.map((w) => ({
        type: w.workoutType,
        durationMin: w.durationMin,
        calories: w.caloriesBurned,
        avgHR: w.avgHeartRate,
        maxHR: w.maxHeartRate,
        distance: w.distance,
      })),
    };
  });

  // Compute averages for days with data
  const withSteps = daily.filter((d) => d.steps != null);
  const withHR = daily.filter((d) => d.restingHR != null);
  const withSleep = daily.filter((d) => d.sleepMinutes != null);

  const summary = {
    avgSteps: withSteps.length > 0 ? Math.round(withSteps.reduce((s, d) => s + (d.steps || 0), 0) / withSteps.length) : null,
    avgRestingHR: withHR.length > 0 ? Math.round(withHR.reduce((s, d) => s + (d.restingHR || 0), 0) / withHR.length) : null,
    avgSleepHours: withSleep.length > 0 ? Math.round(withSleep.reduce((s, d) => s + (d.sleepMinutes || 0), 0) / withSleep.length / 60 * 10) / 10 : null,
    totalWorkouts: workouts.length,
    daysWithData: daily.filter((d) => d.steps != null || d.restingHR != null || d.exerciseMinutes != null).length,
  };

  return NextResponse.json({ daily, summary, workouts });
}
