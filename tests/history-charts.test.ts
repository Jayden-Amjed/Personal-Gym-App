import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { buildHistorySeries, shiftHistoryPeriod } from "../lib/history-charts.ts";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { newState, type State } from "../lib/model.ts";

function food(state: State, date: string, calories: number) {
  state.foods.push({ id: `food-${state.foods.length}`, date, name: "Synthetic meal", calories, protein: 0, carbs: 0, fat: 0 });
}

function weight(state: State, date: string, pounds: number) {
  state.weights.push({ id: `weight-${state.weights.length}`, date, weight: pounds });
}

function workout(state: State, date: string, repsByExercise: number[][], finished = true) {
  const id = `workout-${state.workouts.length}`;
  state.workouts.push({
    id, gymId: state.gyms[0].id, gymName: state.gyms[0].name, routine: "Push", date,
    startedAt: `${date}T10:00:00Z`, finishedAt: finished ? `${date}T11:00:00Z` : null,
    exercises: repsByExercise.map((reps, index) => ({
      id: `${id}-exercise-${index}`, name: "Synthetic exercise", machine: "N/A",
      sets: reps.map((count, set) => ({ id: `${id}-exercise-${index}-set-${set}`, weight: 20, reps: count })),
    })),
  });
}

function point(series: ReturnType<typeof buildHistorySeries>, date: string) {
  const found = series.points.find(entry => entry.date === date);
  assert.ok(found, `Missing chart point ${date}`);
  return found;
}

test("month charts include leap day and exclude neighboring months", () => {
  const state = newState();
  food(state, "2024-01-31", 999);
  food(state, "2024-02-01", 100);
  food(state, "2024-02-29", 300);
  food(state, "2024-03-01", 999);
  const series = buildHistorySeries(state, "calories", "month", "2024-02-29", "2026-11-12");
  assert.equal(series.grain, "day");
  assert.equal(series.start, "2024-02-01");
  assert.equal(series.end, "2024-02-29");
  assert.equal(series.points.length, 29);
  assert.equal(point(series, "2024-02-29").value, 300);
  assert.equal(series.summaryValue, 200);
  assert.equal(series.loggedDays, 2);
  for (const [year, days] of [[1900, 28], [2000, 29], [2023, 28]]) {
    const february = buildHistorySeries(newState(), "weight", "month", `${year}-02-01`, "2026-11-12");
    assert.equal(february.points.length, days);
    assert.equal(february.end, `${year}-02-${days}`);
  }
});

test("calorie averages use daily totals, count actual zero, and leave missing days null", () => {
  const state = newState();
  food(state, "2026-01-01", 100);
  food(state, "2026-01-01", 200);
  food(state, "2026-01-03", 900);
  food(state, "2026-01-04", 0);
  food(state, "2026-02-01", 1000);
  const month = buildHistorySeries(state, "calories", "month", "2026-01-01", "2026-11-12");
  assert.equal(point(month, "2026-01-01").value, 300);
  assert.equal(point(month, "2026-01-01").count, 1);
  assert.equal(point(month, "2026-01-02").value, null);
  assert.equal(point(month, "2026-01-02").count, 0);
  assert.equal(point(month, "2026-01-04").value, 0);
  assert.equal(point(month, "2026-01-04").count, 1);
  assert.equal(month.summaryValue, 400);
  assert.equal(month.loggedDays, 3);
  const year = buildHistorySeries(state, "calories", "year", "2026-06-01", "2026-11-12");
  assert.equal(point(year, "2026-01-01").value, 400);
  assert.equal(point(year, "2026-01-01").count, 3);
  assert.equal(point(year, "2026-02-01").value, 1000);
  assert.equal(point(year, "2026-03-01").value, null);
  // Four logged days average to 550; neither entry nor monthly averages do.
  assert.equal(year.summaryValue, 550);
  assert.equal(year.loggedDays, 4);
});

test("weight summaries use chronological endpoints while year points average weigh-ins", () => {
  const state = newState();
  weight(state, "2026-02-02", 170);
  weight(state, "2026-01-31", 180);
  weight(state, "2026-01-01", 200);
  weight(state, "2026-02-20", 160);
  const month = buildHistorySeries(state, "weight", "month", "2026-01-15", "2026-11-12");
  assert.equal(month.summaryValue, 180);
  assert.equal(month.change, -20);
  assert.equal(month.loggedDays, 2);
  assert.equal(point(month, "2026-01-15").value, null);
  const year = buildHistorySeries(state, "weight", "year", "2026-01-01", "2026-11-12");
  assert.equal(point(year, "2026-01-01").value, 190);
  assert.equal(point(year, "2026-02-01").value, 165);
  assert.equal(year.summaryValue, 160);
  assert.equal(year.change, -40);
  assert.equal(year.loggedDays, 4);
  assert.equal(year.unit, "lb");
});

test("reps sum every exercise and session, including drafts with logged sets", () => {
  const state = newState();
  workout(state, "2026-10-02", [[8, 9], [10]]);
  workout(state, "2026-10-02", [[5, 6]], false);
  workout(state, "2026-10-05", [[]], false);
  workout(state, "2026-10-06", [[12]]);
  workout(state, "2026-11-01", [[20]]);
  const month = buildHistorySeries(state, "reps", "month", "2026-10-01", "2026-11-12");
  assert.equal(point(month, "2026-10-02").value, 38);
  assert.equal(point(month, "2026-10-02").count, 1);
  assert.equal(point(month, "2026-10-05").value, null);
  assert.equal(month.summaryValue, 50);
  assert.equal(month.loggedDays, 2);
  const year = buildHistorySeries(state, "reps", "year", "2026-01-01", "2026-11-12");
  assert.equal(point(year, "2026-10-01").value, 50);
  assert.equal(point(year, "2026-10-01").count, 2);
  assert.equal(year.summaryValue, 70);
  assert.equal(year.loggedDays, 3);
  assert.equal(year.change, null);
});

test("current periods stop today and future anchors and entries cannot extend charts", () => {
  const state = newState();
  food(state, "2026-11-12", 120);
  food(state, "2026-11-13", 999);
  food(state, "2027-01-01", 999);
  for (const range of ["month", "year", "all"] as const) {
    const series = buildHistorySeries(state, "calories", range, "2030-12-31", "2026-11-12");
    assert.equal(series.end, "2026-11-12");
    assert.equal(series.summaryValue, 120);
    assert.equal(series.loggedDays, 1);
    assert.equal(series.canNext, false);
    assert.ok(series.points.every(entry => entry.date <= "2026-11-12"));
    assert.equal(series.points.length, range === "month" ? 12 : range === "year" ? 11 : 1);
  }
});

test("all-time charts include old history, retain gaps, and use metric-specific start dates", () => {
  const state = newState();
  food(state, "2024-12-31", 100);
  food(state, "2025-02-01", 300);
  food(state, "2025-02-02", 500);
  weight(state, "2020-01-01", 200);
  workout(state, "2019-01-01", [[5]]);
  const series = buildHistorySeries(state, "calories", "all", "2026-11-12", "2026-11-12");
  assert.equal(series.start, "2024-12-01");
  assert.equal(series.end, "2026-11-12");
  assert.equal(series.points.length, 24);
  assert.equal(series.grain, "month");
  assert.equal(point(series, "2024-12-01").value, 100);
  assert.equal(point(series, "2025-01-01").value, null);
  assert.equal(point(series, "2025-02-01").value, 400);
  assert.equal(point(series, "2026-11-01").value, null);
  assert.equal(series.summaryValue, 300);
  assert.equal(series.loggedDays, 3);
  assert.equal(series.canPrevious, false);
  assert.equal(series.canNext, false);
});

test("all-time charts switch after 120 months without losing early or late records", () => {
  const state = newState();
  workout(state, "2016-12-31", [[10]]);
  workout(state, "2026-11-12", [[20]]);
  const monthly = buildHistorySeries(state, "reps", "all", "2026-11-12", "2026-11-12");
  assert.equal(monthly.grain, "month");
  assert.equal(monthly.points.length, 120);
  assert.equal(monthly.summaryValue, 30);
  workout(state, "2016-11-30", [[5]]);
  const yearly = buildHistorySeries(state, "reps", "all", "2026-11-12", "2026-11-12");
  assert.equal(yearly.grain, "year");
  assert.equal(yearly.start, "2016-01-01");
  assert.equal(yearly.points.length, 11);
  assert.equal(point(yearly, "2016-01-01").value, 15);
  assert.equal(point(yearly, "2017-01-01").value, null);
  assert.equal(point(yearly, "2026-01-01").value, 20);
  assert.equal(yearly.summaryValue, 35);
});

test("yearly all-time averages weight days rather than monthly buckets", () => {
  const state = newState();
  for (const [date, calories, pounds] of [["2010-01-01", 100, 180], ["2010-01-02", 300, 200], ["2010-02-01", 800, 160]] as const) {
    food(state, date, calories);
    weight(state, date, pounds);
  }
  const calories = buildHistorySeries(state, "calories", "all", "2026-11-12", "2026-11-12");
  assert.equal(point(calories, "2010-01-01").value, 400);
  assert.equal(calories.summaryValue, 400);
  const weights = buildHistorySeries(state, "weight", "all", "2026-11-12", "2026-11-12");
  assert.equal(point(weights, "2010-01-01").value, 180);
  assert.equal(weights.summaryValue, 160);
  assert.equal(weights.change, -20);
});

test("empty history stays unknown and a lone weight has no measured change", () => {
  const state = newState();
  for (const metric of ["weight", "calories", "reps"] as const) {
    for (const range of ["month", "year", "all"] as const) {
      const series = buildHistorySeries(state, metric, range, "2026-11-12", "2026-11-12");
      assert.equal(series.summaryValue, null);
      assert.equal(series.change, null);
      assert.equal(series.loggedDays, 0);
      assert.equal(series.canPrevious, false);
      assert.equal(series.canNext, false);
      assert.ok(series.points.every(entry => entry.value === null && entry.count === 0));
    }
  }
  weight(state, "2026-11-10", 170.5);
  const single = buildHistorySeries(state, "weight", "month", "2026-11-12", "2026-11-12");
  assert.equal(single.summaryValue, 170.5);
  assert.equal(single.change, null);
});

test("period navigation handles short months, leap years, bounds, and available history", () => {
  assert.equal(shiftHistoryPeriod("2024-01-31", "month", 1), "2024-02-01");
  assert.equal(shiftHistoryPeriod("2024-03-31", "month", -1), "2024-02-01");
  assert.equal(shiftHistoryPeriod("2024-02-29", "year", -1), "2023-01-01");
  assert.equal(shiftHistoryPeriod("2024-12-31", "month", 1), "2025-01-01");
  assert.equal(shiftHistoryPeriod("2024-01-31", "month", -13), "2022-12-01");
  assert.equal(shiftHistoryPeriod("0001-01-01", "month", -1), "0001-01-01");
  assert.equal(shiftHistoryPeriod("9999-12-31", "month", 1), "9999-12-01");
  assert.equal(shiftHistoryPeriod("0001-01-01", "year", -1), "0001-01-01");
  assert.equal(shiftHistoryPeriod("9999-12-31", "year", 1), "9999-01-01");
  const state = newState();
  weight(state, "2024-12-15", 180);
  const first = buildHistorySeries(state, "weight", "month", "2024-12-31", "2026-11-12");
  assert.equal(first.canPrevious, false);
  assert.equal(first.canNext, true);
  const middle = buildHistorySeries(state, "weight", "year", "2025-06-01", "2026-11-12");
  assert.equal(middle.canPrevious, true);
  assert.equal(middle.canNext, true);
  assert.equal(middle.points.length, 12);
  const current = buildHistorySeries(state, "weight", "month", "2026-11-12", "2026-11-12");
  assert.equal(current.canPrevious, true);
  assert.equal(current.canNext, false);
});

test("invalid calendar anchors and noninteger navigation are rejected", () => {
  for (const invalid of ["2023-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-1-01", "not-a-date"]) {
    assert.throws(() => buildHistorySeries(newState(), "weight", "month", invalid, "2026-11-12"), /valid calendar date/);
    assert.throws(() => buildHistorySeries(newState(), "weight", "month", "2026-11-12", invalid), /valid calendar date/);
    assert.throws(() => shiftHistoryPeriod(invalid, "month", 1), /valid calendar date/);
  }
  for (const delta of [0.5, NaN, Infinity]) assert.throws(() => shiftHistoryPeriod("2026-11-12", "month", delta), /whole calendar period/);
});

test("chart projection never sorts or changes stored journal arrays or nested records", () => {
  const state = newState();
  weight(state, "2026-11-10", 170);
  weight(state, "2020-01-01", 190);
  food(state, "2026-11-10", 300);
  food(state, "2020-01-01", 100);
  workout(state, "2026-11-10", [[12, 8]], false);
  workout(state, "2020-01-01", [[10]]);
  const original = structuredClone(state);
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") {
      Object.freeze(value);
      Object.values(value).forEach(freeze);
    }
  };
  freeze(state);
  for (const metric of ["weight", "calories", "reps"] as const) {
    for (const range of ["month", "year", "all"] as const) buildHistorySeries(state, metric, range, "2026-11-12", "2026-11-12");
  }
  assert.deepEqual(state, original);
});

test("calendar points and labels are identical across DST and far-offset time zones", () => {
  const historyUrl = new URL("../lib/history-charts.ts", import.meta.url).href;
  const modelUrl = new URL("../lib/model.ts", import.meta.url).href;
  const source = `import { buildHistorySeries, shiftHistoryPeriod } from ${JSON.stringify(historyUrl)};
    import { newState } from ${JSON.stringify(modelUrl)};
    console.log(JSON.stringify([
      buildHistorySeries(newState(), 'weight', 'month', '2024-03-31', '2026-11-12'),
      buildHistorySeries(newState(), 'calories', 'year', '2024-12-31', '2026-11-12'),
      shiftHistoryPeriod('2024-03-31', 'month', -1)
    ]));`;
  const outputs = ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"].map(TZ => execFileSync(process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", source], { env: { ...process.env, TZ }, encoding: "utf8" }).trim());
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
  const [march, year, previous] = JSON.parse(outputs[0]);
  assert.equal(march.points.length, 31);
  assert.equal(march.points[0].date, "2024-03-01");
  assert.equal(march.points[30].date, "2024-03-31");
  assert.equal(year.points.length, 12);
  assert.equal(previous, "2024-02-01");
});
