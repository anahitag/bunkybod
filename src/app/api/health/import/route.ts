import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { format } from "date-fns";

// Apple Health XML record types we care about
const METRIC_MAP: Record<string, string> = {
  "HKQuantityTypeIdentifierStepCount": "steps",
  "HKQuantityTypeIdentifierRestingHeartRate": "restingHR",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": "hrv",
  "HKQuantityTypeIdentifierActiveEnergyBurned": "activeCalories",
  "HKQuantityTypeIdentifierAppleExerciseTime": "exerciseMinutes",
  "HKQuantityTypeIdentifierBodyMass": "weight",
  "HKQuantityTypeIdentifierVO2Max": "vo2Max",
  "HKQuantityTypeIdentifierDistanceWalkingRunning": "distanceWalkRun",
  "HKQuantityTypeIdentifierFlightsClimbed": "flightsClimbed",
  "HKQuantityTypeIdentifierHeartRate": "heartRate",
  "HKCategoryTypeIdentifierSleepAnalysis": "sleep",
};

const WORKOUT_TYPE_MAP: Record<string, string> = {
  "HKWorkoutActivityTypeRunning": "Running",
  "HKWorkoutActivityTypeWalking": "Walking",
  "HKWorkoutActivityTypeCycling": "Cycling",
  "HKWorkoutActivityTypeTraditionalStrengthTraining": "Strength Training",
  "HKWorkoutActivityTypeFunctionalStrengthTraining": "Functional Strength",
  "HKWorkoutActivityTypeHighIntensityIntervalTraining": "HIIT",
  "HKWorkoutActivityTypeYoga": "Yoga",
  "HKWorkoutActivityTypeSwimming": "Swimming",
  "HKWorkoutActivityTypeElliptical": "Elliptical",
  "HKWorkoutActivityTypeRowing": "Rowing",
  "HKWorkoutActivityTypeStairClimbing": "Stair Climbing",
  "HKWorkoutActivityTypePilates": "Pilates",
  "HKWorkoutActivityTypeDance": "Dance",
  "HKWorkoutActivityTypeCooldown": "Cooldown",
  "HKWorkoutActivityTypeCoreTraining": "Core Training",
  "HKWorkoutActivityTypeMixedCardio": "Mixed Cardio",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const text = await file.text();

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

    let parsed;
    try {
      parsed = parser.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid XML file" }, { status: 400 });
    }

    const healthData = parsed.HealthData;
    if (!healthData) {
      return NextResponse.json({ error: "Not an Apple Health export file" }, { status: 400 });
    }

    const records = Array.isArray(healthData.Record) ? healthData.Record : [healthData.Record].filter(Boolean);
    const workouts = Array.isArray(healthData.Workout) ? healthData.Workout : [healthData.Workout].filter(Boolean);

    // Aggregate daily metrics
    const dailyMetrics: Record<string, Record<string, { sum: number; count: number; unit: string }>> = {};

    let processedRecords = 0;

    for (const record of records) {
      if (!record || !record.type) continue;
      const metricType = METRIC_MAP[record.type];
      if (!metricType) continue;

      const date = record.startDate ? format(new Date(record.startDate), "yyyy-MM-dd") : null;
      if (!date) continue;

      const value = parseFloat(record.value);
      if (isNaN(value)) continue;

      if (!dailyMetrics[date]) dailyMetrics[date] = {};
      if (!dailyMetrics[date][metricType]) {
        dailyMetrics[date][metricType] = { sum: 0, count: 0, unit: record.unit || "" };
      }

      // For heart rate, resting HR, HRV — average; for steps, calories, distance — sum
      if (["restingHR", "hrv", "vo2Max", "heartRate", "weight"].includes(metricType)) {
        dailyMetrics[date][metricType].sum += value;
        dailyMetrics[date][metricType].count += 1;
      } else {
        dailyMetrics[date][metricType].sum += value;
        dailyMetrics[date][metricType].count += 1;
      }

      processedRecords++;
    }

    // Upsert daily metrics
    let metricsUpserted = 0;
    for (const [date, metrics] of Object.entries(dailyMetrics)) {
      for (const [type, data] of Object.entries(metrics)) {
        const value = ["restingHR", "hrv", "vo2Max", "heartRate", "weight"].includes(type)
          ? Math.round((data.sum / data.count) * 10) / 10  // average
          : Math.round(data.sum);  // sum

        await prisma.healthMetric.upsert({
          where: { date_type: { date, type } },
          create: { date, type, value, unit: data.unit, source: "apple_health" },
          update: { value, unit: data.unit },
        });
        metricsUpserted++;
      }
    }

    // Process workouts
    let workoutsImported = 0;
    for (const workout of workouts) {
      if (!workout || !workout.workoutActivityType) continue;

      const date = workout.startDate ? format(new Date(workout.startDate), "yyyy-MM-dd") : null;
      if (!date) continue;

      const workoutType = WORKOUT_TYPE_MAP[workout.workoutActivityType] || workout.workoutActivityType.replace("HKWorkoutActivityType", "");
      const durationSec = parseFloat(workout.duration) || 0;
      const calories = parseFloat(workout.totalEnergyBurned) || null;
      const distance = parseFloat(workout.totalDistance) || null;

      await prisma.workout.create({
        data: {
          date,
          workoutType,
          durationMin: Math.round(durationSec / 60 * 10) / 10,
          caloriesBurned: calories,
          distance,
          distanceUnit: workout.totalDistanceUnit || "mi",
          startTime: workout.startDate || null,
          source: "apple_health",
        },
      });
      workoutsImported++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRecords: records.length,
        processedRecords,
        metricsUpserted,
        workoutsImported,
        dateRange: {
          earliest: Object.keys(dailyMetrics).sort()[0],
          latest: Object.keys(dailyMetrics).sort().pop(),
        },
      },
    });
  } catch (error) {
    console.error("Health import error:", error);
    return NextResponse.json({ error: "Import failed. Check file format." }, { status: 500 });
  }
}
