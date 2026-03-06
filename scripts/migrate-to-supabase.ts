import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const db = new Database("./prisma/dev.db");
const remote = new PrismaClient({
  datasourceUrl: "postgresql://postgres.kzpfqaezcgxnzbvkxpue:Lemondrop12345!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function migrate() {
  const rp = await remote.userProfile.findFirst();
  if (!rp) { console.log("No remote profile!"); return; }
  console.log("Remote profile:", rp.id);

  // Food entries
  const foods = db.prepare("SELECT * FROM FoodEntry").all() as Record<string, unknown>[];
  console.log("Food entries:", foods.length);
  for (const f of foods) {
    try {
      await remote.foodEntry.create({
        data: {
          userId: rp.id,
          date: f.date as string,
          mealType: (f.mealType as string) || "snack",
          foodName: (f.foodName as string) || "Unknown",
          servingSize: (f.servingSize as number) || 1,
          servingUnit: (f.servingUnit as string) || "serving",
          calories: (f.calories as number) || 0,
          proteinG: (f.proteinG as number) || 0,
          carbsG: (f.carbsG as number) || 0,
          fatG: (f.fatG as number) || 0,
          fiberG: (f.fiberG as number) || 0,
          sugarG: (f.sugarG as number) || 0,
          sodiumMg: (f.sodiumMg as number) || 0,
          loggedVia: (f.loggedVia as string) || "ai",
        },
      });
    } catch {}
  }
  console.log("Food done");

  // DEXA scans
  const dexas = db.prepare("SELECT * FROM DexaScan").all() as Record<string, unknown>[];
  console.log("DEXA scans:", dexas.length);
  for (const d of dexas) {
    try {
      await remote.dexaScan.create({
        data: {
          scanDate: d.scanDate as string,
          totalWeightLbs: d.totalWeightLbs as number | null,
          bodyFatPct: (d.bodyFatPct as number) || 0,
          leanMassLbs: (d.leanMassLbs as number) || 0,
          fatMassLbs: (d.fatMassLbs as number) || 0,
          boneMassLbs: d.boneMassLbs as number | null,
          visceralFat: d.visceralFat as number | null,
          trunkFatPct: d.trunkFatPct as number | null,
          armsFatPct: d.armsFatPct as number | null,
          legsFatPct: d.legsFatPct as number | null,
          trunkLeanLbs: d.trunkLeanLbs as number | null,
          armsLeanLbs: d.armsLeanLbs as number | null,
          legsLeanLbs: d.legsLeanLbs as number | null,
          trunkFatLbs: d.trunkFatLbs as number | null,
          armsFatLbs: d.armsFatLbs as number | null,
          legsFatLbs: d.legsFatLbs as number | null,
          androidFatPct: d.androidFatPct as number | null,
          gynoidFatPct: d.gynoidFatPct as number | null,
          agRatio: d.agRatio as number | null,
          bmdGcm2: d.bmdGcm2 as number | null,
          tScore: d.tScore as number | null,
          bmr: d.bmr as number | null,
          notes: d.notes as string | null,
          fileUrl: d.fileUrl as string | null,
        },
      });
    } catch {}
  }
  console.log("DEXA done");

  // Food memories
  const mems = db.prepare("SELECT * FROM FoodMemory").all() as Record<string, unknown>[];
  console.log("Memories:", mems.length);
  for (const m of mems) {
    try {
      await remote.foodMemory.create({
        data: {
          foodName: m.foodName as string,
          calories: (m.calories as number) || 0,
          proteinG: (m.proteinG as number) || 0,
          carbsG: (m.carbsG as number) || 0,
          fatG: (m.fatG as number) || 0,
          fiberG: (m.fiberG as number) || 0,
          servingDesc: (m.servingDesc as string) || "1 serving",
        },
      });
    } catch {}
  }
  console.log("Memories done");

  // Sync profile
  const lp = db.prepare("SELECT * FROM UserProfile LIMIT 1").get() as Record<string, unknown> | undefined;
  if (lp) {
    await remote.userProfile.update({
      where: { id: rp.id },
      data: {
        name: (lp.name as string) || rp.name,
        currentWeightKg: lp.currentWeightKg as number | null,
        heightCm: lp.heightCm as number | null,
        age: lp.age as number | null,
        goalType: (lp.goalType as string) || "maintain",
        calorieTarget: (lp.calorieTarget as number) || 2000,
        proteinTargetG: (lp.proteinTargetG as number) || 150,
        carbTargetG: (lp.carbTargetG as number) || 250,
        fatTargetG: (lp.fatTargetG as number) || 65,
        fiberTargetG: (lp.fiberTargetG as number) || 30,
      },
    });
    console.log("Profile synced:", lp.name);
  }

  console.log("All done!");
}

migrate()
  .catch(console.error)
  .finally(() => {
    db.close();
    remote.$disconnect();
  });
