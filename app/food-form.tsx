"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { FOOD_PRESETS, scaleFoodPreset, type FoodPreset } from "../lib/food-presets";
import type { FoodEntry } from "../lib/model";

const NUTRIENTS = [
  { name: "calories", label: "Calories (kcal)", max: 100000 },
  { name: "protein", label: "Protein (g)", max: 10000 },
  { name: "carbs", label: "Carbs (g)", max: 10000 },
  { name: "fat", label: "Fat (g)", max: 10000 },
] as const;
type Nutrient = typeof NUTRIENTS[number]["name"];
type NutritionFields = Record<Nutrient, string>;
const EMPTY_NUTRITION: NutritionFields = { calories: "", protein: "", carbs: "", fat: "" };
const BRANDS: FoodPreset["brand"][] = ["David", "Fairlife", "Chipotle"];

export default function FoodForm({ date, maxDate, onSave }: {
  date: string;
  maxDate: string;
  onSave: (food: Omit<FoodEntry, "id">) => boolean;
}) {
  const id = useId();
  const [presetId, setPresetId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [name, setName] = useState("");
  const [entryDate, setEntryDate] = useState(date);
  const [nutrition, setNutrition] = useState<NutritionFields>(EMPTY_NUTRITION);
  const [error, setError] = useState("");
  const preset = FOOD_PRESETS.find(item => item.id === presetId);
  const validQuantity = quantity.trim() !== "" && Number.isFinite(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= 100;

  function fillPreset(selected: FoodPreset, amount: number) {
    const scaled = scaleFoodPreset(selected, amount);
    setName(scaled.name);
    setNutrition({ calories: String(scaled.calories), protein: String(scaled.protein), carbs: String(scaled.carbs), fat: String(scaled.fat) });
  }

  function choosePreset(value: string) {
    setPresetId(value);
    setQuantity("1");
    setError("");
    const selected = FOOD_PRESETS.find(item => item.id === value);
    if (selected) fillPreset(selected, 1);
  }

  function changeQuantity(value: string) {
    setQuantity(value);
    setError("");
    const amount = Number(value);
    if (preset && value.trim() !== "" && Number.isFinite(amount) && amount > 0 && amount <= 100) {
      fillPreset(preset, amount);
    } else {
      setNutrition(EMPTY_NUTRITION);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preset && !validQuantity) return;
    if (!name.trim()) {
      setError("Enter a food name before saving.");
      return;
    }
    if (NUTRIENTS.some(field => nutrition[field.name].trim() === "" || !Number.isFinite(Number(nutrition[field.name])) || Number(nutrition[field.name]) < 0 || Number(nutrition[field.name]) > field.max)) {
      setError("Enter valid nutrition values for the amount you ate.");
      return;
    }
    const accepted = onSave({
      date: entryDate,
      name: name.trim(),
      calories: Number(nutrition.calories),
      protein: Number(nutrition.protein),
      carbs: Number(nutrition.carbs),
      fat: Number(nutrition.fat),
    });
    if (!accepted) setError("Food was not added. Resolve the journal recovery notice, then try again.");
  }

  return <form className="food-form" onSubmit={submit}>
    <label>Preset food
      <select value={presetId} onChange={event => choosePreset(event.target.value)} autoFocus>
        <option value="">Custom food / manual entry</option>
        {BRANDS.map(brand => <optgroup key={brand} label={brand}>
          {FOOD_PRESETS.filter(item => item.brand === brand).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </optgroup>)}
      </select>
    </label>
    {preset && <div className="food-preset-details">
      <p id={`${id}-serving`}><strong>1 serving:</strong> {preset.serving}</p>
      <label>Servings eaten
        <input type="number" value={quantity} onChange={event => changeQuantity(event.target.value)} min="0" max="100" step="any" inputMode="decimal" required aria-invalid={!validQuantity} aria-describedby={`${id}-serving ${id}-quantity-help${!validQuantity ? ` ${id}-quantity-error` : ""}`} />
      </label>
      <p id={`${id}-quantity-help`}>Use 0.5 for half or 2 for double. Changing the preset or servings resets the name and nutrition below.</p>
      {!validQuantity && <p className="food-form-error" id={`${id}-quantity-error`} role="alert">Enter a serving amount greater than 0 and no more than 100.</p>}
      {preset.notes && <p>{preset.notes}</p>}
      {preset.brand === "Chipotle" && <p>Restaurant portions vary; adjust values as needed.</p>}
      <a href={preset.sourceUrl} target="_blank" rel="noreferrer" aria-label="Official nutrition source (opens in a new tab)">Official nutrition source ↗</a>
    </div>}
    <label>Food / meal<input name="name" value={name} onChange={event => { setName(event.target.value); setError(""); }} placeholder="e.g. Chicken rice bowl" maxLength={160} required /></label>
    <label>Date<input type="date" name="date" value={entryDate} onChange={event => setEntryDate(event.target.value)} max={maxDate} required /></label>
    <p className="food-nutrition-hint">{preset ? "Nutrition for the full amount above. You can edit these totals before saving." : "Enter the nutrition for the portion you ate."}</p>
    <div className="form-grid">{NUTRIENTS.map(field => <label key={field.name}>{field.label}
      <input type="number" name={field.name} value={nutrition[field.name]} onChange={event => { setNutrition(previous => ({ ...previous, [field.name]: event.target.value })); setError(""); }} min="0" max={field.max} step="any" placeholder="0" inputMode="decimal" required />
    </label>)}</div>
    {error && <p className="food-form-error" role="alert">{error}</p>}
    <button className="button primary full-width" type="submit" disabled={Boolean(preset && !validQuantity)}><Plus size={16} /> Add to food log</button>
  </form>;
}
