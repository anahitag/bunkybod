"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface ProgressRingProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
}

function ProgressRing({ label, current, target, color, unit }: ProgressRingProps) {
  const pct = Math.min((current / target) * 100, 100);
  const remaining = target - current;
  const data = [{ value: pct, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[100px] h-[100px]">
        <RadialBarChart
          width={100}
          height={100}
          cx={50}
          cy={50}
          innerRadius={35}
          outerRadius={48}
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
          <RadialBar
            dataKey="value"
            cornerRadius={5}
            background={{ fill: "hsl(var(--muted))" }}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="text-center mt-1">
        <div className="text-xs font-medium" style={{ color }}>
          {current} / {target}{unit}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-[10px] mt-0.5 font-medium ${remaining >= 0 ? "text-muted-foreground" : "text-red-500"}`}>
          {remaining >= 0 ? `${remaining}${unit} left` : `${Math.abs(remaining)}${unit} over`}
        </div>
      </div>
    </div>
  );
}

interface DailyProgressRingsProps {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

export function DailyProgressRings({ totals, targets }: DailyProgressRingsProps) {
  return (
    <div className="flex justify-center gap-4 flex-wrap">
      <ProgressRing label="Calories" current={totals.calories} target={targets.calories} color="#3b82f6" unit=" kcal" />
      <ProgressRing label="Protein" current={totals.proteinG} target={targets.proteinG} color="#ef4444" unit="g" />
      <ProgressRing label="Carbs" current={totals.carbsG} target={targets.carbsG} color="#f59e0b" unit="g" />
      <ProgressRing label="Fat" current={totals.fatG} target={targets.fatG} color="#8b5cf6" unit="g" />
    </div>
  );
}
