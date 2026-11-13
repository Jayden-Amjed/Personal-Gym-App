import type { ExerciseLog, SetLog, Workout } from "./model";

export const MUSCLES = ["chest", "frontDelts", "sideDelts", "rearDelts", "lats", "upperBack", "lowerBack", "biceps", "triceps", "forearms", "abs", "obliques", "quads", "hamstrings", "glutes", "calves"] as const;
export type Muscle = typeof MUSCLES[number];
export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest", frontDelts: "Front shoulders", sideDelts: "Side shoulders", rearDelts: "Rear delts",
  lats: "Lats", upperBack: "Upper back", lowerBack: "Lower back", biceps: "Biceps", triceps: "Triceps",
  forearms: "Forearms", abs: "Abs", obliques: "Obliques", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
};

export type ExerciseMetadata = { primary: Muscle[]; secondary: Muscle[]; restSeconds: number };
const compound = (primary: Muscle[], secondary: Muscle[]): ExerciseMetadata => ({ primary, secondary, restSeconds: 150 });
const isolation = (primary: Muscle[], secondary: Muscle[] = []): ExerciseMetadata => ({ primary, secondary, restSeconds: 90 });

// Typical prime movers and substantial assistants, not a measurement of muscle
// activation or every stabilizer. Logged sets drive the map, not the day name.
const EXERCISES: Record<string, ExerciseMetadata> = {
  "Incline dumbbell press": compound(["chest"], ["frontDelts", "triceps"]),
  "Neutral machine press": compound(["chest"], ["frontDelts", "triceps"]),
  "Chest flies": isolation(["chest"], ["frontDelts"]),
  "Machine shoulder press": compound(["frontDelts", "sideDelts"], ["triceps"]),
  "Shoulder press": compound(["frontDelts", "sideDelts"], ["triceps"]),
  "Cable lateral raises": isolation(["sideDelts"]),
  "Cable tricep pushdown": isolation(["triceps"]),
  "Tricep pushdown": isolation(["triceps"]),
  "Cable tricep overhead": isolation(["triceps"]),
  "T-bar rows": compound(["upperBack", "lats"], ["biceps", "rearDelts", "forearms"]),
  "Cable lat pulldowns": compound(["lats"], ["upperBack", "biceps", "forearms"]),
  "Close-lat-pulls machine": compound(["lats"], ["upperBack", "biceps", "forearms"]),
  "Rear-delt fly": isolation(["rearDelts"], ["upperBack"]),
  "Preacher curls": isolation(["biceps"], ["forearms"]),
  "Cable hammer curls": isolation(["biceps", "forearms"]),
  "Machine leg press": compound(["quads", "glutes"], []),
  "Barbell RDLs": compound(["hamstrings", "glutes"], ["lowerBack", "forearms"]),
  "Machine leg curls": isolation(["hamstrings"]),
  "Machine leg extensions": isolation(["quads"]),
  "Standing calf machine": isolation(["calves"]),
  "Ab crunch machine": isolation(["abs"]),
  "Ab leg raises": isolation(["abs"]),
};

export function exerciseMetadata(name: string): ExerciseMetadata {
  const value = EXERCISES[name];
  return value ? { ...value, primary: [...value.primary], secondary: [...value.secondary] } : { primary: [], secondary: [], restSeconds: 90 };
}

export function getRestSeconds(exercise: Pick<ExerciseLog, "name" | "restSeconds">): number {
  return exercise.restSeconds ?? exerciseMetadata(exercise.name).restSeconds;
}

export type SetContext = {
  sequence: number;
  loggedAt: string;
  machine: string;
  primary: Muscle[];
  secondary: Muscle[];
  priorMuscleSets: Partial<Record<Muscle, number>>;
  exerciseSetNumber: number;
  orderKnown: boolean;
};

const musclesOf = (exercise: ExerciseLog, set: SetLog): Muscle[] => {
  const context = set.context ?? exerciseMetadata(exercise.name);
  return [...new Set([...context.primary, ...context.secondary])];
};

export function getWorkedMuscles(workout: Workout): Muscle[] {
  const worked = new Set(workout.exercises.flatMap(exercise => exercise.sets.flatMap(set => musclesOf(exercise, set))));
  return MUSCLES.filter(muscle => worked.has(muscle));
}

/** A snapshot at entry time. Editing/removing a set never rewrites later context. */
export function logSet(workout: Workout, exerciseId: string, weight: number, reps: number, now = new Date()): SetLog {
  const exercise = workout.exercises.find(entry => entry.id === exerciseId);
  if (!exercise) throw new Error("Exercise is missing from this workout.");
  if (workout.finishedAt) throw new Error("Reopen the workout before adding a set.");
  if (!Number.isFinite(weight) || weight < 0 || weight > 3000 || !Number.isInteger(reps) || reps < 1 || reps > 10000) throw new Error("Enter a valid weight and whole repetition count.");
  if (exercise.sets.length >= 100) throw new Error("This exercise already has 100 sets.");
  const earlier = workout.exercises.flatMap(entry => entry.sets.map(set => ({ exercise: entry, set })));
  const sequence = Math.max(workout.nextSetSequence ?? 1, ...earlier.map(({ set }) => (set.context?.sequence ?? 0) + 1));
  if (sequence >= 1_000_000_000) throw new Error("This workout has reached the set sequence limit.");
  const metadata = exerciseMetadata(exercise.name);
  const muscles = [...metadata.primary, ...metadata.secondary];
  const priorMuscleSets: Partial<Record<Muscle, number>> = {};
  for (const muscle of muscles) priorMuscleSets[muscle] = earlier.filter(entry => musclesOf(entry.exercise, entry.set).includes(muscle)).length;
  const set: SetLog = {
    id: crypto.randomUUID(), weight, reps,
    context: {
      sequence, loggedAt: now.toISOString(), machine: exercise.machine,
      primary: metadata.primary, secondary: metadata.secondary, priorMuscleSets,
      exerciseSetNumber: exercise.sets.length + 1,
      orderKnown: earlier.every(({ set }) => set.context?.orderKnown === true),
    },
  };
  workout.nextSetSequence = sequence + 1;
  exercise.sets.push(set);
  return set;
}

export function getSetContextLabel(set: SetLog): string {
  const context = set.context;
  if (!context?.orderKnown) return "Earlier order unknown";
  const muscles = [...context.primary, ...context.secondary];
  if (!muscles.length) return "Muscle mapping unavailable";
  const used = muscles.filter(muscle => (context.priorMuscleSets[muscle] ?? 0) > 0);
  return used.length ? `Prior work: ${used.map(muscle => `${MUSCLE_LABELS[muscle]} ${context.priorMuscleSets[muscle]} sets`).join(" · ")}` : "First work for these muscles";
}

export function getExerciseOrder(workout: Workout) {
  return workout.exercises.filter(exercise => exercise.sets.length).map(exercise => {
    const tracked = exercise.sets.filter(set => set.context).sort((a, b) => a.context!.sequence - b.context!.sequence);
    const first = exercise.sets.every(set => set.context?.orderKnown) ? tracked[0]?.context : undefined;
    return { exerciseId: exercise.id, name: exercise.name, machine: first?.machine ?? exercise.machine, firstSequence: first?.sequence ?? null, primary: first?.primary ?? exerciseMetadata(exercise.name).primary, secondary: first?.secondary ?? exerciseMetadata(exercise.name).secondary };
  }).sort((a, b) => (a.firstSequence ?? Infinity) - (b.firstSequence ?? Infinity));
}

export type ComparableSet = { workoutId: string; date: string; set: SetLog };

/** Comparable workload is context, not a claim of equal fatigue or true strength. */
export function findComparableSets(workouts: Workout[], currentWorkout: Workout, exercise: ExerciseLog, targetSet: SetLog): ComparableSet[] {
  const target = targetSet.context;
  if (!target?.orderKnown || !target.primary.length) return [];
  const primary = [...target.primary].sort().join(","), secondary = [...target.secondary].sort().join(",");
  const muscles = [...target.primary, ...target.secondary];
  return workouts.filter(workout => workout.id !== currentWorkout.id && workout.gymId === currentWorkout.gymId && workout.finishedAt && workout.date <= currentWorkout.date)
    .flatMap(workout => workout.exercises.filter(entry => entry.name === exercise.name).flatMap(entry => entry.sets.filter(set => {
      const context = set.context;
      return context?.orderKnown && context.loggedAt <= target.loggedAt && context.machine === target.machine && context.exerciseSetNumber === target.exerciseSetNumber
        && [...context.primary].sort().join(",") === primary && [...context.secondary].sort().join(",") === secondary
        && muscles.every(muscle => context.priorMuscleSets[muscle] === target.priorMuscleSets[muscle]);
    }).map(set => ({ workoutId: workout.id, date: workout.date, set }))))
    .sort((a, b) => b.date.localeCompare(a.date) || b.set.context!.loggedAt.localeCompare(a.set.context!.loggedAt));
}
