import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const memories = await prisma.foodMemory.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ memories });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await prisma.foodMemory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
