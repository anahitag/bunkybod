import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const updated = await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.age !== undefined && { age: body.age }),
      ...(body.heightCm !== undefined && { heightCm: body.heightCm }),
      ...(body.currentWeightKg !== undefined && { currentWeightKg: body.currentWeightKg }),
      ...(body.goalType !== undefined && { goalType: body.goalType }),
      ...(body.calorieTarget !== undefined && { calorieTarget: body.calorieTarget }),
      ...(body.proteinTargetG !== undefined && { proteinTargetG: body.proteinTargetG }),
      ...(body.carbTargetG !== undefined && { carbTargetG: body.carbTargetG }),
      ...(body.fatTargetG !== undefined && { fatTargetG: body.fatTargetG }),
      ...(body.fiberTargetG !== undefined && { fiberTargetG: body.fiberTargetG }),
      ...(body.onboarded !== undefined && { onboarded: body.onboarded }),
    },
  });

  return NextResponse.json(updated);
}
