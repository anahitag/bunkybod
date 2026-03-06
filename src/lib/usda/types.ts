export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: USDAFoodNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

export interface USDASearchResponse {
  totalHits: number;
  foods: USDAFoodItem[];
}

export interface SimplifiedFood {
  fdcId: number;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
  sodiumPer100g: number;
  dataType: string;
}
