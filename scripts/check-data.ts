import { PrismaClient } from "@prisma/client";

const p = new PrismaClient({
  datasourceUrl: "postgresql://postgres.kzpfqaezcgxnzbvkxpue:Lemondrop12345!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0",
});

function getDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function check() {
  const profile = await p.userProfile.findFirst();
  console.log("Profile ID:", profile?.id);

  const dates = [];
  for (let i = 29; i >= 0; i--) dates.push(getDaysAgo(i));
  console.log("Date range:", dates[0], "to", dates[dates.length - 1]);

  const entries = await p.foodEntry.findMany({ where: { userId: profile!.id, date: { in: dates } } });
  const byDate: Record<string, number> = {};
  entries.forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + 1; });
  console.log("Food by date:", JSON.stringify(byDate));

  const metrics = await p.healthMetric.findMany({ where: { date: { in: dates.slice(-7) }, type: "steps" } });
  console.log("Steps last 7 days:", JSON.stringify(metrics.map((m) => ({ date: m.date, steps: m.value }))));

  const workouts = await p.workout.findMany({ where: { date: { in: dates.slice(-7) } }, orderBy: { date: "desc" } });
  console.log("Workouts last 7:", JSON.stringify(workouts.map((w) => ({ date: w.date, type: w.workoutType, min: w.durationMin }))));
}

check().finally(() => p.$disconnect());
