import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { format } from "date-fns";

const TYPE_MAP: Record<string, string> = {
  "step_count": "steps",
  "steps": "steps",
  "active_energy": "activeCalories",
  "active_energy_burned": "activeCalories",
  "resting_heart_rate": "restingHR",
  "heart_rate": "heartRate",
  "heart_rate_variability": "hrv",
  "exercise_time": "exerciseMinutes",
  "apple_exercise_time": "exerciseMinutes",
  "weight": "weight",
  "body_mass": "weight",
  "vo2_max": "vo2Max",
  "flights_climbed": "flightsClimbed",
  "walking_running_distance": "distanceWalkRun",
  "distance_walking_running": "distanceWalkRun",
  "sleep_analysis": "sleepMinutes",
};

// Metrics that should be summed per day (not averaged/replaced)
const CUMULATIVE_TYPES = new Set(["steps", "activeCalories", "exerciseMinutes", "distanceWalkRun", "flightsClimbed"]);
// Metrics that should be averaged per day
const AVERAGE_TYPES = new Set(["restingHR", "hrv", "vo2Max", "heartRate", "weight"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Webhook received. Top keys:", Object.keys(body));

    const rawMetrics = body.data?.metrics || body.metrics || (Array.isArray(body) ? body : []);
    const rawWorkouts = body.data?.workouts || body.workouts || [];

    console.log(`Raw metrics: ${rawMetrics.length}, workouts: ${rawWorkouts.length}`);

    // Accumulate all data points by date+type before saving
    const accumulator: Record<string, { sum: number; count: number; unit: string }> = {};

    for (const metric of rawMetrics) {
      const metricName = (metric.name || metric.type || "").toLowerCase().replace(/\s+/g, "_");
      const normalizedType = TYPE_MAP[metricName];
      if (!normalizedType) continue;

      // Health Auto Export nests data points in a "data" array
      const dataPoints = Array.isArray(metric.data) ? metric.data : [metric];

      // Log sources for debugging
      if (normalizedType === "steps" && dataPoints.length > 0) {
        const sources = [...new Set(dataPoints.map((p: Record<string, string>) => p.source || "unknown"))];
        console.log(`Step sources for ${metricName}: ${sources.join(", ")} (${dataPoints.length} points)`);
      }

      for (const point of dataPoints) {
        // Only use Apple Watch data for cumulative metrics to avoid double-counting
        if (CUMULATIVE_TYPES.has(normalizedType)) {
          const source = (point.source || metric.source || "").toLowerCase();
          // Accept if source contains "watch" OR if no source specified (trust the data)
          if (source && !source.includes("watch") && !source.includes("auto export")) continue;
        }

        let value: number;
        if (normalizedType === "heartRate" && point.Avg != null) {
          value = parseFloat(point.Avg);
        } else if (normalizedType === "sleepMinutes" && point.asleep != null) {
          value = parseFloat(point.asleep);
        } else {
          value = parseFloat(point.qty ?? point.value ?? point.sum ?? "0");
        }

        if (isNaN(value) || value === 0) continue;

        const dateStr = point.date || metric.date;
        if (!dateStr) continue;

        let date: string;
        try {
          date = format(new Date(dateStr), "yyyy-MM-dd");
        } catch {
          continue;
        }

        const key = `${date}::${normalizedType}`;
        if (!accumulator[key]) {
          accumulator[key] = { sum: 0, count: 0, unit: metric.units || "" };
        }
        accumulator[key].sum += value;
        accumulator[key].count += 1;
      }
    }

    // Now save accumulated values
    let metricsCount = 0;
    for (const [key, data] of Object.entries(accumulator)) {
      const [date, type] = key.split("::");

      // For cumulative metrics: use sum. For average metrics: use average
      const value = CUMULATIVE_TYPES.has(type)
        ? Math.round(data.sum)
        : Math.round((data.sum / data.count) * 10) / 10;

      await prisma.healthMetric.upsert({
        where: { date_type: { date, type } },
        create: { date, type, value, unit: data.unit, source: "webhook" },
        update: { value },
      });
      metricsCount++;
    }

    // Process workouts
    let workoutsCount = 0;
    for (const w of rawWorkouts) {
      const dateStr = w.start || w.date;
      if (!dateStr) continue;

      let date: string;
      try {
        date = format(new Date(dateStr), "yyyy-MM-dd");
      } catch {
        continue;
      }

      const durationSec = parseFloat(w.duration || "0");
      const durationMin = durationSec > 300 ? durationSec / 60 : durationSec; // if > 300 assume seconds

      await prisma.workout.create({
        data: {
          date,
          workoutType: w.name || w.type || "Unknown",
          durationMin: Math.round(durationMin * 10) / 10,
          caloriesBurned: w.activeEnergyBurned?.qty ? parseFloat(w.activeEnergyBurned.qty) : null,
          avgHeartRate: w.heartRate?.Avg ? parseFloat(w.heartRate.Avg) : null,
          maxHeartRate: w.heartRate?.Max ? parseFloat(w.heartRate.Max) : null,
          distance: w.distance?.qty ? parseFloat(w.distance.qty) : null,
          distanceUnit: w.distance?.units || "mi",
          startTime: dateStr,
          source: "webhook",
        },
      });
      workoutsCount++;
    }

    console.log(`Webhook processed: ${metricsCount} daily metrics, ${workoutsCount} workouts`);
    return NextResponse.json({ success: true, metricsCount, workoutsCount });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
