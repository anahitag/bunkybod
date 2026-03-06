"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Footprints, Heart, Moon, Flame, Dumbbell, TrendingUp, Activity, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";

interface DayData {
  date: string;
  steps: number | null;
  activeCalories: number | null;
  restingHR: number | null;
  hrv: number | null;
  exerciseMinutes: number | null;
  sleepMinutes: number | null;
  distanceWalkRun: number | null;
  vo2Max: number | null;
  weight: number | null;
  workouts: { type: string; durationMin: number; calories: number | null; avgHR: number | null }[];
}

interface HealthData {
  daily: DayData[];
  summary: { avgSteps: number | null; avgRestingHR: number | null; avgSleepHours: number | null; totalWorkouts: number; daysWithData: number };
  workouts: { workoutType: string; durationMin: number; caloriesBurned: number | null; date: string }[];
}

interface MonthlyData {
  dailyData: { date: string; calories: number; proteinG: number; hasEntries: boolean; adherence: string }[];
  summary: { avgCalories: number; avgProtein: number; adherenceRate: number; daysTracked: number };
  targets: { calories: number; proteinG: number };
}

export default function MetricsPage() {
  const [range, setRange] = useState<"1" | "7" | "30" | "90" | "180" | "365">("1");
  const [subTab, setSubTab] = useState("activity");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, mRes] = await Promise.all([
        fetch(`/api/health/data?days=${range}`),
        fetch(`/api/metrics/monthly?days=${range}`),
      ]);
      setHealth(await hRes.json());
      setMonthly(await mRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener("bunkybod:refresh", h);
    return () => window.removeEventListener("bunkybod:refresh", h);
  }, [fetchData]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/health/import", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported! ${data.summary.metricsUpserted} metrics, ${data.summary.workoutsImported} workouts (${data.summary.dateRange.earliest} to ${data.summary.dateRange.latest})`);
        fetchData();
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch { toast.error("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  const hasHealthData = health && health.summary.daysWithData > 0;
  const stepsData = health?.daily.filter((d) => d.steps != null).map((d) => ({ date: format(parseISO(d.date), "M/d"), steps: d.steps })) || [];
  const hrData = health?.daily.filter((d) => d.restingHR != null).map((d) => ({ date: format(parseISO(d.date), "M/d"), hr: d.restingHR, hrv: d.hrv })) || [];
  const sleepData = health?.daily.filter((d) => d.sleepMinutes != null).map((d) => ({ date: format(parseISO(d.date), "M/d"), hours: Math.round((d.sleepMinutes || 0) / 60 * 10) / 10 })) || [];
  const calData = health?.daily.filter((d) => d.activeCalories != null).map((d) => ({ date: format(parseISO(d.date), "M/d"), cal: Math.round(d.activeCalories || 0) })) || [];
  const exerciseData = health?.daily.filter((d) => d.exerciseMinutes != null).map((d) => ({ date: format(parseISO(d.date), "M/d"), min: Math.round(d.exerciseMinutes || 0) })) || [];

  // Workout type breakdown
  const workoutTypes: Record<string, { count: number; totalMin: number; totalCal: number }> = {};
  for (const w of health?.workouts || []) {
    if (!workoutTypes[w.workoutType]) workoutTypes[w.workoutType] = { count: 0, totalMin: 0, totalCal: 0 };
    workoutTypes[w.workoutType].count++;
    workoutTypes[w.workoutType].totalMin += w.durationMin;
    workoutTypes[w.workoutType].totalCal += w.caloriesBurned || 0;
  }
  const workoutBreakdown = Object.entries(workoutTypes).map(([type, data]) => ({ type, ...data })).sort((a, b) => b.count - a.count);

  const interval = (data: unknown[]) => data.length > 14 ? Math.floor(data.length / 7) : 0;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <PageHeader
        title="Activity"
        action="upload"
        actionLabel="Import"
        onFileUpload={handleImport}
        fileAccept=".xml,.zip"
        loading={importing}
      />

      {loading ? <Skeleton className="h-[200px] w-full rounded-md" /> : !hasHealthData && !monthly?.summary.daysTracked ? (
        <Card>
          <CardContent className="py-8">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="font-medium">No health data yet</p>
              <p className="text-sm text-muted-foreground mt-1">Export from iPhone: Health app &gt; Profile &gt; Export All Health Data</p>
              <label className="cursor-pointer">
                <Button size="sm" className="mt-3" asChild disabled={importing}>
                  <span>{importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />} Upload Apple Health Export</span>
                </Button>
                <input type="file" accept=".xml,.zip" className="hidden" onChange={handleImport} disabled={importing} />
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
            <TabsTrigger value="workouts" className="text-xs">Workouts</TabsTrigger>
          </TabsList>

          {/* Time range selector */}
          <div className="flex gap-1 mt-3 bg-muted/50 rounded-full p-1 w-fit mx-auto">
            {[
              { value: "1", label: "Day" },
              { value: "7", label: "Week" },
              { value: "30", label: "Month" },
              { value: "90", label: "3M" },
              { value: "180", label: "6M" },
              { value: "365", label: "Year" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value as typeof range)}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  range === opt.value
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="space-y-4 mt-3">
            {/* Daily view — just today's stats */}
            {range === "1" && health && health.daily.length > 0 && (() => {
              const today = health.daily[health.daily.length - 1];
              return (
                <div className="grid grid-cols-2 gap-2">
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Footprints className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Steps</span></div>
                    <div className="text-2xl font-bold">{today.steps?.toLocaleString() || "—"}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Flame className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Active Calories</span></div>
                    <div className="text-2xl font-bold">{today.activeCalories ? Math.round(today.activeCalories) : "—"}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Heart className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Resting HR</span></div>
                    <div className="text-2xl font-bold">{today.restingHR || "—"} <span className="text-sm font-normal text-muted-foreground">bpm</span></div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">HRV</span></div>
                    <div className="text-2xl font-bold">{today.hrv ? Math.round(today.hrv) : "—"} <span className="text-sm font-normal text-muted-foreground">ms</span></div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Dumbbell className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Exercise</span></div>
                    <div className="text-2xl font-bold">{today.exerciseMinutes ? Math.round(today.exerciseMinutes) : "—"} <span className="text-sm font-normal text-muted-foreground">min</span></div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><Moon className="h-4 w-4 text-indigo-500" /><span className="text-xs text-muted-foreground">Sleep</span></div>
                    <div className="text-2xl font-bold">{today.sleepMinutes ? (today.sleepMinutes / 60).toFixed(1) : "—"} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
                  </CardContent></Card>
                </div>
              );
            })()}

            {/* Trend view (non-daily) */}
            {range !== "1" && <>
            {/* Quick stats */}
            {health && (
              <div className="grid grid-cols-4 gap-2">
                <Card><CardContent className="p-2.5 text-center">
                  <Footprints className="h-3.5 w-3.5 mx-auto mb-0.5 text-blue-500" />
                  <div className="text-base font-bold">{health.summary.avgSteps?.toLocaleString() || "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Steps</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <Flame className="h-3.5 w-3.5 mx-auto mb-0.5 text-orange-500" />
                  <div className="text-base font-bold">{calData.length > 0 ? Math.round(calData.reduce((s, d) => s + d.cal, 0) / calData.length) : "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Active Cal</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <Dumbbell className="h-3.5 w-3.5 mx-auto mb-0.5 text-green-500" />
                  <div className="text-base font-bold">{exerciseData.length > 0 ? Math.round(exerciseData.reduce((s, d) => s + d.min, 0) / exerciseData.length) : "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Exercise Min</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-purple-500" />
                  <div className="text-base font-bold">{health.summary.totalWorkouts}</div>
                  <div className="text-[9px] text-muted-foreground">Workouts</div>
                </CardContent></Card>
              </div>
            )}

            {/* Steps chart */}
            {stepsData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Daily Steps</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={stepsData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(stepsData)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="steps" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Steps" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Active calories chart */}
            {calData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Calories Burned</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={calData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(calData)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Area type="monotone" dataKey="cal" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} name="Active Cal" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Exercise minutes */}
            {exerciseData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Exercise Minutes</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={exerciseData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(exerciseData)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" min" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="min" fill="#10b981" radius={[2, 2, 0, 0]} name="Minutes" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            </>}
          </TabsContent>

          {/* HEALTH TAB */}
          <TabsContent value="health" className="space-y-4 mt-3">
            {health && (
              <div className="grid grid-cols-3 gap-2">
                <Card><CardContent className="p-2.5 text-center">
                  <Heart className="h-3.5 w-3.5 mx-auto mb-0.5 text-red-500" />
                  <div className="text-base font-bold">{health.summary.avgRestingHR || "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Resting HR</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <Activity className="h-3.5 w-3.5 mx-auto mb-0.5 text-purple-500" />
                  <div className="text-base font-bold">{hrData.length > 0 && hrData[hrData.length-1].hrv ? Math.round(hrData[hrData.length-1].hrv!) : "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Latest HRV</div>
                </CardContent></Card>
                <Card><CardContent className="p-2.5 text-center">
                  <Moon className="h-3.5 w-3.5 mx-auto mb-0.5 text-indigo-500" />
                  <div className="text-base font-bold">{health.summary.avgSleepHours || "—"}</div>
                  <div className="text-[9px] text-muted-foreground">Avg Sleep (hrs)</div>
                </CardContent></Card>
              </div>
            )}

            {/* Resting HR trend */}
            {hrData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resting Heart Rate</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={hrData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(hrData)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" bpm" domain={["dataMin - 3", "dataMax + 3"]} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={{ r: 1.5 }} name="Resting HR" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* HRV trend */}
            {hrData.some((d) => d.hrv) && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Heart Rate Variability (HRV)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={hrData.filter((d) => d.hrv)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(hrData)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" ms" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Area type="monotone" dataKey="hrv" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} name="HRV" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Sleep trend */}
            {sleepData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sleep Duration</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={sleepData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval(sleepData)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" hrs" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="hours" fill="#6366f1" radius={[2, 2, 0, 0]} name="Sleep (hrs)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* WORKOUTS TAB */}
          <TabsContent value="workouts" className="space-y-4 mt-3">
            {workoutBreakdown.length > 0 ? (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Workout Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(150, workoutBreakdown.length * 35)}>
                      <BarChart data={workoutBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Sessions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recent Workouts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(health?.workouts || []).slice(0, 20).map((w, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <div className="text-sm font-medium">{w.workoutType}</div>
                          <div className="text-xs text-muted-foreground">{format(parseISO(w.date), "MMM d")} · {Math.round(w.durationMin)} min{w.caloriesBurned ? ` · ${Math.round(w.caloriesBurned)} cal` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No workout data. Import Apple Health data to see workouts.</CardContent></Card>
            )}
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}
