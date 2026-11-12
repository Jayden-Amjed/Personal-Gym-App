import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Node's native TypeScript runner resolves explicit .ts imports.
import { ROUTINES, getMissedExercises, getWeekStats, localDate, newState, newWorkout, validateState } from "../lib/model.ts";

test("a new journal has the requested gyms and no invented history", () => {
  const state = newState();
  assert.deepEqual(state.gyms.map(gym => gym.name), ["El Cajon", "Miramar"]);
  assert.deepEqual([state.workouts.length, state.foods.length, state.weights.length], [0, 0, 0]);
  assert.deepEqual(validateState(state), state);
});

test("all five routines include abs; drafts do not count as missed", () => {
  assert.equal(Object.keys(ROUTINES).length, 5);
  for (const routine of Object.keys(ROUTINES) as (keyof typeof ROUTINES)[]) {
    const workout = newWorkout(newState().gyms[0], routine);
    assert.ok(workout.exercises.some(exercise => exercise.name === "Ab crunch machine"));
    assert.ok(workout.exercises.some(exercise => exercise.name === "Ab leg raises"));
    assert.ok(workout.exercises.every(exercise => exercise.machine === "N/A"));
    assert.deepEqual(getMissedExercises(workout), []);
    workout.exercises[0].sets.push({ id: "set-1", weight: 0, reps: 12 });
    workout.finishedAt = new Date().toISOString();
    assert.equal(getMissedExercises(workout).length, workout.exercises.length - 1);
  }
});

test("Upper follows the user's chosen order and Lower matches Legs", () => {
  assert.deepEqual(ROUTINES.Upper, [
    "T-bar rows", "Close-lat-pulls machine", "Incline dumbbell press", "Chest flies",
    "Shoulder press", "Preacher curls", "Tricep pushdown", "Ab crunch machine", "Ab leg raises",
  ]);
  assert.deepEqual(ROUTINES.Lower, [
    "Machine leg press", "Barbell RDLs", "Machine leg curls", "Machine leg extensions",
    "Standing calf machine", "Ab crunch machine", "Ab leg raises",
  ]);
  assert.deepEqual(ROUTINES.Lower, ROUTINES.Legs);
});

test("weekly totals use Monday through Sunday and include saved draft sets", () => {
  const state = newState();
  for (const [day, finished] of [[8, true], [9, true], [12, false], [15, true], [16, true]] as const) {
    const workout = newWorkout(state.gyms[0], "Pull", new Date(2026, 10, day, 12));
    workout.exercises[0].sets = [{ id: `s-${day}`, weight: 50, reps: 10 }];
    if (finished) workout.finishedAt = workout.startedAt;
    state.workouts.push(workout);
  }
  assert.deepEqual(getWeekStats(state, new Date(2026, 10, 12, 23)), { workouts: 2, sets: 3, reps: 30, volume: 1500 });
  assert.equal(localDate(new Date(2026, 0, 2, 0, 1)), "2026-01-02");
});

test("validation rejects malformed dates, negative inputs, duplicate IDs and missing gyms", () => {
  const state = newState();
  const workout = newWorkout(state.gyms[0], "Legs");
  state.workouts.push(workout);
  workout.exercises[0].sets.push({ id: "set-1", weight: 0, reps: 12 });
  assert.doesNotThrow(() => validateState(state));
  workout.date = "2026-02-30";
  assert.throws(() => validateState(state));
  workout.date = "2026-11-12";
  workout.exercises[0].sets[0].weight = -5;
  assert.throws(() => validateState(state));
  workout.exercises[0].sets[0].weight = 5;
  workout.exercises[0].sets[0].reps = 1.5;
  assert.throws(() => validateState(state));
  workout.exercises[0].sets[0].reps = 10;
  state.gyms.push({ ...state.gyms[0] });
  assert.throws(() => validateState(state));
  state.gyms.pop();
  workout.gymId = "unknown";
  assert.throws(() => validateState(state));
});

test("workout snapshots retain gym and machine identity independently of later routines", () => {
  const state = newState();
  const workout = newWorkout(state.gyms[0], "Push");
  workout.exercises[0].machine = "Bench 4";
  state.gyms[0].name = "Renamed gym";
  assert.equal(workout.gymName, "El Cajon");
  assert.equal(workout.exercises[0].machine, "Bench 4");
  assert.equal(workout.exercises.length, ROUTINES.Push.length);
});
