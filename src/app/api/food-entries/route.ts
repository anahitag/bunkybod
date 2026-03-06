import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const entries = await prisma.foodEntry.findMany({
    where: { userId: profile.id, date },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ entries });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.foodEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
