import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const scans = await prisma.dexaScan.findMany({
    orderBy: { scanDate: "desc" },
  });
  return NextResponse.json({ scans });
}

const optFloat = (v: unknown) => (v != null && !isNaN(Number(v)) ? Number(v) : null);

export async function POST(request: Request) {
  const b = await request.json();

  const scan = await prisma.dexaScan.create({
    data: {
      scanDate: b.scanDate,
      totalWeightLbs: optFloat(b.totalWeightLbs),
      bodyFatPct: Number(b.bodyFatPct),
      leanMassLbs: Number(b.leanMassLbs),
      fatMassLbs: Number(b.fatMassLbs),
      boneMassLbs: optFloat(b.boneMassLbs),
      visceralFat: optFloat(b.visceralFat),
      trunkFatPct: optFloat(b.trunkFatPct),
      armsFatPct: optFloat(b.armsFatPct),
      legsFatPct: optFloat(b.legsFatPct),
      trunkLeanLbs: optFloat(b.trunkLeanLbs),
      armsLeanLbs: optFloat(b.armsLeanLbs),
      legsLeanLbs: optFloat(b.legsLeanLbs),
      trunkFatLbs: optFloat(b.trunkFatLbs),
      armsFatLbs: optFloat(b.armsFatLbs),
      legsFatLbs: optFloat(b.legsFatLbs),
      androidFatPct: optFloat(b.androidFatPct),
      gynoidFatPct: optFloat(b.gynoidFatPct),
      agRatio: optFloat(b.agRatio),
      bmdGcm2: optFloat(b.bmdGcm2),
      tScore: optFloat(b.tScore),
      bmr: optFloat(b.bmr),
      notes: b.notes || null,
      fileUrl: b.fileUrl || null,
    },
  });

  return NextResponse.json(scan);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await prisma.dexaScan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
