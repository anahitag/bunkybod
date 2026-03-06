"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, Save, User, Target, Brain } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  name: string;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  goalType: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
}

interface FoodMemory {
  id: string;
  foodName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingDesc: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memories, setMemories] = useState<FoodMemory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then(setProfile);
    fetch("/api/food-memory").then((r) => r.json()).then((d) => setMemories(d.memories || []));
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(id: string) {
    await fetch("/api/food-memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.success("Memory removed.");
  }

  if (!profile) return <div className="max-w-2xl mx-auto p-4"><p className="text-muted-foreground">Loading...</p></div>;

  const weightLbs = profile.currentWeightKg ? Math.round(profile.currentWeightKg * 2.20462) : "";
  const heightFeet = profile.heightCm ? Math.floor(profile.heightCm / 2.54 / 12) : "";
  const heightInches = profile.heightCm ? Math.round((profile.heightCm / 2.54) % 12) : "";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <Label>Age</Label>
              <Input type="number" value={profile.age || ""} onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || null })} />
            </div>
            <div>
              <Label>Weight (lbs)</Label>
              <Input
                type="number"
                value={weightLbs}
                onChange={(e) => setProfile({ ...profile, currentWeightKg: parseFloat(e.target.value) * 0.453592 || null })}
              />
            </div>
            <div>
              <Label>Height</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="ft"
                  value={heightFeet}
                  onChange={(e) => {
                    const ft = parseInt(e.target.value) || 0;
                    const inches = profile.heightCm ? Math.round((profile.heightCm / 2.54) % 12) : 0;
                    setProfile({ ...profile, heightCm: (ft * 12 + inches) * 2.54 });
                  }}
                />
                <Input
                  type="number"
                  placeholder="in"
                  value={heightInches}
                  onChange={(e) => {
                    const inches = parseInt(e.target.value) || 0;
                    const ft = profile.heightCm ? Math.floor(profile.heightCm / 2.54 / 12) : 0;
                    setProfile({ ...profile, heightCm: (ft * 12 + inches) * 2.54 });
                  }}
                />
              </div>
            </div>
          </div>
          <div>
            <Label>Goal</Label>
            <Select value={profile.goalType} onValueChange={(v) => setProfile({ ...profile, goalType: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Fat Loss</SelectItem>
                <SelectItem value="gain">Muscle Gain</SelectItem>
                <SelectItem value="maintain">Maintenance</SelectItem>
                <SelectItem value="recomp">Body Recomposition</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" /> Daily Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Calories</Label>
              <Input type="number" value={profile.calorieTarget} onChange={(e) => setProfile({ ...profile, calorieTarget: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Protein (g)</Label>
              <Input type="number" value={profile.proteinTargetG} onChange={(e) => setProfile({ ...profile, proteinTargetG: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Carbs (g)</Label>
              <Input type="number" value={profile.carbTargetG} onChange={(e) => setProfile({ ...profile, carbTargetG: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Fat (g)</Label>
              <Input type="number" value={profile.fatTargetG} onChange={(e) => setProfile({ ...profile, fatTargetG: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Fiber (g)</Label>
              <Input type="number" value={profile.fiberTargetG} onChange={(e) => setProfile({ ...profile, fiberTargetG: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={saveProfile} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      <Separator />

      {/* Food Memories */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" /> Food Memory ({memories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No saved foods yet. Tell the AI specific nutrition for foods you eat often and it will remember them.
            </p>
          ) : (
            <div className="space-y-1">
              {memories.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 group">
                  <div>
                    <div className="text-sm font-medium capitalize">{m.foodName}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.servingDesc} · {Math.round(m.calories)} cal · {Math.round(m.proteinG)}g P · {Math.round(m.carbsG)}g C · {Math.round(m.fatG)}g F
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteMemory(m.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
