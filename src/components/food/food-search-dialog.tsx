"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Loader2 } from "lucide-react";
import { SimplifiedFood } from "@/lib/usda/types";
import { format } from "date-fns";
import { toast } from "sonner";

interface FoodSearchDialogProps {
  date: string;
  onLogged: () => void;
}

export function FoodSearchDialog({ date, onLogged }: FoodSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimplifiedFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SimplifiedFood | null>(null);
  const [servingGrams, setServingGrams] = useState(100);
  const [mealType, setMealType] = useState("lunch");
  const [logging, setLogging] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/food/search?query=${encodeURIComponent(query)}&pageSize=8`);
      const data = await res.json();
      setResults(data.foods || []);
    } catch {
      toast.error("Failed to search foods");
    } finally {
      setSearching(false);
    }
  }, [query]);

  function selectFood(food: SimplifiedFood) {
    setSelected(food);
    setServingGrams(100);
  }

  function scaled(per100g: number) {
    return Math.round((per100g * servingGrams) / 100);
  }

  async function logFood() {
    if (!selected) return;
    setLogging(true);
    try {
      await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mealType,
          foodName: selected.name,
          fdcId: selected.fdcId,
          servingSize: servingGrams,
          servingUnit: "g",
          calories: scaled(selected.caloriesPer100g),
          proteinG: scaled(selected.proteinPer100g),
          carbsG: scaled(selected.carbsPer100g),
          fatG: scaled(selected.fatPer100g),
          fiberG: scaled(selected.fiberPer100g),
          sugarG: scaled(selected.sugarPer100g),
          sodiumMg: scaled(selected.sodiumPer100g),
          loggedVia: "search",
        }),
      });
      toast.success(`Logged ${selected.name}`);
      setOpen(false);
      setQuery("");
      setResults([]);
      setSelected(null);
      onLogged();
    } catch {
      toast.error("Failed to log food");
    } finally {
      setLogging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add Food
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Foods — {format(new Date(date + "T12:00:00"), "MMM d, yyyy")}</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search foods (e.g. chicken breast)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button onClick={search} disabled={searching} size="icon" variant="outline">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {results.map((food) => (
                  <button
                    key={food.fdcId}
                    onClick={() => selectFood(food)}
                    className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize flex-1">
                        {food.name.toLowerCase()}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        food.dataType === "OpenFoodFacts"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      }`}>
                        {food.dataType === "OpenFoodFacts" ? "OFF" : "USDA"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Per 100g: {Math.round(food.caloriesPer100g)} kcal ·{" "}
                      {Math.round(food.proteinPer100g)}g P ·{" "}
                      {Math.round(food.carbsPer100g)}g C ·{" "}
                      {Math.round(food.fatPer100g)}g F
                    </div>
                  </button>
                ))}
                {results.length === 0 && !searching && query && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No results. Try a different search term.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium capitalize">{selected.name.toLowerCase()}</h3>
              <p className="text-sm text-muted-foreground">USDA #{selected.fdcId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Serving Size (g)</Label>
                <Input
                  type="number"
                  value={servingGrams}
                  onChange={(e) => setServingGrams(Math.max(1, parseInt(e.target.value) || 0))}
                  min={1}
                />
              </div>
              <div>
                <Label>Meal</Label>
                <Select value={mealType} onValueChange={setMealType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-2">
                <div className="text-lg font-bold text-blue-600">{scaled(selected.caloriesPer100g)}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-md p-2">
                <div className="text-lg font-bold text-red-600">{scaled(selected.proteinPer100g)}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 rounded-md p-2">
                <div className="text-lg font-bold text-amber-600">{scaled(selected.carbsPer100g)}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 rounded-md p-2">
                <div className="text-lg font-bold text-purple-600">{scaled(selected.fatPer100g)}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                Back
              </Button>
              <Button className="flex-1" onClick={logFood} disabled={logging}>
                {logging ? "Logging..." : "Log It"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
