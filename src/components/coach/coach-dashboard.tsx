"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { CheckCircle, AlertTriangle, Lightbulb, Sparkles, RefreshCw, Trophy, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface Insights {
  highlights: string[];
  lowlights: string[];
  recommendations: { title: string; detail: string; priority: string }[];
  goalProgress: { summary: string; score: number };
  weeklyFocus: string;
  streaks?: { daysLogged: number; workoutStreak: number; proteinStreak: number };
  bodyCompSnapshot?: { bodyFatPct: number; leanMassLbs: number; trend: string };
  weeklyActivity?: { avgSteps: number; avgCal: number; workouts: number; stepsTrend: string };
}

export function CoachDashboard({ userName }: { userName: string }) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchInsights(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/coach/insights${isRefresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (!data.error) setInsights(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchInsights(); }, []);
  useEffect(() => {
    const h = () => fetchInsights();
    window.addEventListener("bunkybod:refresh", h);
    return () => window.removeEventListener("bunkybod:refresh", h);
  }, []);

  const scoreColor = (score: number) => score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  const scoreEmoji = (score: number) => score >= 8 ? "🔥" : score >= 5 ? "💪" : "⚡";
  const scoreLabel = (score: number) => score >= 8 ? "Crushing it" : score >= 5 ? "On track" : "Needs work";

  const priorityStyle = (p: string) => {
    if (p === "high") return "border-l-red-500 bg-red-50 dark:bg-red-950/30";
    if (p === "medium") return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30";
    return "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30";
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <PageHeader title={`${userName}Bod`} />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-[80px] rounded-lg" /><Skeleton className="h-[80px] rounded-lg" /></div>
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </div>
      ) : insights ? (
        <>
          {/* Hero: Goal Score */}
          <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/15">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative w-[100px] h-[100px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius={33} outerRadius={46} barSize={10}
                      data={[{ value: insights.goalProgress.score * 10, fill: scoreColor(insights.goalProgress.score) }]}
                      startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={5} background={{ fill: "hsl(var(--muted))" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold">{insights.goalProgress.score}</span>
                    <span className="text-[9px] text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">{scoreEmoji(insights.goalProgress.score)}</span>
                    <span className="text-sm font-semibold" style={{ color: scoreColor(insights.goalProgress.score) }}>
                      {scoreLabel(insights.goalProgress.score)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insights.goalProgress.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Focus */}
          {insights.weeklyFocus && (
            <Card className="bg-[#E8DEF8] dark:bg-[#3F2D6D] border-0">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary/70">This Week</div>
                  <p className="text-sm font-medium">{insights.weeklyFocus}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Streaks & Body Comp side by side */}
          <div className="grid grid-cols-2 gap-3">
            {insights.streaks && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-xs font-medium">Streaks</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Days logged</span>
                      <span className="text-sm font-bold">{insights.streaks.daysLogged}🔥</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Workout streak</span>
                      <span className="text-sm font-bold">{insights.streaks.workoutStreak}💪</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Protein hit</span>
                      <span className="text-sm font-bold">{insights.streaks.proteinStreak}✅</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {insights.bodyCompSnapshot && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium">Body Comp</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Body Fat</span>
                      <span className="text-sm font-bold">{insights.bodyCompSnapshot.bodyFatPct}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Lean Mass</span>
                      <span className="text-sm font-bold">{insights.bodyCompSnapshot.leanMassLbs} lbs</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      {insights.bodyCompSnapshot.trend === "improving" ? (
                        <><ArrowUpRight className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Improving</span></>
                      ) : insights.bodyCompSnapshot.trend === "declining" ? (
                        <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-[10px] text-red-500">Declining</span></>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Stable</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>


          {/* Highlights + Lowlights */}
          {(insights.highlights.length > 0 || insights.lowlights.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {insights.highlights.length > 0 && (
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Wins
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5">
                    {insights.highlights.map((h, i) => (
                      <p key={i} className="text-[11px] leading-relaxed">{h}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
              {insights.lowlights.length > 0 && (
                <Card className="border-yellow-200 dark:border-yellow-900">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> Work On
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5">
                    {insights.lowlights.map((l, i) => (
                      <p key={i} className="text-[11px] leading-relaxed">{l}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Recommendations */}
          {insights.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <Lightbulb className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium">Action Items</span>
              </div>
              {insights.recommendations.map((r, i) => (
                <div key={i} className={`rounded-lg border-l-4 p-3 ${priorityStyle(r.priority)}`}>
                  <div className="text-sm font-medium">{r.title}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{r.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Refresh */}
          <div className="flex justify-center pt-1 pb-24">
            <Button variant="ghost" size="sm" onClick={() => fetchInsights(true)} disabled={refreshing} className="text-[11px] text-muted-foreground">
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Analyzing..." : "Refresh"}
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start logging food and tracking activity to get personalized coaching.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
