import { USDASearchResponse, SimplifiedFood } from "./types";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts/client";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// USDA nutrient numbers
const NUTRIENT_IDS = {
  calories: "208",
  protein: "203",
  carbs: "205",
  fat: "204",
  fiber: "291",
  sugar: "269",
  sodium: "307",
} as const;

function getNutrientValue(
  nutrients: { nutrientNumber: string; value: number }[],
  nutrientNumber: string
): number {
  const n = nutrients.find((n) => n.nutrientNumber === nutrientNumber);
  return n?.value ?? 0;
}

export async function searchFoods(
  query: string,
  pageSize = 10
): Promise<SimplifiedFood[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    throw new Error("USDA_API_KEY not configured");
  }

  const url = `${USDA_BASE_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=${pageSize}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`USDA API error: ${response.status}`);
  }

  const data: USDASearchResponse = await response.json();

  return data.foods.map((food) => ({
    fdcId: food.fdcId,
    name: food.description,
    caloriesPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.calories),
    proteinPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.protein),
    carbsPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.carbs),
    fatPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.fat),
    fiberPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.fiber),
    sugarPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.sugar),
    sodiumPer100g: getNutrientValue(food.foodNutrients, NUTRIENT_IDS.sodium),
    dataType: food.dataType,
  }));
}

/**
 * Combined search: USDA + Open Food Facts.
 * Searches both in parallel. USDA results come first, then OFF results
 * (deduped). For branded queries, OFF often has better matches.
 */
export async function searchAllFoods(
  query: string,
  pageSize = 10
): Promise<SimplifiedFood[]> {
  const [usdaResults, offResults] = await Promise.allSettled([
    searchFoods(query, pageSize),
    searchOpenFoodFacts(query, pageSize),
  ]);

  const usda = usdaResults.status === "fulfilled" ? usdaResults.value : [];
  const off = offResults.status === "fulfilled" ? offResults.value : [];

  // Interleave: USDA first, then OFF results that aren't duplicates
  const seen = new Set(usda.map((f) => f.name.toLowerCase()));
  const combined = [...usda];

  for (const food of off) {
    if (!seen.has(food.name.toLowerCase()) && food.caloriesPer100g > 0) {
      combined.push(food);
      seen.add(food.name.toLowerCase());
    }
  }

  return combined.slice(0, pageSize);
}
