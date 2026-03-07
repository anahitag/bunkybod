import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";

  let dbTest = "not tested";
  let profileCount = 0;
  try {
    // Use raw query to avoid prepared statement issues
    const result = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "UserProfile"` as { count: number }[];
    profileCount = result[0]?.count || 0;

    if (profileCount > 0) {
      const profiles = await prisma.$queryRaw`SELECT name, onboarded FROM "UserProfile" LIMIT 1` as { name: string; onboarded: boolean }[];
      dbTest = `connected OK — found ${profileCount} profile(s), name: ${profiles[0]?.name}, onboarded: ${profiles[0]?.onboarded}`;
    } else {
      dbTest = "connected OK — no profiles";
    }
  } catch (e: unknown) {
    dbTest = `error: ${(e as Error).message}`;
  }

  return NextResponse.json({
    hasDbUrl: dbUrl !== "NOT SET",
    dbUrlPrefix: dbUrl.substring(0, 40) + "...",
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasGithubToken: !!process.env.GITHUB_TOKEN,
    dbTest,
    profileCount,
  });
}
