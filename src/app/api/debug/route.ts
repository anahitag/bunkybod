import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";
  return NextResponse.json({
    hasDbUrl: dbUrl !== "NOT SET",
    dbUrlPrefix: dbUrl.substring(0, 30) + "...",
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasGithubToken: !!process.env.GITHUB_TOKEN,
    hasUsdaKey: !!process.env.USDA_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}
