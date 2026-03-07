import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { getToday, getDaysAgo } from "@/lib/date";
import OpenAI from "openai";

const getClient = () =>
  new OpenAI({
    baseURL: process.env.AI_PROXY_URL || "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN,
    timeout: 50000,
  });

export const maxDuration = 60;

// Simple in-memory cache — regenerate once per day or on manual refresh
let cachedInsights: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";

  if (cachedInsights && !forceRefresh && Date.now() - cachedInsights.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedInsights.data);
  }

  try {
    const profile = await prisma.userProfile.findFirst();
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const today = getToday();
    const thirtyAgo = getDaysAgo(30);
    const fourteenAgo = getDaysAgo(14);

    // Fetch all data in parallel
    const [dexaScans, recentMetrics, recentWorkouts, recentEntries] = await Promise.all([
      prisma.dexaScan.findMany({ orderBy: { scanDate: "desc" }, take: 3 }),
      prisma.healthMetric.findMany({ where: { date: { gte: thirtyAgo } } }),
      prisma.workout.findMany({ where: { date: { gte: thirtyAgo } }, orderBy: { date: "desc" } }),
      prisma.foodEntry.findMany({ where: { userId: profile.id, date: { gte: fourteenAgo } } }),
    ]);

    // Build context
    let context = `USER: ${profile.name}, Goal: ${profile.goalType}, Targets: ${profile.calorieTarget} cal, ${profile.proteinTargetG}g protein\n`;
    if (profile.currentWeightKg) context += `Weight: ${Math.round(profile.currentWeightKg * 2.20462)} lbs\n`;

    // DEXA
    if (dexaScans.length > 0) {
      const latest = dexaScans[0];
      context += `\nLATEST DEXA (${latest.scanDate}): ${latest.bodyFatPct}% BF, ${Math.round(latest.leanMassLbs)} lbs lean, ${Math.round(latest.fatMassLbs)} lbs fat`;
      if (dexaScans.length >= 2) {
        const prev = dexaScans[1];
        context += `\nPREVIOUS DEXA (${prev.scanDate}): ${prev.bodyFatPct}% BF, ${Math.round(prev.leanMassLbs)} lbs lean, ${Math.round(prev.fatMassLbs)} lbs fat`;
        context += `\nCHANGE: BF ${(latest.bodyFatPct - prev.bodyFatPct).toFixed(1)}%, Lean ${(latest.leanMassLbs - prev.leanMassLbs).toFixed(1)} lbs, Fat ${(latest.fatMassLbs - prev.fatMassLbs).toFixed(1)} lbs`;
      }
    }

    // Activity averages
    const byType: Record<string, number[]> = {};
    for (const m of recentMetrics) {
      if (!byType[m.type]) byType[m.type] = [];
      byType[m.type].push(m.value);
    }
    const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

    if (Object.keys(byType).length > 0) {
      context += "\n\n30-DAY ACTIVITY AVERAGES:";
      if (byType.steps) context += `\nSteps: ${avg(byType.steps)}/day`;
      if (byType.activeCalories) context += `\nActive cal: ${avg(byType.activeCalories)}/day`;
      if (byType.exerciseMinutes) context += `\nExercise: ${avg(byType.exerciseMinutes)} min/day`;
      if (byType.restingHR) context += `\nResting HR: ${avg(byType.restingHR)} bpm`;
      if (byType.hrv) context += `\nHRV: ${avg(byType.hrv)} ms`;
    }

    context += `\nWorkouts in last 30 days: ${recentWorkouts.length}`;
    const workoutTypes: Record<string, number> = {};
    for (const w of recentWorkouts) {
      workoutTypes[w.workoutType] = (workoutTypes[w.workoutType] || 0) + 1;
    }
    if (Object.keys(workoutTypes).length > 0) {
      context += "\nBreakdown: " + Object.entries(workoutTypes).map(([t, c]) => `${t}: ${c}`).join(", ");
    }

    // Nutrition adherence
    const dates14: string[] = [];
    for (let i = 13; i >= 0; i--) dates14.push(format(subDays(new Date(), i), "yyyy-MM-dd"));

    const dailyTotals = dates14.map((date) => {
      const dayEntries = recentEntries.filter((e) => e.date === date);
      if (dayEntries.length === 0) return null;
      return {
        cal: Math.round(dayEntries.reduce((s, e) => s + e.calories, 0)),
        protein: Math.round(dayEntries.reduce((s, e) => s + e.proteinG, 0)),
      };
    }).filter(Boolean) as { cal: number; protein: number }[];

    if (dailyTotals.length > 0) {
      const avgCal = Math.round(dailyTotals.reduce((s, d) => s + d.cal, 0) / dailyTotals.length);
      const avgPro = Math.round(dailyTotals.reduce((s, d) => s + d.protein, 0) / dailyTotals.length);
      const onTargetCal = dailyTotals.filter((d) => Math.abs(d.cal - profile.calorieTarget) / profile.calorieTarget <= 0.1).length;
      const onTargetPro = dailyTotals.filter((d) => d.protein >= profile.proteinTargetG * 0.9).length;

      context += `\n\n14-DAY NUTRITION:`;
      context += `\nAvg cal: ${avgCal}/day (target: ${profile.calorieTarget})`;
      context += `\nAvg protein: ${avgPro}g/day (target: ${profile.proteinTargetG}g)`;
      context += `\nDays on calorie target: ${onTargetCal}/${dailyTotals.length}`;
      context += `\nDays hitting protein: ${onTargetPro}/${dailyTotals.length}`;
      context += `\nDays tracked: ${dailyTotals.length}/14`;
    }

    // Calculate streaks and weekly stats server-side (not GPT-estimated)
    const sevenAgo = getDaysAgo(7);
    const thisWeekWorkouts = recentWorkouts.filter((w) => w.date >= sevenAgo);
    const thisWeekMetrics = recentMetrics.filter((m) => m.date >= sevenAgo);

    // Steps avg this week
    const weekSteps = thisWeekMetrics.filter((m) => m.type === "steps");
    const avgStepsWeek = weekSteps.length > 0 ? Math.round(weekSteps.reduce((s, m) => s + m.value, 0) / weekSteps.length) : 0;

    // Active cal avg this week
    const weekCal = thisWeekMetrics.filter((m) => m.type === "activeCalories");
    const avgCalWeek = weekCal.length > 0 ? Math.round(weekCal.reduce((s, m) => s + m.value, 0) / weekCal.length) : 0;

    // Food logging streak — consecutive days going backwards, skip today if nothing logged yet
    let daysLoggedStreak = 0;
    let startOffset = 0;
    // If today has no entries, start counting from yesterday (today isn't over yet)
    if (!recentEntries.some((e) => e.date === today)) startOffset = 1;
    for (let i = startOffset; i < 30; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      if (recentEntries.some((e) => e.date === d)) daysLoggedStreak++;
      else break;
    }

    // Workout streak — consecutive days with a workout, skip today if no workout yet
    let workoutStreak = 0;
    let workoutStartOffset = 0;
    if (!recentWorkouts.some((w) => w.date === today)) workoutStartOffset = 1;
    for (let i = workoutStartOffset; i < 30; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      if (recentWorkouts.some((w) => w.date === d)) workoutStreak++;
      else break;
    }

    // Protein streak — consecutive days hitting 90%+ protein, skip today if no entries
    let proteinStreak = 0;
    let proteinStartOffset = 0;
    if (!recentEntries.some((e) => e.date === today)) proteinStartOffset = 1;
    for (let i = proteinStartOffset; i < 14; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dayEntries = recentEntries.filter((e) => e.date === d);
      if (dayEntries.length === 0) break;
      const dayProtein = dayEntries.reduce((s, e) => s + e.proteinG, 0);
      if (dayProtein >= profile.proteinTargetG * 0.9) proteinStreak++;
      else break;
    }

    // Body comp snapshot from latest DEXA
    const bodyCompSnapshot = dexaScans.length > 0 ? {
      bodyFatPct: dexaScans[0].bodyFatPct,
      leanMassLbs: Math.round(dexaScans[0].leanMassLbs),
      trend: dexaScans.length >= 2
        ? (dexaScans[0].bodyFatPct < dexaScans[1].bodyFatPct ? "improving" : dexaScans[0].bodyFatPct > dexaScans[1].bodyFatPct ? "declining" : "stable")
        : "stable",
    } : null;

    const serverStats = {
      streaks: { daysLogged: daysLoggedStreak, workoutStreak, proteinStreak },
      bodyCompSnapshot,
      weeklyActivity: { avgSteps: avgStepsWeek, avgCal: avgCalWeek, workouts: thisWeekWorkouts.length, stepsTrend: "stable" as string },
    };

    // Add server stats to context so GPT knows the real numbers
    context += `\n\nSERVER-CALCULATED STATS (use these exact numbers, do NOT change them):`;
    context += `\nFood logging streak: ${daysLoggedStreak} days`;
    context += `\nWorkout streak: ${workoutStreak} days`;
    context += `\nProtein streak: ${proteinStreak} days`;
    context += `\nThis week: ${thisWeekWorkouts.length} workouts, ${avgStepsWeek} avg steps`;

    // Call GPT for insights
    const client = getClient();
    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a personal fitness coach analyzing a user's health data. Based on their data, provide structured insights.

Return JSON:
{
  "highlights": ["short win — 1 sentence max", ...],
  "lowlights": ["short area to improve — 1 sentence max", ...],
  "recommendations": [
    {"title": "3-5 word title", "detail": "1 sentence action", "priority": "high" | "medium" | "low"}
  ],
  "goalProgress": {
    "summary": "1-2 sentence assessment",
    "score": number 1-10
  },
  "weeklyFocus": "One specific focus for this week"
}
NOTE: streaks, bodyCompSnapshot, and weeklyActivity are calculated server-side. Do NOT include them in your response.

Rules:
- Keep ALL text SHORT. Highlights/lowlights: 1 sentence max each. Recommendations: title is 3-5 words, detail is 1 sentence.
- Be specific and data-driven. Reference actual numbers.
- Highlights: 2-3 wins
- Lowlights: 1-2 areas to improve
- Recommendations: 2-3 actionable items, prioritized
- For streaks: estimate from the data provided. If unsure, use 0.
- For bodyCompSnapshot: use latest DEXA data. If no DEXA, use null values.
- For weeklyActivity: use the 7-day averages from activity data.
- Be encouraging but honest. No fluff.`,
        },
        { role: "user", content: context },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    let insights;
    try {
      insights = JSON.parse(text);
    } catch {
      insights = { highlights: [], lowlights: [], recommendations: [], goalProgress: { summary: "Unable to generate insights", score: 5 }, weeklyFocus: "Keep logging your food consistently" };
    }

    // Merge GPT insights with server-calculated stats
    const result = { ...insights, ...serverStats };
    cachedInsights = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Coach error:", error);
    // If we have stale cache, return it instead of an error
    if (cachedInsights) {
      return NextResponse.json(cachedInsights.data);
    }

    // Try to at least return server-calculated stats even if GPT failed
    try {
      const profile = await prisma.userProfile.findFirst();
      const today = getToday();
      const sevenAgo = getDaysAgo(7);
      const thirtyAgo = getDaysAgo(30);

      const [recentMetrics, recentWorkouts, recentEntries, dexaScans] = await Promise.all([
        prisma.healthMetric.findMany({ where: { date: { gte: thirtyAgo } } }),
        prisma.workout.findMany({ where: { date: { gte: thirtyAgo } }, orderBy: { date: "desc" } }),
        prisma.foodEntry.findMany({ where: { userId: profile?.id, date: { gte: format(subDays(new Date(), 14), "yyyy-MM-dd") } } }),
        prisma.dexaScan.findMany({ orderBy: { scanDate: "desc" }, take: 2 }),
      ]);

      const thisWeekMetrics = recentMetrics.filter((m) => m.date >= sevenAgo);
      const weekSteps = thisWeekMetrics.filter((m) => m.type === "steps");
      const weekCal = thisWeekMetrics.filter((m) => m.type === "activeCalories");
      const thisWeekWorkouts = recentWorkouts.filter((w) => w.date >= sevenAgo);

      let daysLoggedStreak = 0;
      let startOffset = !recentEntries.some((e) => e.date === today) ? 1 : 0;
      for (let i = startOffset; i < 30; i++) {
        if (recentEntries.some((e) => e.date === getDaysAgo(i))) daysLoggedStreak++;
        else break;
      }

      let workoutStreak = 0;
      let wStartOffset = !recentWorkouts.some((w) => w.date === today) ? 1 : 0;
      for (let i = wStartOffset; i < 30; i++) {
        if (recentWorkouts.some((w) => w.date === getDaysAgo(i))) workoutStreak++;
        else break;
      }

      const bodyCompSnapshot = dexaScans.length > 0 ? {
        bodyFatPct: dexaScans[0].bodyFatPct,
        leanMassLbs: Math.round(dexaScans[0].leanMassLbs),
        trend: dexaScans.length >= 2 ? (dexaScans[0].bodyFatPct < dexaScans[1].bodyFatPct ? "improving" : "stable") : "stable",
      } : null;

      return NextResponse.json({
        highlights: ["Your data is loading — check back in a moment"],
        lowlights: [],
        recommendations: [],
        goalProgress: { summary: "Analyzing your data...", score: 5 },
        weeklyFocus: "Keep up your consistency",
        streaks: { daysLogged: daysLoggedStreak, workoutStreak, proteinStreak: 0 },
        bodyCompSnapshot,
        weeklyActivity: {
          avgSteps: weekSteps.length > 0 ? Math.round(weekSteps.reduce((s, m) => s + m.value, 0) / weekSteps.length) : 0,
          avgCal: weekCal.length > 0 ? Math.round(weekCal.reduce((s, m) => s + m.value, 0) / weekCal.length) : 0,
          workouts: thisWeekWorkouts.length,
          stepsTrend: "stable",
        },
      });
    } catch {
      return NextResponse.json({
        highlights: ["Loading..."],
        lowlights: [],
        recommendations: [],
        goalProgress: { summary: "Loading...", score: 5 },
        weeklyFocus: "Check back soon",
        streaks: { daysLogged: 0, workoutStreak: 0, proteinStreak: 0 },
        bodyCompSnapshot: null,
        weeklyActivity: { avgSteps: 0, avgCal: 0, workouts: 0, stepsTrend: "stable" },
      });
    }
  }
}
