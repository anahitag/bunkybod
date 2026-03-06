import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const profile = await prisma.userProfile.findFirst();

  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 404 });
  }

  const entry = await prisma.foodEntry.create({
    data: {
      userId: profile.id,
      date: body.date,
      mealType: body.mealType || "snack",
      foodName: body.foodName,
      fdcId: body.fdcId || null,
      servingSize: body.servingSize || 1,
      servingUnit: body.servingUnit || "serving",
      calories: body.calories || 0,
      proteinG: body.proteinG || 0,
      carbsG: body.carbsG || 0,
      fatG: body.fatG || 0,
      fiberG: body.fiberG || 0,
      sugarG: body.sugarG || 0,
      sodiumMg: body.sodiumMg || 0,
      loggedVia: body.loggedVia || "search",
    },
  });

  return NextResponse.json(entry);
}
