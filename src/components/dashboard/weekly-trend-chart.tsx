"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { format } from "date-fns";

interface WeekDay {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface WeeklyTrendChartProps {
  days: WeekDay[];
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

export function WeeklyTrendChart({ days, targets }: WeeklyTrendChartProps) {
  const [view, setView] = useState<"calories" | "macros">("calories");

  const chartData = days.map((d) => ({
    ...d,
    label: format(new Date(d.date + "T12:00:00"), "EEE"),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Weekly Trends</CardTitle>
          <Tabs value={view} onValueChange={(v) => setView(v as "calories" | "macros")}>
            <TabsList className="h-7">
              <TabsTrigger value="calories" className="text-xs px-2 h-5">
                Calories
              </TabsTrigger>
              <TabsTrigger value="macros" className="text-xs px-2 h-5">
                Macros
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          {view === "calories" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <ReferenceLine
                y={targets.calories}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: "Target", fontSize: 10, fill: "#ef4444" }}
              />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Calories"
              />
            </LineChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} unit="g" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line type="monotone" dataKey="proteinG" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Protein" />
              <Line type="monotone" dataKey="carbsG" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Carbs" />
              <Line type="monotone" dataKey="fatG" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Fat" />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
