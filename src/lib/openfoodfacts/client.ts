import { SimplifiedFood } from "@/lib/usda/types";

const OFF_BASE_URL = "https://world.openfoodfacts.org";

export async function searchOpenFoodFacts(
  query: string,
  pageSize = 10
): Promise<SimplifiedFood[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(pageSize),
    fields: "code,product_name,brands,nutriments",
  });

  const response = await fetch(`${OFF_BASE_URL}/cgi/search.pl?${params}`, {
    headers: { "User-Agent": "FitLedger/1.0 (personal fitness tracker)" },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const products = data.products || [];

  return products
    .filter((p: Record<string, unknown>) => p.product_name && p.nutriments)
    .map((p: Record<string, Record<string, number> & { brands?: string }>) => {
      const n = p.nutriments || {};
      const brand = p.brands ? ` (${p.brands})` : "";
      return {
        fdcId: parseInt(p.code as unknown as string) || 0,
        name: `${p.product_name}${brand}`,
        caloriesPer100g: n["energy-kcal_100g"] || n["energy-kcal"] || 0,
        proteinPer100g: n["proteins_100g"] || 0,
        carbsPer100g: n["carbohydrates_100g"] || 0,
        fatPer100g: n["fat_100g"] || 0,
        fiberPer100g: n["fiber_100g"] || 0,
        sugarPer100g: n["sugars_100g"] || 0,
        sodiumPer100g: (n["sodium_100g"] || 0) * 1000, // convert g to mg
        dataType: "OpenFoodFacts",
      };
    });
}
