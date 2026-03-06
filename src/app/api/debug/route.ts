import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";

  let dbTest = "not tested";
  let profileCount = 0;
  try {
    const profiles = await prisma.userProfile.findMany();
    profileCount = profiles.length;
    dbTest = "connected OK";
    if (profiles.length > 0) {
      dbTest += ` — found ${profiles.length} profile(s), onboarded: ${profiles[0].onboarded}, name: ${profiles[0].name}`;
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
