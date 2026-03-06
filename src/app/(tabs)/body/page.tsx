"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Area, AreaChart,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Activity, Upload, Loader2, FileText, TrendingDown, TrendingUp, Scale, Flame } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";

interface DexaScan {
  id: string; scanDate: string; totalWeightLbs: number | null;
  bodyFatPct: number; leanMassLbs: number; fatMassLbs: number; boneMassLbs: number | null;
  visceralFat: number | null;
  trunkFatPct: number | null; armsFatPct: number | null; legsFatPct: number | null;
  trunkLeanLbs: number | null; armsLeanLbs: number | null; legsLeanLbs: number | null;
  trunkFatLbs: number | null; armsFatLbs: number | null; legsFatLbs: number | null;
  androidFatPct: number | null; gynoidFatPct: number | null; agRatio: number | null;
  bmdGcm2: number | null; tScore: number | null; bmr: number | null;
  notes: string | null; fileUrl: string | null;
}

function safeFmt(dateStr: string, fmt: string) {
  if (!dateStr) return "Unknown";
  try {
    let d = parseISO(dateStr);
    if (isNaN(d.getTime())) d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, fmt);
  } catch { return dateStr; }
}

function DeltaBadge({ val, unit, invert }: { val: number | null; unit: string; invert?: boolean }) {
  if (val == null) return null;
  const good = invert ? val < 0 : val > 0;
  return <span className={`text-xs font-medium ${good ? "text-green-600" : "text-red-500"}`}>{val > 0 ? "+" : ""}{val}{unit}</span>;
}

export default function BodyPage() {
  const [scans, setScans] = useState<DexaScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const emptyForm: Record<string, string> = {
    scanDate: format(new Date(), "yyyy-MM-dd"),
    totalWeightLbs: "", bodyFatPct: "", leanMassLbs: "", fatMassLbs: "", boneMassLbs: "",
    visceralFat: "", trunkFatPct: "", armsFatPct: "", legsFatPct: "",
    trunkLeanLbs: "", armsLeanLbs: "", legsLeanLbs: "",
    trunkFatLbs: "", armsFatLbs: "", legsFatLbs: "",
    androidFatPct: "", gynoidFatPct: "", agRatio: "",
    bmdGcm2: "", tScore: "", bmr: "", notes: "", fileUrl: "",
  };
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm });

  const fetchScans = useCallback(async () => {
    try { const res = await fetch("/api/dexa"); const data = await res.json(); setScans(data.scans || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchScans(); }, [fetchScans]);
  useEffect(() => { const h = () => fetchScans(); window.addEventListener("bunkybod:refresh", h); return () => window.removeEventListener("bunkybod:refresh", h); }, [fetchScans]);

  async function handleSubmit() {
    if (!form.bodyFatPct || !form.leanMassLbs || !form.fatMassLbs) { toast.error("Body fat %, lean mass, and fat mass are required."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { scanDate: form.scanDate, notes: form.notes || null, fileUrl: form.fileUrl || null };
      for (const [k, v] of Object.entries(form)) { if (["scanDate","notes","fileUrl"].includes(k)) continue; if (v) body[k] = parseFloat(v); }
      await fetch("/api/dexa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      toast.success("DEXA scan saved!"); setDialogOpen(false); setForm({ ...emptyForm }); fetchScans();
    } catch { toast.error("Failed to save."); } finally { setSaving(false); }
  }
  async function deleteScan(id: string) { await fetch("/api/dexa", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); toast.success("Deleted."); fetchScans(); }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const uRes = await fetch("/api/upload", { method: "POST", body: fd }); const uData = await uRes.json();
      if (!uRes.ok) { toast.error(uData.error || "Upload failed"); setUploading(false); return; }
      setForm((p) => ({ ...p, fileUrl: uData.fileUrl })); toast.success(`Uploaded: ${file.name}`); setUploading(false);
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setParsing(true);
        try {
          const pRes = await fetch("/api/dexa/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileUrl: uData.fileUrl }) });
          const pData = await pRes.json();
          if (pRes.ok && pData.extracted) {
            const ex = pData.extracted;
            setForm((p) => {
              const u = { ...p };
              for (const [key, val] of Object.entries(ex)) {
                if (val != null && key !== "confidence" && key in u) {
                  if (key === "scanDate") { try { const d = new Date(val as string); if (!isNaN(d.getTime())) u[key] = d.toISOString().split("T")[0]; } catch {} }
                  else u[key] = String(typeof val === "number" ? Math.round(val * 10) / 10 : val);
                }
              }
              return u;
            });
            toast.success(`Extracted (${ex.confidence || "medium"} confidence). Review and save.`);
          } else toast.info(pData.error || "Could not auto-extract.");
        } catch { toast.info("PDF parsing failed."); } finally { setParsing(false); }
      }
    } catch { toast.error("Upload failed."); setUploading(false); }
  }

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const latest = scans[0];
  const prev = scans[1];
  const selected = scans[selectedIdx] || latest;
  const sorted = [...scans].reverse();
  const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null) ? Math.round((a - b) * 10) / 10 : null;

  const F = ({ label, field }: { label: string; field: string }) => (
    <div><Label className="text-xs">{label}</Label><Input type="number" step="0.1" value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="h-8 text-sm" /></div>
  );

  const PIE_COLORS = ["#ef4444", "#3b82f6", "#a3a3a3"];
  const REGION_COLORS = ["#8b5cf6", "#3b82f6", "#10b981"];

  // Radar data for regional comparison
  const radarData = selected ? [
    { region: "Trunk Fat%", value: selected.trunkFatPct || 0 },
    { region: "Arms Fat%", value: selected.armsFatPct || 0 },
    { region: "Legs Fat%", value: selected.legsFatPct || 0 },
    { region: "Android%", value: selected.androidFatPct || 0 },
    { region: "Gynoid%", value: selected.gynoidFatPct || 0 },
  ].filter((d) => d.value > 0) : [];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <PageHeader title="Body Composition" action="add" actionLabel="Add Scan" onAction={() => setDialogOpen(true)} />

      {/* Add Scan Dialog */}
      <div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add DEXA Scan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                {uploading || parsing ? (
                  <div className="flex flex-col items-center gap-2 py-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Parsing PDF..."}</span></div>
                ) : form.fileUrl ? (
                  <div className="flex items-center justify-center gap-2 text-sm"><FileText className="h-4 w-4 text-green-500" /><span className="text-green-600 font-medium">Uploaded</span><a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">View</a></div>
                ) : (
                  <label className="cursor-pointer"><Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" /><span className="text-sm text-muted-foreground block">Upload DEXA PDF</span><input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} /></label>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Scan Date</Label><Input type="date" value={form.scanDate||""} onChange={(e)=>setForm({...form,scanDate:e.target.value})} className="h-8 text-sm"/></div>
                <F label="Total Weight (lbs)" field="totalWeightLbs" /><F label="Body Fat %*" field="bodyFatPct" />
              </div>
              <div className="grid grid-cols-3 gap-2"><F label="Lean Mass (lbs)*" field="leanMassLbs" /><F label="Fat Mass (lbs)*" field="fatMassLbs" /><F label="Bone Mass (lbs)" field="boneMassLbs" /></div>
              <p className="text-xs font-medium text-muted-foreground pt-1">Regional Fat %</p>
              <div className="grid grid-cols-3 gap-2"><F label="Trunk" field="trunkFatPct" /><F label="Arms" field="armsFatPct" /><F label="Legs" field="legsFatPct" /></div>
              <p className="text-xs font-medium text-muted-foreground pt-1">Regional Lean Mass (lbs)</p>
              <div className="grid grid-cols-3 gap-2"><F label="Trunk" field="trunkLeanLbs" /><F label="Arms" field="armsLeanLbs" /><F label="Legs" field="legsLeanLbs" /></div>
              <p className="text-xs font-medium text-muted-foreground pt-1">Regional Fat Mass (lbs)</p>
              <div className="grid grid-cols-3 gap-2"><F label="Trunk" field="trunkFatLbs" /><F label="Arms" field="armsFatLbs" /><F label="Legs" field="legsFatLbs" /></div>
              <p className="text-xs font-medium text-muted-foreground pt-1">Advanced</p>
              <div className="grid grid-cols-2 gap-2"><F label="Android Fat %" field="androidFatPct" /><F label="Gynoid Fat %" field="gynoidFatPct" /><F label="A/G Ratio" field="agRatio" /><F label="BMD (g/cm²)" field="bmdGcm2" /><F label="T-Score" field="tScore" /><F label="Visceral Fat" field="visceralFat" /></div>
              <div><Label className="text-xs">Scan Link</Label><Input type="url" placeholder="https://..." value={form.fileUrl} onChange={(e)=>setForm({...form,fileUrl:e.target.value})} className="h-8 text-sm"/></div>
              <div><Label className="text-xs">Notes</Label><Input placeholder="Optional..." value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} className="h-8 text-sm"/></div>
              <Button className="w-full" onClick={handleSubmit} disabled={saving}>{saving?"Saving...":"Save Scan"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <Skeleton className="h-[200px] w-full rounded-md" /> : scans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Activity className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No DEXA scans yet. Add your first scan.</p></CardContent></Card>
      ) : (
        <>
          {/* Quick Stats Row */}
          {scans.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <Card><CardContent className="p-2.5 text-center">
                <Scale className="h-3.5 w-3.5 mx-auto mb-0.5 text-purple-500" />
                <div className="text-base font-bold">{selected.totalWeightLbs || Math.round(selected.leanMassLbs + selected.fatMassLbs + (selected.boneMassLbs||0))}</div>
                <div className="text-[9px] text-muted-foreground">Weight (lbs)</div>
                {prev && <DeltaBadge val={delta(selected.totalWeightLbs||(selected.leanMassLbs+selected.fatMassLbs), prev.totalWeightLbs||(prev.leanMassLbs+prev.fatMassLbs))} unit=" lbs" invert />}
              </CardContent></Card>
              <Card><CardContent className="p-2.5 text-center">
                <TrendingDown className="h-3.5 w-3.5 mx-auto mb-0.5 text-red-500" />
                <div className="text-base font-bold">{selected.bodyFatPct}%</div>
                <div className="text-[9px] text-muted-foreground">Body Fat</div>
                {prev && <DeltaBadge val={delta(selected.bodyFatPct, prev.bodyFatPct)} unit="%" invert />}
              </CardContent></Card>
              <Card><CardContent className="p-2.5 text-center">
                <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-blue-500" />
                <div className="text-base font-bold">{Math.round(selected.leanMassLbs)}</div>
                <div className="text-[9px] text-muted-foreground">Lean (lbs)</div>
                {prev && <DeltaBadge val={delta(selected.leanMassLbs, prev.leanMassLbs)} unit="" />}
              </CardContent></Card>
              <Card><CardContent className="p-2.5 text-center">
                <Flame className="h-3.5 w-3.5 mx-auto mb-0.5 text-orange-500" />
                <div className="text-base font-bold">{Math.round(selected.fatMassLbs)}</div>
                <div className="text-[9px] text-muted-foreground">Fat (lbs)</div>
                {prev && <DeltaBadge val={delta(selected.fatMassLbs, prev.fatMassLbs)} unit="" invert />}
              </CardContent></Card>
            </div>
          )}

          {/* Sub-tabs for organized viewing */}
          <Tabs defaultValue="overview" className="w-full" onValueChange={(v) => setActiveTab(v)}>
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="regional" className="text-xs">Regional</TabsTrigger>
              <TabsTrigger value="trends" className="text-xs">Trends</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">Scans</TabsTrigger>
            </TabsList>

            {/* Scan selector — only on Overview & Regional */}
            {scans.length > 1 && (activeTab === "overview" || activeTab === "regional") && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">Viewing:</span>
                <Select value={String(selectedIdx)} onValueChange={(v) => setSelectedIdx(parseInt(v))}>
                  <SelectTrigger className="h-7 text-xs w-auto"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scans.map((s, i) => (
                      <SelectItem key={s.id} value={String(i)} className="text-xs">
                        {safeFmt(s.scanDate, "MMM d, yyyy")}{i === 0 ? " (Latest)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-4 mt-3">
              {selected && (
                <>
                  {/* Composition Pie + Stats */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Body Composition — {safeFmt(selected.scanDate, "MMM d, yyyy")}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="w-[130px] h-[130px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={[
                              { name: "Fat", value: selected.fatMassLbs },
                              { name: "Lean", value: selected.leanMassLbs },
                              ...(selected.boneMassLbs ? [{ name: "Bone", value: selected.boneMassLbs }] : []),
                            ]} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" strokeWidth={2}>
                              {PIE_COLORS.slice(0, selected.boneMassLbs ? 3 : 2).map((c, i) => <Cell key={i} fill={c} />)}
                            </Pie><Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: number) => `${Math.round(v)} lbs`} /></PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm flex-1">
                          <div><span className="text-muted-foreground text-xs">Fat:</span> <strong>{Math.round(selected.fatMassLbs)} lbs</strong></div>
                          <div><span className="text-muted-foreground text-xs">Lean:</span> <strong>{Math.round(selected.leanMassLbs)} lbs</strong></div>
                          {selected.boneMassLbs && <div><span className="text-muted-foreground text-xs">Bone:</span> <strong>{Math.round(selected.boneMassLbs)} lbs</strong></div>}
                          {selected.visceralFat != null && <div><span className="text-muted-foreground text-xs">VAT:</span> <strong>{selected.visceralFat}</strong></div>}
                          {selected.agRatio != null && <div><span className="text-muted-foreground text-xs">A/G:</span> <strong>{selected.agRatio}</strong></div>}
                          {selected.bmdGcm2 != null && <div><span className="text-muted-foreground text-xs">BMD:</span> <strong>{selected.bmdGcm2}</strong></div>}
                          {selected.tScore != null && <div><span className="text-muted-foreground text-xs">T-Score:</span> <strong>{selected.tScore}</strong></div>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Fat vs Lean stacked bar */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fat vs Lean Ratio</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span>Lean {Math.round(100 - selected.bodyFatPct)}%</span><span>Fat {selected.bodyFatPct}%</span></div>
                          <div className="w-full h-6 rounded-full overflow-hidden flex">
                            <div className="bg-blue-500 h-full transition-all" style={{ width: `${100 - selected.bodyFatPct}%` }} />
                            <div className="bg-red-400 h-full transition-all" style={{ width: `${selected.bodyFatPct}%` }} />
                          </div>
                        </div>
                        {selected.androidFatPct != null && selected.gynoidFatPct != null && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="text-center p-2 bg-muted rounded-lg">
                              <div className="text-lg font-bold">{selected.androidFatPct}%</div>
                              <div className="text-[10px] text-muted-foreground">Android (Abdominal)</div>
                            </div>
                            <div className="text-center p-2 bg-muted rounded-lg">
                              <div className="text-lg font-bold">{selected.gynoidFatPct}%</div>
                              <div className="text-[10px] text-muted-foreground">Gynoid (Hip)</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radar chart for fat distribution */}
                  {radarData.length >= 3 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fat Distribution Radar</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <RadarChart data={radarData}>
                            <PolarGrid className="stroke-muted" />
                            <PolarAngleAxis dataKey="region" tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis tick={{ fontSize: 9 }} />
                            <Radar dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} strokeWidth={2} name="Fat %" />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* REGIONAL TAB */}
            <TabsContent value="regional" className="space-y-4 mt-3">
              {selected && (
                <>
                  {/* Regional fat % bars */}
                  {(selected.trunkFatPct || selected.armsFatPct || selected.legsFatPct) && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Regional Fat %</CardTitle></CardHeader>
                      <CardContent>
                        {[
                          { region: "Trunk", pct: selected.trunkFatPct, color: "#8b5cf6" },
                          { region: "Arms", pct: selected.armsFatPct, color: "#3b82f6" },
                          { region: "Legs", pct: selected.legsFatPct, color: "#10b981" },
                        ].filter((r) => r.pct != null).map((r) => (
                          <div key={r.region} className="mb-2">
                            <div className="flex justify-between text-xs mb-0.5"><span>{r.region}</span><span className="font-medium">{r.pct}%</span></div>
                            <div className="w-full bg-muted rounded-full h-3">
                              <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min((r.pct||0)/50*100, 100)}%`, backgroundColor: r.color }} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Regional lean mass bar chart */}
                  {selected.trunkLeanLbs && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lean Mass by Region</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={[
                            { region: "Trunk", lbs: selected.trunkLeanLbs },
                            { region: "Arms", lbs: selected.armsLeanLbs },
                            { region: "Legs", lbs: selected.legsLeanLbs },
                          ].filter((d) => d.lbs)}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="region" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} unit=" lbs" />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                            <Bar dataKey="lbs" radius={[6, 6, 0, 0]} name="Lean Mass">
                              {REGION_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Regional fat mass bar chart */}
                  {selected.trunkFatLbs && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Fat Mass by Region</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={[
                            { region: "Trunk", lbs: selected.trunkFatLbs },
                            { region: "Arms", lbs: selected.armsFatLbs },
                            { region: "Legs", lbs: selected.legsFatLbs },
                          ].filter((d) => d.lbs)}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="region" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} unit=" lbs" />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                            <Bar dataKey="lbs" radius={[6, 6, 0, 0]} name="Fat Mass">
                              {["#ef4444", "#f59e0b", "#f97316"].map((c, i) => <Cell key={i} fill={c} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Regional pie: lean distribution */}
                  {selected.trunkLeanLbs && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Where Your Lean Mass Lives</CardTitle></CardHeader>
                      <CardContent className="flex justify-center">
                        <div className="flex justify-center items-center gap-6">
                          <div className="w-[140px] h-[140px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={[
                                  { name: "Trunk", value: selected.trunkLeanLbs || 0 },
                                  { name: "Arms", value: selected.armsLeanLbs || 0 },
                                  { name: "Legs", value: selected.legsLeanLbs || 0 },
                                ]} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value">
                                  {REGION_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: number) => `${Math.round(v)} lbs`} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              const items = [
                                { name: "Trunk", value: selected.trunkLeanLbs || 0, color: REGION_COLORS[0] },
                                { name: "Arms", value: selected.armsLeanLbs || 0, color: REGION_COLORS[1] },
                                { name: "Legs", value: selected.legsLeanLbs || 0, color: REGION_COLORS[2] },
                              ].filter((r) => r.value > 0);
                              const total = items.reduce((s, r) => s + r.value, 0);
                              // Use largest remainder method so percentages sum to 100
                              const rawPcts = items.map((r) => ({ ...r, rawPct: total > 0 ? (r.value / total) * 100 : 0 }));
                              const floored = rawPcts.map((r) => ({ ...r, pct: Math.floor(r.rawPct), remainder: r.rawPct - Math.floor(r.rawPct) }));
                              let remaining = 100 - floored.reduce((s, r) => s + r.pct, 0);
                              floored.sort((a, b) => b.remainder - a.remainder);
                              for (const r of floored) { if (remaining > 0) { r.pct++; remaining--; } }
                              floored.sort((a, b) => items.findIndex((i) => i.name === a.name) - items.findIndex((i) => i.name === b.name));
                              return floored.map((r) => (
                                <div key={r.name} className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
                                  <span className="text-sm font-medium">{r.name}</span>
                                  <span className="text-sm text-muted-foreground">{Math.round(r.value)} lbs ({r.pct}%)</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* TRENDS TAB */}
            <TabsContent value="trends" className="space-y-4 mt-3">
              {sorted.length < 2 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Need at least 2 scans to show trends.</CardContent></Card>
              ) : (
                <>
                  {/* Weight trend */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Weight</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={sorted.map((s) => ({ date: safeFmt(s.scanDate, "M/d/yy"), weight: s.totalWeightLbs || Math.round(s.leanMassLbs + s.fatMassLbs + (s.boneMassLbs||0)) }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} unit=" lbs" domain={["dataMin - 3", "dataMax + 3"]} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                          <Area type="monotone" dataKey="weight" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} dot={{ r: 4 }} name="Weight" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Body fat % + fat mass */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Body Fat % & Fat Mass</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={sorted.map((s) => ({ date: safeFmt(s.scanDate, "M/d/yy"), pct: s.bodyFatPct, lbs: Math.round(s.fatMassLbs) }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="pct" tick={{ fontSize: 10 }} unit="%" domain={["dataMin - 1", "dataMax + 1"]} />
                          <YAxis yAxisId="lbs" orientation="right" tick={{ fontSize: 10 }} unit=" lbs" />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                          <Line yAxisId="pct" type="monotone" dataKey="pct" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Fat %" />
                          <Line yAxisId="lbs" type="monotone" dataKey="lbs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Fat (lbs)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Lean mass total + regional */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Lean Mass Over Time</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={sorted.map((s) => ({ date: safeFmt(s.scanDate, "M/d/yy"), total: Math.round(s.leanMassLbs), trunk: s.trunkLeanLbs, arms: s.armsLeanLbs, legs: s.legsLeanLbs }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} unit=" lbs" />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                          <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} dot={{ r: 4 }} name="Total" />
                          {sorted.some((s) => s.trunkLeanLbs) && <Line type="monotone" dataKey="trunk" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 3 }} name="Trunk" />}
                          {sorted.some((s) => s.armsLeanLbs) && <Line type="monotone" dataKey="arms" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} name="Arms" />}
                          {sorted.some((s) => s.legsLeanLbs) && <Line type="monotone" dataKey="legs" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Legs" />}
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {false && (
                    <Card></Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* HISTORY TAB */}
            <TabsContent value="history" className="space-y-3 mt-3">
              {scans.map((scan) => (
                <Card key={scan.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium">{safeFmt(scan.scanDate, "MMM d, yyyy")}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {scan.bodyFatPct}% BF · {Math.round(scan.leanMassLbs)} lbs lean · {Math.round(scan.fatMassLbs)} lbs fat
                        </div>
                        {scan.trunkFatPct && (
                          <div className="text-xs text-muted-foreground">Trunk {scan.trunkFatPct}% · Arms {scan.armsFatPct}% · Legs {scan.legsFatPct}%</div>
                        )}
                        <div className="flex gap-2 mt-1">
                          {scan.fileUrl && <a href={scan.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View Scan</a>}
                          {scan.notes && <span className="text-xs text-muted-foreground italic">{scan.notes}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteScan(scan.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
