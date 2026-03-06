import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import sax from "sax";
import { format } from "date-fns";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

const METRIC_MAP: Record<string, string> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierRestingHeartRate: "restingHR",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv",
  HKQuantityTypeIdentifierActiveEnergyBurned: "activeCalories",
  HKQuantityTypeIdentifierAppleExerciseTime: "exerciseMinutes",
  HKQuantityTypeIdentifierBodyMass: "weight",
  HKQuantityTypeIdentifierVO2Max: "vo2Max",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distanceWalkRun",
  HKQuantityTypeIdentifierFlightsClimbed: "flightsClimbed",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep",
};

const WORKOUT_MAP: Record<string, string> = {
  HKWorkoutActivityTypeRunning: "Running",
  HKWorkoutActivityTypeWalking: "Walking",
  HKWorkoutActivityTypeCycling: "Cycling",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Strength Training",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Strength Training",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
  HKWorkoutActivityTypeYoga: "Yoga",
  HKWorkoutActivityTypeSwimming: "Swimming",
  HKWorkoutActivityTypeElliptical: "Elliptical",
  HKWorkoutActivityTypeCoreTraining: "Core Training",
  HKWorkoutActivityTypeMixedCardio: "Mixed Cardio",
  HKWorkoutActivityTypePilates: "Pilates",
  HKWorkoutActivityTypeDance: "Dance",
  HKWorkoutActivityTypeRowing: "Rowing",
  HKWorkoutActivityTypeStairClimbing: "Stair Climbing",
  HKWorkoutActivityTypeCooldown: "Cooldown",
};

const xmlPath = process.argv[2] || "C:\\Users\\agharai\\Downloads\\apple_health_export\\export.xml";

// Accumulate daily metrics in memory, then batch upsert
const dailyMetrics: Record<string, Record<string, { sum: number; count: number; unit: string }>> = {};
const workoutBatch: {
  date: string; workoutType: string; durationMin: number;
  caloriesBurned: number | null; distance: number | null; distanceUnit: string | null;
  startTime: string | null; source: string; avgHeartRate: number | null; maxHeartRate: number | null;
}[] = [];

let recordCount = 0;
let workoutCount = 0;
let inWorkout = false;

async function main() {
  console.log(`Reading: ${xmlPath}`);
  console.log("This may take a few minutes for large files...\n");

  const stream = createReadStream(xmlPath, { encoding: "utf-8" });
  const parser = sax.createStream(true, { trim: true });

  parser.on("opentag", (node) => {
    if (node.name === "Record") {
      const attrs = node.attributes as Record<string, string>;
      const metricType = METRIC_MAP[attrs.type];
      if (!metricType || !attrs.startDate) return;

      // For cumulative metrics (steps, calories, distance, exercise, flights),
      // only use Apple Watch to avoid double-counting with iPhone
      const cumulativeTypes = ["steps", "activeCalories", "exerciseMinutes", "distanceWalkRun", "flightsClimbed"];
      if (cumulativeTypes.includes(metricType)) {
        const source = attrs.sourceName || "";
        if (!source.includes("Watch")) return; // skip iPhone records for these
      }

      const date = format(new Date(attrs.startDate), "yyyy-MM-dd");
      const value = parseFloat(attrs.value);
      if (isNaN(value)) return;

      if (!dailyMetrics[date]) dailyMetrics[date] = {};
      if (!dailyMetrics[date][metricType]) {
        dailyMetrics[date][metricType] = { sum: 0, count: 0, unit: attrs.unit || "" };
      }
      dailyMetrics[date][metricType].sum += value;
      dailyMetrics[date][metricType].count += 1;
      recordCount++;

      if (recordCount % 500000 === 0) {
        console.log(`  Processed ${(recordCount / 1000000).toFixed(1)}M records...`);
      }
    }

    if (node.name === "Workout") {
      const attrs = node.attributes as Record<string, string>;
      if (!attrs.workoutActivityType || !attrs.startDate) return;

      const date = format(new Date(attrs.startDate), "yyyy-MM-dd");
      const workoutType = WORKOUT_MAP[attrs.workoutActivityType] || attrs.workoutActivityType.replace("HKWorkoutActivityType", "");
      // duration is already in minutes (durationUnit="min")
      const durationMin = parseFloat(attrs.duration) || 0;

      workoutBatch.push({
        date,
        workoutType,
        durationMin: Math.round(durationMin * 10) / 10,
        caloriesBurned: null,
        distance: null,
        distanceUnit: null,
        startTime: attrs.startDate,
        source: attrs.sourceName || "unknown",
        avgHeartRate: null,
        maxHeartRate: null,
      });
      inWorkout = true;
      workoutCount++;
    }

    // Parse WorkoutStatistics for calories, distance, heart rate
    if (node.name === "WorkoutStatistics" && inWorkout && workoutBatch.length > 0) {
      const attrs = node.attributes as Record<string, string>;
      const current = workoutBatch[workoutBatch.length - 1];
      if (attrs.type === "HKQuantityTypeIdentifierActiveEnergyBurned") {
        current.caloriesBurned = parseFloat(attrs.sum) || null;
      }
      if (attrs.type?.includes("Distance")) {
        current.distance = parseFloat(attrs.sum) || null;
        current.distanceUnit = "mi";
      }
      if (attrs.type === "HKQuantityTypeIdentifierHeartRate") {
        current.avgHeartRate = parseFloat(attrs.average) || null;
        current.maxHeartRate = parseFloat(attrs.maximum) || null;
      }
    }
  });

  parser.on("closetag", (name) => {
    if (name === "Workout") inWorkout = false;
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("end", resolve);
    parser.on("error", reject);
    stream.pipe(parser);
  });

  console.log(`\nParsing complete: ${recordCount.toLocaleString()} records, ${workoutCount} workouts`);
  console.log(`Unique days: ${Object.keys(dailyMetrics).length}`);

  // Batch upsert metrics
  console.log("\nUpserting daily metrics...");
  let metricsUpserted = 0;
  const dates = Object.keys(dailyMetrics).sort();

  for (const date of dates) {
    for (const [type, data] of Object.entries(dailyMetrics[date])) {
      const isAverage = ["restingHR", "hrv", "vo2Max", "weight"].includes(type);
      const value = isAverage
        ? Math.round((data.sum / data.count) * 10) / 10
        : Math.round(data.sum);

      await prisma.healthMetric.upsert({
        where: { date_type: { date, type } },
        create: { date, type, value, unit: data.unit, source: "apple_health" },
        update: { value, unit: data.unit },
      });
      metricsUpserted++;
    }

    if (metricsUpserted % 1000 === 0) {
      console.log(`  ${metricsUpserted} metrics saved...`);
    }
  }

  // Deduplicate workouts — if two workouts of the same type on the same day overlap
  // (start times within 10 min), keep the one from Apple Watch (has HR data) or the longer one
  console.log("\nDeduplicating workouts...");
  const deduped: typeof workoutBatch = [];
  for (const w of workoutBatch) {
    const existing = deduped.find(
      (d) =>
        d.date === w.date &&
        d.workoutType === w.workoutType &&
        Math.abs(new Date(d.startTime || "").getTime() - new Date(w.startTime || "").getTime()) < 10 * 60 * 1000 // within 10 min
    );
    if (existing) {
      // Keep the one with more data (HR, longer duration, more calories)
      if (
        (w.avgHeartRate && !existing.avgHeartRate) ||
        (w.caloriesBurned && !existing.caloriesBurned) ||
        w.durationMin > existing.durationMin
      ) {
        // Replace existing with this one
        const idx = deduped.indexOf(existing);
        deduped[idx] = w;
      }
      // Otherwise skip this duplicate
    } else {
      deduped.push(w);
    }
  }
  console.log(`  ${workoutBatch.length} raw → ${deduped.length} after dedup (removed ${workoutBatch.length - deduped.length} duplicates)`);

  // Insert workouts
  console.log("\nInserting workouts...");
  for (const w of deduped) {
    await prisma.workout.create({
      data: {
        date: w.date,
        workoutType: w.workoutType,
        durationMin: w.durationMin,
        caloriesBurned: w.caloriesBurned,
        avgHeartRate: w.avgHeartRate,
        maxHeartRate: w.maxHeartRate,
        distance: w.distance,
        distanceUnit: w.distanceUnit,
        startTime: w.startTime,
        source: w.source,
      },
    });
  }

  console.log(`\nDone!`);
  console.log(`  Metrics: ${metricsUpserted} daily entries`);
  console.log(`  Workouts: ${deduped.length} (${workoutBatch.length - deduped.length} duplicates removed)`);
  console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
