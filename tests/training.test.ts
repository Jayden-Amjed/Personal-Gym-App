import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Native Node TypeScript entrypoints use explicit extensions.
import { StateSchema, newState, newWorkout, validateState } from "../lib/model.ts";
// @ts-ignore Native Node TypeScript entrypoints use explicit extensions.
import { exerciseMetadata, findComparableSets, getExerciseOrder, getRestSeconds, getSetContextLabel, getWorkedMuscles, logSet } from "../lib/training.ts";

const date = (day: number, minute = 0) => new Date(Date.UTC(2026, 10, day, 20, minute));
const freshWorkout = (day = 12) => newWorkout(newState().gyms[0], "Pull", date(day));

test("v1 read migration preserves every old record and does not invent order or new exercises", () => {
  const workout = freshWorkout();
  delete workout.nextSetSequence;
  workout.exercises = workout.exercises.filter(exercise => exercise.name !== "Rear-delt fly");
  workout.exercises[0].machine = "Historical row machine";
  workout.exercises[0].sets = [{ id: "old-set", weight: 90, reps: 8 }];
  const oldState = { ...newState(), schemaVersion: 1, workouts: [workout] };
  const original = structuredClone(oldState);
  const migrated = validateState(oldState);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual({ ...migrated, schemaVersion: 1 }, original);
  assert.deepEqual(oldState, original, "Migration does not mutate its input");
  assert.equal(migrated.workouts[0].exercises[0].sets[0].context, undefined);
  assert.equal(getExerciseOrder(migrated.workouts[0])[0].firstSequence, null);
  assert.equal(getSetContextLabel(migrated.workouts[0].exercises[0].sets[0]), "Earlier order unknown");
  assert.throws(() => StateSchema.parse(oldState), "Old clients must refresh before writing v1 over new context");
  assert.deepEqual(StateSchema.parse(migrated), migrated);
  const next = logSet(migrated.workouts[0], workout.exercises[0].id, 90, 8, date(12, 1));
  assert.equal(next.context?.orderKnown, false, "New entries cannot reconstruct earlier unrecorded order");
});

test("logging order follows actual interleaved sets, including assisting muscles", () => {
  const workout = freshWorkout();
  const curls = workout.exercises.find(exercise => exercise.name === "Preacher curls")!;
  const rows = workout.exercises[0];
  const first = logSet(workout, curls.id, 25, 12, date(12, 1));
  const second = logSet(workout, rows.id, 90, 10, date(12, 2));
  const third = logSet(workout, curls.id, 25, 10, date(12, 3));
  assert.deepEqual([first.context?.sequence, second.context?.sequence, third.context?.sequence], [1, 2, 3]);
  assert.equal(first.context?.priorMuscleSets.biceps, 0);
  assert.equal(second.context?.priorMuscleSets.biceps, 1);
  assert.equal(second.context?.priorMuscleSets.lats, 0);
  assert.equal(third.context?.priorMuscleSets.biceps, 2, "The row also counts as prior biceps work");
  assert.equal(third.context?.exerciseSetNumber, 2);
  assert.deepEqual(getExerciseOrder(workout).map(entry => entry.name), ["Preacher curls", "T-bar rows"]);
  assert.equal(getSetContextLabel(first), "First work for these muscles");
  assert.match(getSetContextLabel(second), /Biceps 1 sets/);
});

test("deletions and edits preserve recorded context and never reuse sequence numbers", () => {
  const workout = freshWorkout();
  const exercise = workout.exercises[0];
  logSet(workout, exercise.id, 80, 12, date(12, 1));
  const second = logSet(workout, exercise.id, 80, 10, date(12, 2));
  const snapshot = structuredClone(second.context);
  exercise.sets.splice(0, 1);
  second.weight = 85;
  second.reps = 9;
  assert.deepEqual(second.context, snapshot);
  exercise.sets = [];
  const third = logSet(workout, exercise.id, 80, 12, date(12, 3));
  assert.equal(third.context?.sequence, 3);
  assert.equal(workout.nextSetSequence, 4);
  assert.equal(third.context?.priorMuscleSets.lats, 0, "New snapshots use records retained at entry time");
  const state = newState(); state.workouts.push(workout);
  assert.deepEqual(validateState(state), state);
});

test("machine and muscle snapshots survive later exercise changes", () => {
  const workout = freshWorkout();
  const rows = workout.exercises[0];
  rows.machine = "Row A";
  const first = logSet(workout, rows.id, 80, 10, date(12, 1));
  rows.machine = "Row B";
  const second = logSet(workout, rows.id, 80, 10, date(12, 2));
  assert.equal(first.context?.machine, "Row A");
  assert.equal(second.context?.machine, "Row B");
  rows.name = "Renamed custom exercise";
  assert.ok(getWorkedMuscles(workout).includes("lats"));
  assert.ok(getWorkedMuscles(workout).includes("biceps"));
  assert.equal(getWorkedMuscles(workout).includes("abs"), false, "Planned but unlogged abs do not appear");
});

test("muscle map uses only logged work and metadata returns independent arrays", () => {
  const workout = freshWorkout();
  assert.deepEqual(getWorkedMuscles(workout), []);
  const fly = workout.exercises.find(exercise => exercise.name === "Rear-delt fly")!;
  logSet(workout, fly.id, 40, 12, date(12, 1));
  assert.deepEqual(getWorkedMuscles(workout), ["rearDelts", "upperBack"]);
  const metadata = exerciseMetadata(fly.name);
  metadata.primary.push("chest");
  assert.deepEqual(exerciseMetadata(fly.name).primary, ["rearDelts"]);
  assert.deepEqual(exerciseMetadata("Unknown movement").primary, []);
});

test("comparisons require the same gym, machine, set position and prior muscle work", () => {
  const current = freshWorkout(12);
  const targetExercise = current.exercises.find(exercise => exercise.name === "Preacher curls")!;
  targetExercise.machine = "Curl A";
  const target = logSet(current, targetExercise.id, 30, 10, date(12, 1));
  const prior = (day: number, machine = "Curl A", fatigued = false) => {
    const workout = freshWorkout(day);
    const exercise = workout.exercises.find(entry => entry.name === "Preacher curls")!;
    exercise.machine = machine;
    if (fatigued) logSet(workout, workout.exercises[0].id, 90, 10, date(day, 1));
    logSet(workout, exercise.id, 25, 10, date(day, 2));
    workout.finishedAt = date(day, 3).toISOString();
    return workout;
  };
  const comparable = prior(11), differentMachine = prior(10, "Curl B"), afterBack = prior(9, "Curl A", true), differentGym = prior(8), unknown = prior(7), draft = prior(6);
  differentGym.gymId = "other-gym";
  delete unknown.exercises.find(exercise => exercise.name === "Preacher curls")!.sets[0].context;
  draft.finishedAt = null;
  const result = findComparableSets([comparable, differentMachine, afterBack, differentGym, unknown, draft, current], current, targetExercise, target);
  assert.deepEqual(result.map(entry => entry.workoutId), [comparable.id]);
  assert.deepEqual(findComparableSets([comparable], current, targetExercise, { id: "legacy", weight: 25, reps: 10 }), []);
});

test("rest defaults distinguish compound and isolation work, with validated overrides", () => {
  const workout = freshWorkout();
  const row = workout.exercises[0];
  const fly = workout.exercises.find(exercise => exercise.name === "Rear-delt fly")!;
  assert.equal(getRestSeconds(row), 150);
  assert.equal(getRestSeconds(fly), 90);
  row.restSeconds = 120;
  assert.equal(getRestSeconds(row), 120);
  const state = newState(); state.workouts.push(workout);
  assert.doesNotThrow(() => validateState(state));
  row.restSeconds = 10;
  assert.throws(() => validateState(state));
  row.restSeconds = 601;
  assert.throws(() => validateState(state));
});

test("validation rejects duplicate sequences, lost counters and malformed muscle snapshots", () => {
  const state = newState(), workout = freshWorkout(); state.workouts.push(workout);
  const a = logSet(workout, workout.exercises[0].id, 90, 10, date(12, 1));
  const b = logSet(workout, workout.exercises[1].id, 90, 10, date(12, 2));
  assert.doesNotThrow(() => validateState(state));
  b.context!.sequence = a.context!.sequence;
  assert.throws(() => validateState(state));
  b.context!.sequence = 2;
  workout.nextSetSequence = 2;
  assert.throws(() => validateState(state));
  workout.nextSetSequence = 3;
  a.context!.secondary.push("lats");
  assert.throws(() => validateState(state));
  a.context!.secondary.pop();
  delete a.context!.priorMuscleSets.lats;
  assert.throws(() => validateState(state));
});
