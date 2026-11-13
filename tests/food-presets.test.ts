import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { FOOD_PRESETS, scaleFoodPreset } from "../lib/food-presets.ts";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { newState, validateState } from "../lib/model.ts";

const preset = (id: string) => {
  const found = FOOD_PRESETS.find(food => food.id === id);
  assert.ok(found, `Missing preset: ${id}`);
  return found;
};

test("fractional servings scale the original label and keep its declared calories", () => {
  const bar = preset("david-gold-salted-peanut-butter");
  const original = structuredClone(bar);
  assert.deepEqual(scaleFoodPreset(bar, 2), { name: `${bar.name} × 2`, calories: 300, protein: 56, carbs: 24, fat: 5 });
  assert.deepEqual(scaleFoodPreset(bar, .5), { name: `${bar.name} × 0.5`, calories: 75, protein: 14, carbs: 6, fat: 1.3 });
  assert.deepEqual(bar, original);
  for (const invalid of [0, -1, NaN, Infinity, 100.01]) assert.throws(() => scaleFoodPreset(bar, invalid), /quantity/);
});

test("presets create ordinary journal snapshots without altering earlier foods", () => {
  const state = newState();
  const oldFood = { id: "historical-food", date: "2026-11-10", name: "Existing custom meal", calories: 410, protein: 21, carbs: 40, fat: 18 };
  state.foods.push(oldFood);
  const shake = scaleFoodPreset(preset("fairlife-nutrition-plan-chocolate"), 2);
  state.foods.push({ id: "new-food", date: "2026-11-12", ...shake });
  // A user may correct the label without mutating its reusable template.
  state.foods[1].calories = 310;
  const saved = validateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(saved.foods[0], oldFood);
  assert.equal(saved.foods[1].date, "2026-11-12");
  assert.equal(saved.foods[1].calories, 310);
  assert.equal(saved.foods[1].protein, 60);
  assert.equal(preset("fairlife-nutrition-plan-chocolate").calories, 150);
  assert.equal(saved.schemaVersion, 2);
});

test("three-taco preset uses one total filling portion and the side tortilla adds separately", () => {
  const tacos = scaleFoodPreset(preset("chipotle-three-crispy-chicken-tacos"), 1);
  const tortilla = scaleFoodPreset(preset("chipotle-burrito-tortilla"), 1);
  assert.equal(tacos.calories, 3 * 70 + 180 + 110 + 25);
  assert.deepEqual([tacos.protein, tacos.carbs, tacos.fat], [41, 35, 24]);
  assert.deepEqual([tacos.calories + tortilla.calories, tacos.protein + tortilla.protein, tacos.carbs + tortilla.carbs, tacos.fat + tortilla.fat], [845, 49, 85, 33]);
});

test("every template has a unique ID, an official source, and validates at the quantity limit", () => {
  assert.equal(new Set(FOOD_PRESETS.map(food => food.id)).size, FOOD_PRESETS.length);
  const state = newState();
  for (const food of FOOD_PRESETS) {
    assert.ok(["davidprotein.com", "fairlife.com", "www.chipotle.com"].includes(new URL(food.sourceUrl).hostname));
    state.foods.push({ id: food.id, date: "2026-11-12", ...scaleFoodPreset(food, 100) });
  }
  assert.equal(validateState(state).foods.length, FOOD_PRESETS.length);
});
