"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FoodEntry {
  id: string;
  foodName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize: number;
  servingUnit: string;
}

interface MealBreakdownProps {
  entries: FoodEntry[];
  onDeleted: () => void;
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealBreakdown({ entries, onDeleted }: MealBreakdownProps) {
  async function deleteEntry(id: string) {
    try {
      await fetch("/api/food-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast.success("Entry removed");
      onDeleted();
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  const grouped = MEAL_ORDER.map((meal) => ({
    meal,
    label: MEAL_LABELS[meal] || meal,
    items: entries.filter((e) => e.mealType === meal || (meal === "snack" && !MEAL_ORDER.includes(e.mealType))),
  })).filter((g) => g.items.length > 0);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No food logged yet today. Use the input bar or Add Food button to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ meal, label, items }) => {
        const mealCals = Math.round(items.reduce((s, e) => s + e.calories, 0));
        return (
          <Card key={meal}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {mealCals} kcal
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-1.5 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium capitalize truncate">
                      {entry.foodName.toLowerCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(entry.calories)} kcal · {Math.round(entry.proteinG)}g P · {Math.round(entry.carbsG)}g C · {Math.round(entry.fatG)}g F
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
