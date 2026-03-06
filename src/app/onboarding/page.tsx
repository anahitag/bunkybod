"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: "",
    age: "",
    heightFeet: "",
    heightInches: "",
    weightLbs: "",
    goalType: "maintain",
    calorieTarget: "2000",
    proteinTargetG: "150",
    carbTargetG: "250",
    fatTargetG: "65",
    fiberTargetG: "30",
  });

  function update(field: string, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFinish() {
    setSaving(true);
    const heightCm =
      profile.heightFeet && profile.heightInches
        ? (parseInt(profile.heightFeet) * 12 + parseInt(profile.heightInches)) * 2.54
        : null;
    const currentWeightKg = profile.weightLbs
      ? parseFloat(profile.weightLbs) * 0.453592
      : null;

    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name || "User",
        age: profile.age ? parseInt(profile.age) : null,
        heightCm,
        currentWeightKg,
        goalType: profile.goalType,
        calorieTarget: parseInt(profile.calorieTarget) || 2000,
        proteinTargetG: parseInt(profile.proteinTargetG) || 150,
        carbTargetG: parseInt(profile.carbTargetG) || 250,
        fatTargetG: parseInt(profile.fatTargetG) || 65,
        fiberTargetG: parseInt(profile.fiberTargetG) || 30,
        onboarded: true,
      }),
    });

    router.push("/home");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === 1 ? "Welcome to Bod" : "Set Your Goals"}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? "Let's set up your profile to personalize your experience."
              : "Configure your daily nutrition targets."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={profile.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="30"
                  value={profile.age}
                  onChange={(e) => update("age", e.target.value)}
                />
              </div>
              <div>
                <Label>Height</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Feet"
                      value={profile.heightFeet}
                      onChange={(e) => update("heightFeet", e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Inches"
                      value={profile.heightInches}
                      onChange={(e) => update("heightInches", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="weight">Current Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="185"
                  value={profile.weightLbs}
                  onChange={(e) => update("weightLbs", e.target.value)}
                />
              </div>
              <div>
                <Label>Primary Goal</Label>
                <Select value={profile.goalType} onValueChange={(v) => update("goalType", v)}>
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
              <Button className="w-full" onClick={() => setStep(2)}>
                Next: Set Goals
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="calories">Daily Calorie Target</Label>
                <Input
                  id="calories"
                  type="number"
                  value={profile.calorieTarget}
                  onChange={(e) => update("calorieTarget", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="protein">Protein Target (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  value={profile.proteinTargetG}
                  onChange={(e) => update("proteinTargetG", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="carbs">Carbs Target (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  value={profile.carbTargetG}
                  onChange={(e) => update("carbTargetG", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fat">Fat Target (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  value={profile.fatTargetG}
                  onChange={(e) => update("fatTargetG", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fiber">Fiber Target (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  value={profile.fiberTargetG}
                  onChange={(e) => update("fiberTargetG", e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleFinish} disabled={saving}>
                  {saving ? "Saving..." : "Finish Setup"}
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-center gap-2 mt-4">
            <div className={`h-2 w-8 rounded-full ${step === 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-8 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
