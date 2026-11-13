export type FoodNutrition = { name: string; calories: number; protein: number; carbs: number; fat: number };
export type FoodPreset = FoodNutrition & {
  id: string;
  brand: "David" | "Fairlife" | "Chipotle";
  serving: string;
  sourceUrl: string;
  notes?: string;
};

// Official US product labels/menu, checked 2026-11-12. Preserve the labelled
// calories rather than recomputing them from macros (fiber/polyols can differ).
// These templates never rewrite a previously saved food entry.
const gold = (slug: string, flavor: string, fat = 2, carbs = 12, notes?: string): FoodPreset => ({
  id: `david-gold-${slug}`, brand: "David", name: `David Gold — ${flavor}`,
  serving: "1 bar", calories: 150, protein: 28, carbs, fat,
  sourceUrl: `https://davidprotein.com/products/${slug}`, notes,
});
const chipotleSource = "https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf";

export const FOOD_PRESETS: readonly FoodPreset[] = [
  gold("chocolate-chip-cookie-dough", "Chocolate Chip Cookie Dough"),
  gold("peanut-butter-chocolate-chunk", "Peanut Butter Chocolate Chunk", 2.5),
  gold("fudge-brownie", "Fudge Brownie"),
  gold("blueberry-pie", "Blueberry Pie"),
  gold("cinnamon-roll", "Cinnamon Roll"),
  gold("salted-peanut-butter", "Salted Peanut Butter", 2.5),
  gold("cake-batter", "Cake Batter"),
  gold("red-velvet", "Red Velvet"),
  gold("pumpkin-spice", "Pumpkin Spice", 2, 9, "Seasonal flavor. Check your wrapper if its nutrition differs."),
  {
    id: "fairlife-nutrition-plan-chocolate", brand: "Fairlife", name: "Fairlife Nutrition Plan — Chocolate",
    serving: "1 bottle (11.5 fl oz / 340 mL)", calories: 150, protein: 30, carbs: 4, fat: 2.5,
    sourceUrl: "https://fairlife.com/nutrition-plan/chocolate/",
  },
  {
    id: "fairlife-nutrition-plan-vanilla", brand: "Fairlife", name: "Fairlife Nutrition Plan — Vanilla",
    serving: "1 bottle (11.5 fl oz / 340 mL)", calories: 150, protein: 30, carbs: 3, fat: 2.5,
    sourceUrl: "https://fairlife.com/nutrition-plan/vanilla/",
  },
  // The current official High Protein Menu lists Chicken and Steak cups.
  // Seasonal and other protein sides are not silently treated as these cups.
  {
    id: "chipotle-protein-cup-chicken", brand: "Chipotle", name: "Chipotle High Protein Cup — Chicken",
    serving: "1 cup (4 oz chicken)", calories: 180, protein: 32, carbs: 0, fat: 7,
    sourceUrl: chipotleSource,
  },
  {
    id: "chipotle-protein-cup-steak", brand: "Chipotle", name: "Chipotle High Protein Cup — Steak",
    serving: "1 cup (4 oz steak)", calories: 150, protein: 21, carbs: 1, fat: 6,
    sourceUrl: chipotleSource,
  },
  {
    id: "chipotle-three-crispy-chicken-tacos", brand: "Chipotle", name: "Chipotle — 3 crispy chicken tacos",
    serving: "3 crispy corn tacos with chicken, cheese & mild tomato salsa",
    // Three 70-kcal shells + one total 4-oz chicken portion + 1-oz cheese +
    // 4-oz fresh tomato salsa across the whole three-taco order.
    calories: 525, protein: 41, carbs: 35, fat: 24, sourceUrl: chipotleSource,
    notes: "Standard order: 3 shells, 4 oz chicken, 1 oz cheese and 4 oz mild salsa total. No other fillings.",
  },
  {
    id: "chipotle-burrito-tortilla", brand: "Chipotle", name: "Chipotle — Burrito flour tortilla",
    serving: "1 large burrito tortilla", calories: 320, protein: 8, carbs: 50, fat: 9,
    sourceUrl: chipotleSource, notes: "The large side tortilla, not a small taco tortilla.",
  },
];

export function scaleFoodPreset(preset: FoodPreset, quantity: number): FoodNutrition {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
    throw new Error("Enter a quantity greater than 0 and no more than 100.");
  }
  const scaled = (value: number) => Math.round(value * quantity * 10) / 10;
  return {
    name: quantity === 1 ? preset.name : `${preset.name} × ${quantity}`,
    calories: scaled(preset.calories), protein: scaled(preset.protein),
    carbs: scaled(preset.carbs), fat: scaled(preset.fat),
  };
}
