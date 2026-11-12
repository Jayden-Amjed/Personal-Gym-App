import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { newState, newWorkout, validateState } from "../lib/model.ts";

// Deliberately refuses hosted URLs and nonempty journals. Run only against the
// portable dev server, with no concurrent browser edits, after local migrations.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
assert.equal(origin.protocol, "http:", "This test only permits local HTTP preview.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "Refusing to write outside a loopback preview.");
assert.equal(origin.pathname, "/");
assert.equal(origin.username + origin.password + origin.search + origin.hash, "");

const checks = [];
const expect = (value, expected, label) => { assert.deepEqual(value, expected, label); checks.push(label); };
const call = (path, options = {}) => fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(15000), ...options });
const anonymous = await call("/api/data");
expect(anonymous.status, 401, "Unauthenticated journal read rejected");
expect((await call("/api/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401, "Unauthenticated journal write rejected");
expect((await call("/api/data", { headers: { "oai-authenticated-user-id": "spoofed", "oai-authenticated-user-email": "spoofed@sites.test" } })).status, 401, "Local dev middleware strips spoofed identity headers");

const signIn = await call("/signin-with-chatgpt?return_to=/");
expect(signIn.status, 302, "Portable mock sign-in returned a redirect");
const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
expect(cookie, "__sites_local_auth=1", "Only the documented local mock identity is used");
const headers = { Cookie: cookie, "Content-Type": "application/json", Origin: origin.origin };
const read = async () => {
  const response = await call("/api/data", { headers: { Cookie: cookie } });
  assert.equal(response.status, 200, "Authenticated read must succeed; check local D1 migration.");
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
};
const put = (state, revision, extraHeaders = {}) => call("/api/data", { method: "PUT", headers: { ...headers, ...extraHeaders }, body: JSON.stringify({ state, revision }) });
const initial = await read();
assert.deepEqual(initial.state, newState(), "Refusing fixture writes: this local mock journal is not empty. Preserve/export it and use a separate preview database.");

const fixture = newState();
const now = new Date();
const workout = newWorkout(fixture.gyms[0], "Upper", now);
workout.exercises[0].machine = "LOCAL TEST MACHINE — not a real workout";
workout.exercises[0].sets = [{ id: "smoke-set", weight: 42.5, reps: 12 }];
workout.finishedAt = workout.startedAt;
fixture.workouts.push(workout);
fixture.foods.push({ id: "smoke-food", date: workout.date, name: "LOCAL TEST FOOD", calories: 450, protein: 30, carbs: 60, fat: 10 });
fixture.weights.push({ id: "smoke-weight", date: workout.date, weight: 170.5 });
validateState(fixture);
const knownStates = [initial.state, fixture];
let changed = false;
let lastRevision = initial.revision;
let cleanup = "not needed";
try {
  const saved = await put(fixture, initial.revision);
  expect(saved.status, 200, "Authenticated fixture save succeeded");
  changed = true;
  lastRevision = (await saved.json()).revision;
  expect(lastRevision, initial.revision + 1, "Save advances revision exactly once");
  const reloaded = await read();
  expect(reloaded.state, fixture, "Workout, machine, sets, food, and bodyweight survive a fresh read");
  expect(reloaded.revision, lastRevision, "Reload returns committed revision");

  expect((await put(fixture, initial.revision)).status, 409, "Stale revision rejected without overwrite");
  const invalid = structuredClone(fixture);
  invalid.workouts[0].exercises[0].sets[0].reps = -1;
  expect((await put(invalid, lastRevision)).status, 400, "Invalid repetition count rejected");
  expect((await put(fixture, lastRevision, { Origin: "https://foreign.example" })).status, 403, "Cross-origin write rejected");
  expect((await put(fixture, lastRevision, { "Content-Type": "text/plain" })).status, 415, "Non-JSON write rejected");
  expect((await call("/api/data", { method: "PUT", headers, body: " ".repeat(1_500_001) })).status, 413, "Oversized write rejected");
  expect((await read()).state, fixture, "Rejected writes preserve all committed records");

  const candidateA = structuredClone(fixture), candidateB = structuredClone(fixture);
  candidateA.foods[0].calories = 451;
  candidateB.foods[0].calories = 452;
  knownStates.push(candidateA, candidateB);
  const race = await Promise.all([put(candidateA, lastRevision), put(candidateB, lastRevision)]);
  expect(race.map(response => response.status).sort(), [200, 409], "Concurrent equal-revision writes permit exactly one winner");
  const winner = race[0].status === 200 ? candidateA : candidateB;
  const afterRace = await read();
  lastRevision = afterRace.revision;
  expect(afterRace.state, winner, "The winning state is retained without partial mixing");
  validateState(JSON.parse(JSON.stringify(afterRace.state)));
  await mkdir(".sites-runtime", { recursive: true });
  await writeFile(".sites-runtime/api-smoke-export.json", JSON.stringify(afterRace.state, null, 2));
  checks.push("Synthetic data round-trips to a valid JSON export");
} finally {
  if (changed) {
    const latest = await read();
    const isKnown = knownStates.some(state => JSON.stringify(state) === JSON.stringify(latest.state));
    assert.ok(isKnown, "Concurrent local edits detected: refusing cleanup so unfamiliar data stays intact.");
    const restored = await put(initial.state, latest.revision);
    assert.equal(restored.status, 200, "Could not restore empty local fixture state; retain preview for inspection.");
    lastRevision = (await restored.json()).revision;
    expect((await read()).state, initial.state, "Cleanup restores the original empty journal");
    cleanup = "restored initial empty journal; revision history retained";
  }
  await mkdir(".sites-runtime", { recursive: true });
  const report = { target: origin.origin, checkedAt: new Date().toISOString(), checks, cleanup, lastRevision, identityLimit: "Portable mock auth has one identity; header spoof rejection tested, separate-user isolation not exercised here." };
  await writeFile(".sites-runtime/api-smoke-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
