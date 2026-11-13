import type { State } from "./model";

export type HistoryMetric = "weight" | "calories" | "reps";
export type HistoryRange = "month" | "year" | "all";
export type HistoryPoint = { date: string; label: string; detailLabel: string; value: number | null; count: number };
export type HistorySeries = {
  points: HistoryPoint[];
  periodLabel: string;
  description: string;
  unit: string;
  summaryValue: number | null;
  summaryLabel: string;
  loggedDays: number;
  change: number | null;
  start: string;
  end: string;
  grain: "day" | "month" | "year";
  canPrevious: boolean;
  canNext: boolean;
};

const format = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
const round = (value: number) => Math.round(value * 10) / 10;
const iso = (year: number, month = 1, day = 1) => `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const yearStart = (date: string) => `${date.slice(0, 4)}-01-01`;

function checkedDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("Choose a valid calendar date.");
  return date;
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Calendar navigation uses the first day so Jan 31 cannot overflow February. */
export function shiftHistoryPeriod(anchor: string, range: "month" | "year", delta: number): string {
  checkedDate(anchor);
  if (!Number.isInteger(delta)) throw new Error("Choose a whole calendar period.");
  const year = Number(anchor.slice(0, 4)), month = Number(anchor.slice(5, 7));
  if (range === "year") return iso(Math.max(1, Math.min(9999, year + delta)));
  const index = Math.max(12, Math.min(9999 * 12 + 11, year * 12 + month - 1 + delta));
  return iso(Math.floor(index / 12), index % 12 + 1);
}

/** Read-only chart projection. Saved entries and their original dates are untouched. */
export function buildHistorySeries(state: State, metric: HistoryMetric, range: HistoryRange, anchor: string, today: string): HistorySeries {
  checkedDate(today);
  checkedDate(anchor);
  const selected = anchor > today ? today : anchor;
  const days = new Map<string, number>();
  if (metric === "weight") {
    // The logging UI keeps one weigh-in per date; the last entry wins if an old
    // journal contains duplicate dates, matching an explicit same-day correction.
    for (const entry of state.weights) if (entry.date <= today) days.set(entry.date, entry.weight);
  } else if (metric === "calories") {
    for (const entry of state.foods) if (entry.date <= today) days.set(entry.date, (days.get(entry.date) ?? 0) + entry.calories);
  } else {
    for (const workout of state.workouts) {
      if (workout.date > today) continue;
      const sets = workout.exercises.flatMap(exercise => exercise.sets);
      if (sets.length) days.set(workout.date, (days.get(workout.date) ?? 0) + sets.reduce((sum, set) => sum + set.reps, 0));
    }
  }
  const dates = [...days.keys()].sort();
  const earliest = dates[0];
  let start: string, end: string, grain: HistorySeries["grain"];
  if (range === "month") {
    start = monthStart(selected);
    const year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7));
    end = iso(year, month, daysInMonth(year, month));
    grain = "day";
  } else if (range === "year") {
    start = yearStart(selected);
    end = `${selected.slice(0, 4)}-12-31`;
    grain = "month";
  } else {
    start = monthStart(earliest ?? today);
    end = today;
    const months = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
    grain = months <= 120 ? "month" : "year";
    if (grain === "year") start = yearStart(start);
  }
  if (end > today) end = today;
  const entries = dates.filter(date => date >= start && date <= end).map(date => ({ date, value: days.get(date)! }));
  const grouped = new Map<string, { sum: number; count: number }>();
  for (const entry of entries) {
    const key = grain === "day" ? entry.date : grain === "month" ? monthStart(entry.date) : yearStart(entry.date);
    const group = grouped.get(key) ?? { sum: 0, count: 0 };
    group.sum += entry.value;
    group.count += 1;
    grouped.set(key, group);
  }
  const points: HistoryPoint[] = [];
  const addPoint = (date: string) => {
    const group = grouped.get(date);
    points.push({
      date,
      label: grain === "day" ? String(Number(date.slice(8, 10))) : grain === "month" ? format(date, { month: "short", ...(range === "all" ? { year: "2-digit" } : {}) }) : date.slice(0, 4),
      detailLabel: format(date, grain === "day" ? { month: "short", day: "numeric", year: "numeric" } : grain === "month" ? { month: "long", year: "numeric" } : { year: "numeric" }),
      value: group ? round(metric === "reps" ? group.sum : group.sum / group.count) : null,
      count: group?.count ?? 0,
    });
  };
  if (grain === "day") {
    for (let day = 1; day <= Number(end.slice(8, 10)); day++) addPoint(iso(Number(start.slice(0, 4)), Number(start.slice(5, 7)), day));
  } else {
    // Bounded to <=120 monthly points or <=9999 yearly points, never one point
    // per day across a multi-decade journal. Every recorded date contributes.
    let date = start;
    while (date <= end) {
      addPoint(date);
      const next = shiftHistoryPeriod(date, grain, 1);
      if (next <= date) break;
      date = next;
    }
  }
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const last = entries.at(-1);
  const first = entries[0];
  const unit = metric === "weight" ? "lb" : metric === "calories" ? "kcal" : "reps";
  const interval = grain === "month" ? "Monthly" : "Yearly";
  const description = grain === "day"
    ? metric === "weight" ? "Daily weigh-ins · gaps mean no weigh-in logged" : metric === "calories" ? "Daily calories · logged food only" : "Daily reps · all sessions with logged sets"
    : metric === "weight" ? `${interval} average weight · logged weigh-ins only` : metric === "calories" ? `${interval} average daily calories · logged days only` : `${interval} total reps · all sessions with logged sets`;
  const earliestPeriod = earliest ? range === "year" ? yearStart(earliest) : monthStart(earliest) : null;
  const currentPeriod = range === "year" ? yearStart(today) : monthStart(today);
  return {
    points,
    start,
    end,
    grain,
    periodLabel: range === "month" ? format(start, { month: "long", year: "numeric" }) : range === "year" ? start.slice(0, 4) : earliest ? `${format(earliest, { month: "short", year: "numeric" })} – ${format(today, { month: "short", year: "numeric" })}` : "All time",
    description,
    unit,
    summaryValue: entries.length ? round(metric === "weight" ? last!.value : metric === "calories" ? total / entries.length : total) : null,
    summaryLabel: metric === "weight" ? "Latest in this period" : metric === "calories" ? "Average per logged day" : "Total in this period",
    loggedDays: entries.length,
    change: metric === "weight" && entries.length > 1 ? round(last!.value - first.value) : null,
    canPrevious: range !== "all" && earliestPeriod !== null && start > earliestPeriod,
    canNext: range !== "all" && start < currentPeriod,
  };
}
