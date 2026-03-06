import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const db = new Database("./prisma/dev.db");
const remote = new PrismaClient({
  datasourceUrl: "postgresql://postgres.kzpfqaezcgxnzbvkxpue:Lemondrop12345!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function sync() {
  // Sync all local metrics that were updated via webhook or manual fix, or are from recent days
  const localMetrics = db.prepare(
    "SELECT * FROM HealthMetric WHERE source IN ('webhook', 'manual_fix') OR date >= '2026-03-03'"
  ).all() as { date: string; type: string; value: number; unit: string; source: string }[];

  console.log("Local metrics to sync:", localMetrics.length);

  let updated = 0;
  for (const m of localMetrics) {
    try {
      await remote.healthMetric.upsert({
        where: { date_type: { date: m.date, type: m.type } },
        create: { date: m.date, type: m.type, value: m.value, unit: m.unit || "", source: m.source || "sync" },
        update: { value: m.value },
      });
      updated++;
    } catch {}
  }
  console.log("Synced", updated, "metrics");
}

sync()
  .catch(console.error)
  .finally(() => {
    db.close();
    remote.$disconnect();
  });
