"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { DateNavigator } from "./date-navigator";
import { DailyProgressRings } from "./daily-progress-rings";
import { MacroSummaryCard } from "./macro-summary-card";
import { MealBreakdown } from "./meal-breakdown";
import { WeeklyTrendChart } from "./weekly-trend-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface DailyData {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  entries: Array<{
    id: string;
    foodName: string;
    mealType: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    servingSize: number;
    servingUnit: string;
  }>;
}

interface WeeklyData {
  days: Array<{ date: string; calories: number; proteinG: number; carbsG: number; fatG: number }>;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

interface MonthlyData {
  dailyData: Array<{ date: string; calories: number; proteinG: number; hasEntries: boolean; adherence: string }>;
  summary: { avgCalories: number; avgProtein: number; adherenceRate: number; daysTracked: number };
  targets: { calories: number; proteinG: number };
}

export function Dashboard({ userName = "User" }: { userName?: string }) {
  const [date, setDate] = useState(new Date());
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    try {
      const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
        fetch(`/api/nutrition/daily?date=${dateStr}`),
        fetch(`/api/nutrition/weekly?endDate=${dateStr}`),
        fetch(`/api/metrics/monthly?days=30`),
      ]);
      const [dailyData, weeklyData, monthlyData] = await Promise.all([
        dailyRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
      ]);
      setDaily(dailyData);
      setWeekly(weeklyData);
      setMonthly(monthlyData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Listen for refresh events from the chat drawer
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("bunkybod:refresh", handler);
    return () => window.removeEventListener("bunkybod:refresh", handler);
  }, [fetchData]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <PageHeader title={`${userName}Bod`} />

      {/* Date Navigator */}
      <DateNavigator date={date} onDateChange={setDate} />

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-9">
          <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-3">
          {/* Progress Rings */}
          {loading ? (
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[130px] w-[100px] rounded-md" />
              ))}
            </div>
          ) : daily ? (
            <DailyProgressRings totals={daily.totals} targets={daily.targets} />
          ) : null}

          {/* Macro Summary */}
          {loading ? (
            <Skeleton className="h-[80px] w-full rounded-md" />
          ) : daily ? (
            <MacroSummaryCard totals={daily.totals} targets={daily.targets} />
          ) : null}

          {/* Meal Breakdown */}
          {loading ? (
            <Skeleton className="h-[120px] w-full rounded-md" />
          ) : daily ? (
            <MealBreakdown entries={daily.entries} onDeleted={fetchData} />
          ) : null}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4 mt-3">
          {/* Monthly Nutrition Stats — first */}
          {!loading && monthly && monthly.summary.daysTracked > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Card><CardContent className="p-2.5 text-center">
                  <div className="text-base font-bold">{monthly.summary.avgCalories}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Cal/Day</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <div className="text-base font-bold">{monthly.summary.avgProtein}g</div>
                  <div className="text-[9px] text-muted-foreground">Avg Protein</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <div className="text-base font-bold">{monthly.summary.adherenceRate}%</div>
                  <div className="text-[9px] text-muted-foreground">On Target</div>
                </CardContent></Card>
              </div>

              {/* Calorie Bank — weekly view */}
              {weekly && (() => {
                const weeklyTarget = (weekly.targets?.calories || 2000) * 7;
                const weeklyEaten = weekly.days.reduce((s, d) => s + d.calories, 0);
                const banked = weeklyTarget - weeklyEaten;
                const avgThisWeek = Math.round(weeklyEaten / Math.max(weekly.days.filter(d => d.calories > 0).length, 1));
                const dailyTarget = weekly.targets?.calories || 2000;
                const pctUsed = Math.min(Math.round((weeklyEaten / weeklyTarget) * 100), 100);

                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Calorie Bank (This Week)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{weeklyEaten.toLocaleString()} eaten</span>
                          <span>{weeklyTarget.toLocaleString()} budget</span>
                        </div>
                        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pctUsed > 100 ? "bg-red-500" : pctUsed > 85 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(pctUsed, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className={`text-lg font-bold ${banked >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {banked >= 0 ? `+${banked.toLocaleString()}` : banked.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-muted-foreground">{banked >= 0 ? "Banked" : "Over"}</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{avgThisWeek.toLocaleString()}</div>
                          <div className="text-[9px] text-muted-foreground">Avg/Day</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{dailyTarget.toLocaleString()}</div>
                          <div className="text-[9px] text-muted-foreground">Target/Day</div>
                        </div>
                      </div>

                      {/* Daily breakdown mini bars */}
                      <div className="flex gap-1 items-end h-[50px]">
                        {weekly.days.map((d, i) => {
                          const pct = dailyTarget > 0 ? Math.min((d.calories / dailyTarget) * 100, 130) : 0;
                          const isOver = d.calories > dailyTarget;
                          const dayLabel = format(parseISO(d.date), "EEE").charAt(0);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <div className="w-full flex items-end" style={{ height: "40px" }}>
                                <div
                                  className={`w-full rounded-t-sm transition-all ${
                                    d.calories === 0 ? "bg-muted" : isOver ? "bg-red-400" : "bg-blue-400"
                                  }`}
                                  style={{ height: `${Math.max(pct * 0.4, d.calories > 0 ? 4 : 2)}px` }}
                                />
                              </div>
                              <span className="text-[8px] text-muted-foreground">{dayLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* 30-day Calorie Chart */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">30-Day Calories</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthly.dailyData.filter((d) => d.hasEntries).map((d) => ({ date: format(parseISO(d.date), "M/d"), cal: d.calories }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(monthly.dailyData.filter((d) => d.hasEntries).length / 7)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <ReferenceLine y={monthly.targets.calories} stroke="#ef4444" strokeDasharray="5 5" />
                      <Bar dataKey="cal" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Calories" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Adherence Heatmap */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Adherence</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {monthly.dailyData.map((d) => (
                      <div key={d.date} className={`w-3 h-3 rounded-sm ${
                        d.adherence === "green" ? "bg-green-400" :
                        d.adherence === "yellow" ? "bg-yellow-400" :
                        d.adherence === "red" ? "bg-red-400" : "bg-muted"
                      }`} title={`${format(parseISO(d.date), "MMM d")}: ${d.hasEntries ? `${d.calories} cal` : "No data"}`} />
                    ))}
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-green-400" /> On target</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-yellow-400" /> Close</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-400" /> Off</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-muted" /> No data</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Weekly Trend Chart — after stats */}
          {loading ? (
            <Skeleton className="h-[260px] w-full rounded-md" />
          ) : weekly ? (
            <WeeklyTrendChart days={weekly.days} targets={weekly.targets} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
