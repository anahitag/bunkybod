"use client";

import { Card, CardContent } from "@/components/ui/card";

interface MacroSummaryCardProps {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
}

function MacroBlock({
  label,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  return (
    <div className="text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {current}
      </div>
      <div className="text-xs text-muted-foreground">
        / {target}{unit}
      </div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function MacroSummaryCard({ totals, targets }: MacroSummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-5 gap-3">
          <MacroBlock label="Calories" current={totals.calories} target={targets.calories} unit=" kcal" color="#3b82f6" />
          <MacroBlock label="Protein" current={totals.proteinG} target={targets.proteinG} unit="g" color="#ef4444" />
          <MacroBlock label="Carbs" current={totals.carbsG} target={targets.carbsG} unit="g" color="#f59e0b" />
          <MacroBlock label="Fat" current={totals.fatG} target={targets.fatG} unit="g" color="#8b5cf6" />
          <MacroBlock label="Fiber" current={totals.fiberG} target={targets.fiberG} unit="g" color="#10b981" />
        </div>
      </CardContent>
    </Card>
  );
}
