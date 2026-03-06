import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import sax from "sax";
import { format } from "date-fns";

const prisma = new PrismaClient();

const WORKOUT_MAP: Record<string, string> = {
  HKWorkoutActivityTypeRunning: "Running",
  HKWorkoutActivityTypeWalking: "Walking",
  HKWorkoutActivityTypeCycling: "Cycling",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Strength Training",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Functional Strength",
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

interface WorkoutEntry {
  date: string; workoutType: string; durationMin: number;
  caloriesBurned: number | null; distance: number | null; distanceUnit: string | null;
  startTime: string | null;
}

const workoutBatch: WorkoutEntry[] = [];
let inWorkout = false;

async function main() {
  console.log("Re-importing workouts only...");

  const stream = createReadStream(xmlPath, { encoding: "utf-8" });
  const parser = sax.createStream(true, { trim: true });

  parser.on("opentag", (node) => {
    if (node.name === "Workout") {
      const attrs = node.attributes as Record<string, string>;
      if (!attrs.workoutActivityType || !attrs.startDate) return;

      const date = format(new Date(attrs.startDate), "yyyy-MM-dd");
      const workoutType = WORKOUT_MAP[attrs.workoutActivityType] || attrs.workoutActivityType.replace("HKWorkoutActivityType", "");
      const durationMin = parseFloat(attrs.duration) || 0;

      workoutBatch.push({
        date, workoutType,
        durationMin: Math.round(durationMin * 10) / 10,
        caloriesBurned: null, distance: null, distanceUnit: null,
        startTime: attrs.startDate,
      });
      inWorkout = true;
    }

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

  console.log(`Found ${workoutBatch.length} workouts. Inserting...`);

  // Sample a few to verify
  for (const w of workoutBatch.slice(0, 3)) {
    console.log(`  ${w.date} ${w.workoutType}: ${w.durationMin} min, ${w.caloriesBurned} cal, ${w.distance} mi`);
  }

  for (const w of workoutBatch) {
    await prisma.workout.create({
      data: {
        date: w.date, workoutType: w.workoutType, durationMin: w.durationMin,
        caloriesBurned: w.caloriesBurned, distance: w.distance,
        distanceUnit: w.distanceUnit, startTime: w.startTime, source: "apple_health",
      },
    });
  }

  console.log(`Done! ${workoutBatch.length} workouts imported.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
