import { z } from "zod";

export const ROUTINES = {
  Push: ["Incline dumbbell press", "Neutral machine press", "Chest flies", "Machine shoulder press", "Cable lateral raises", "Cable tricep pushdown", "Cable tricep overhead", "Ab crunch machine", "Ab leg raises"],
  Pull: ["T-bar rows", "Cable lat pulldowns", "Close-lat-pulls machine", "Preacher curls", "Cable hammer curls", "Ab crunch machine", "Ab leg raises"],
  Legs: ["Machine leg press", "Barbell RDLs", "Machine leg curls", "Machine leg extensions", "Standing calf machine", "Ab crunch machine", "Ab leg raises"],
  Upper: ["T-bar rows", "Close-lat-pulls machine", "Incline dumbbell press", "Chest flies", "Shoulder press", "Preacher curls", "Tricep pushdown", "Ab crunch machine", "Ab leg raises"],
  Lower: ["Machine leg press", "Barbell RDLs", "Machine leg curls", "Machine leg extensions", "Standing calf machine", "Ab crunch machine", "Ab leg raises"],
} as const;

export type Routine = keyof typeof ROUTINES;
export type Gym = { id: string; name: string };
export type SetLog = { id: string; weight: number; reps: number };
export type ExerciseLog = { id: string; name: string; machine: string; sets: SetLog[] };
export type Workout = {
  id: string; gymId: string; gymName: string; routine: Routine; date: string;
  startedAt: string; finishedAt: string | null; exercises: ExerciseLog[];
};
export type FoodEntry = { id: string; date: string; name: string; calories: number; protein: number; carbs: number; fat: number };
export type WeightEntry = { id: string; date: string; weight: number };
export type State = { schemaVersion: 1; gyms: Gym[]; workouts: Workout[]; foods: FoodEntry[]; weights: WeightEntry[] };

const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(160);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");
const timestamp = z.string().datetime({ offset: true });
const finiteNumber = z.number().finite();
const SetSchema = z.object({ id, weight: finiteNumber.min(0).max(3000), reps: finiteNumber.int().min(1).max(10000) }).strict();
const ExerciseSchema = z.object({ id, name, machine: z.string().trim().min(1).max(160), sets: z.array(SetSchema).max(100) }).strict();
const WorkoutSchema = z.object({
  id, gymId: id, gymName: name, routine: z.enum(["Push", "Pull", "Legs", "Upper", "Lower"]), date: calendarDate,
  startedAt: timestamp, finishedAt: timestamp.nullable(), exercises: z.array(ExerciseSchema).min(1).max(100),
}).strict().refine(workout => !workout.finishedAt || new Date(workout.finishedAt) >= new Date(workout.startedAt), "Finish time must follow the start time.");
const FoodSchema = z.object({
  id, date: calendarDate, name, calories: finiteNumber.min(0).max(100000),
  protein: finiteNumber.min(0).max(10000), carbs: finiteNumber.min(0).max(10000), fat: finiteNumber.min(0).max(10000),
}).strict();

export const StateSchema = z.object({
  schemaVersion: z.literal(1),
  gyms: z.array(z.object({ id, name }).strict()).min(1).max(100),
  workouts: z.array(WorkoutSchema).max(10000),
  foods: z.array(FoodSchema).max(50000),
  weights: z.array(z.object({ id, date: calendarDate, weight: finiteNumber.min(1).max(2000) }).strict()).max(20000),
}).strict().superRefine((state, ctx) => {
  const checkIds = (entries: { id: string }[], path: (string | number)[]) => {
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Record IDs must be unique.", path });
  };
  checkIds(state.gyms, ["gyms"]);
  checkIds(state.workouts, ["workouts"]);
  checkIds(state.foods, ["foods"]);
  checkIds(state.weights, ["weights"]);
  const gymIds = new Set(state.gyms.map(gym => gym.id));
  state.workouts.forEach((workout, wi) => {
    if (!gymIds.has(workout.gymId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Workout gym is missing.", path: ["workouts", wi, "gymId"] });
    checkIds(workout.exercises, ["workouts", wi, "exercises"]);
    workout.exercises.forEach((exercise, ei) => checkIds(exercise.sets, ["workouts", wi, "exercises", ei, "sets"]));
  });
});

export function validateState(value: unknown): State {
  return StateSchema.parse(value);
}

export function newState(): State {
  return { schemaVersion: 1, gyms: [{ id: "el-cajon", name: "El Cajon" }, { id: "miramar", name: "Miramar" }], workouts: [], foods: [], weights: [] };
}

/** Uses the phone/browser's local calendar day, never the UTC day boundary. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function newWorkout(gym: Gym, routine: Routine, now = new Date()): Workout {
  return {
    id: crypto.randomUUID(), gymId: gym.id, gymName: gym.name, routine, date: localDate(now), startedAt: now.toISOString(), finishedAt: null,
    exercises: ROUTINES[routine].map(name => ({ id: crypto.randomUUID(), name, machine: "N/A", sets: [] })),
  };
}

/** An unfinished workout is a draft, not a list of missed exercises. */
export function getMissedExercises(workout: Workout): ExerciseLog[] {
  return workout.finishedAt ? workout.exercises.filter(exercise => exercise.sets.length === 0) : [];
}

export function getWeekStats(state: State, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const start = localDate(monday), end = localDate(sunday);
  const workouts = state.workouts.filter(workout => workout.date >= start && workout.date <= end);
  const sets = workouts.flatMap(workout => workout.exercises.flatMap(exercise => exercise.sets));
  return {
    workouts: workouts.filter(workout => workout.finishedAt !== null).length,
    sets: sets.length,
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
  };
}
