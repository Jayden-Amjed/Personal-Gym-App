import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { newState, newWorkout } from "../lib/model.ts";
import { getWorkedMuscles, logSet } from "../lib/training.ts";

// Isolated portable preview only. Never writes to a hosted URL, an existing
// journal, or a personal photo. Run without concurrent browser/test editing.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
assert.equal(origin.protocol, "http:", "Only a local HTTP preview is permitted.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "Refusing non-loopback photo tests.");
assert.equal(origin.pathname, "/");
assert.equal(origin.username + origin.password + origin.search + origin.hash, "");

// Two generated 8×8 solid-color JPEG fixtures. No downloaded or personal image.
const originalBytes = Buffer.from("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCFAKgP/9k=", "base64");
const compositeBytes = Buffer.from("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAeWF/9k=", "base64");
let photoContext = "";
const form = (original = new Blob([originalBytes], { type: "image/jpeg" }), composite = new Blob([compositeBytes], { type: "image/jpeg" })) => {
  const value = new FormData();
  if (original) value.append("original", original, "synthetic-original.jpg");
  if (composite) value.append("composite", composite, "synthetic-composite.jpg");
  value.append("context", photoContext);
  return value;
};
const checks = [];
const expect = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks.push(label); };
const rejection = (response, label) => { assert.ok([400, 413, 415].includes(response.status), `${label}: HTTP ${response.status}`); checks.push(label); };
const call = (path, options = {}) => fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(30_000), ...options });
const probe = "/api/photos?workoutId=synthetic-auth-probe";
expect((await call(probe)).status, 401, "Anonymous photo metadata read rejected");
expect((await call(probe, { method: "POST", body: form() })).status, 401, "Anonymous photo upload rejected");
expect((await call(probe, { method: "DELETE" })).status, 401, "Anonymous photo deletion rejected");
expect((await call("/api/photos/synthetic-auth-probe")).status, 401, "Anonymous image-byte request rejected");
expect((await call(probe, { headers: { "oai-authenticated-user-id": "spoofed", "oai-authenticated-user-email": "spoofed@sites.test" } })).status, 401, "Preview strips spoofed photo identity headers");

const signIn = await call("/signin-with-chatgpt?return_to=/");
expect(signIn.status, 302, "Portable development sign-in redirects");
const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
expect(cookie, "__sites_local_auth=1", "Only the documented development identity is used");
const headers = { Cookie: cookie, Origin: origin.origin };
const read = async () => {
  const response = await call("/api/data", { headers });
  assert.equal(response.status, 200, "Apply pending local D1 migrations before the test.");
  return response.json();
};
const initial = await read();
assert.deepEqual(initial.state, newState(), "Refusing fixture writes: the local journal is not empty. Use an isolated empty preview database.");
const knownStates = [structuredClone(initial.state)];
let changed = false, revision = initial.revision, cleanup = "not needed";
const fixture = newState();
const workout = newWorkout(fixture.gyms[0], "Pull");
workout.exercises[0].machine = "SYNTHETIC PHOTO TEST — not personal data";
logSet(workout, workout.exercises[0].id, 20, 10);
fixture.workouts.push(workout);
photoContext = JSON.stringify({ workoutId: workout.id, date: workout.date, routine: workout.routine, muscles: getWorkedMuscles(workout) });
const photoPath = `/api/photos?workoutId=${encodeURIComponent(workout.id)}`;
const put = async state => {
  // A lost response does not prove a write failed. Register both the attempt and
  // the permitted cleanup state before sending it.
  changed = true;
  knownStates.push(structuredClone(state));
  const response = await call("/api/data", { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ state, revision }) });
  assert.equal(response.status, 200, `Could not save synthetic journal: ${await response.clone().text()}`);
  revision = (await response.json()).revision;
};
const info = async () => {
  const response = await call(photoPath, { headers });
  assert.equal(response.status, 200, `Could not read synthetic photo: ${await response.clone().text()}`);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return (await response.json()).photo;
};
const upload = (previousId = null, body = form(), extra = {}) => call(photoPath, { method: "POST", headers: { ...headers, ...(previousId ? { "If-Match": previousId } : { "If-None-Match": "*" }), ...extra }, body });
const verifyBytes = async (url, expected, label) => {
  assert.ok(url.startsWith("/api/photos/"), "Images must use the authenticated same-origin endpoint.");
  const response = await call(url, { headers });
  expect(response.status, 200, `${label} loads`);
  expect(response.headers.get("cache-control"), "private, no-store", `${label} is not cached`);
  expect(response.headers.get("x-content-type-options"), "nosniff", `${label} disables MIME sniffing`);
  expect(response.headers.get("content-type"), "image/jpeg", `${label} has JPEG content type`);
  expect(Buffer.from(await response.arrayBuffer()), expected, `${label} bytes survive storage`);
};

try {
  await put(fixture);
  expect((await upload()).status, 409, "Unfinished workout cannot receive a photo");
  workout.finishedAt = new Date().toISOString();
  await put(fixture);
  expect(await info(), null, "Finished workout initially has no photo");
  expect((await call("/api/photos", { headers })).status, 400, "Photo metadata requires a workout identifier");
  expect((await call("/api/photos?workoutId=missing-synthetic-workout", { headers })).status, 404, "Unknown workout metadata is not exposed");
  expect((await upload(null, form(), { Origin: "https://foreign.example" })).status, 403, "Cross-origin photo write rejected");
  expect((await call(photoPath, { method: "DELETE", headers: { ...headers, Origin: "https://foreign.example" } })).status, 403, "Cross-origin photo delete rejected");
  expect((await call(photoPath, { method: "POST", headers, body: form() })).status, 409, "Upload requires an explicit creation/replacement precondition");
  rejection(await upload(null, "not multipart", { "Content-Type": "text/plain" }), "Non-multipart body rejected");
  rejection(await upload(null, form(new Blob([originalBytes], { type: "image/png" }))), "Incorrect image MIME rejected");
  rejection(await upload(null, form(new Blob(["invalid jpeg"], { type: "image/jpeg" }))), "Invalid JPEG signature rejected");
  rejection(await upload(null, form(undefined, null)), "Missing composite rejected");
  rejection(await upload(null, form(new Blob([new Uint8Array(4_000_001)], { type: "image/jpeg" }))), "Per-file byte cap enforced");
  rejection(await upload(null, new Uint8Array(9_000_001), { "Content-Type": "multipart/form-data; boundary=synthetic-size-probe" }), "Total request byte cap enforced");
  expect(await info(), null, "Rejected uploads leave photo metadata empty");
  const staleOverlay = form();
  staleOverlay.set("context", JSON.stringify({ workoutId: workout.id, date: workout.date, routine: workout.routine, muscles: [] }));
  expect((await upload(null, staleOverlay)).status, 409, "Overlay prepared from stale workout muscles is rejected");

  const savedResponse = await upload();
  expect(savedResponse.status, 201, "Valid original and composite upload succeeds");
  let saved = (await savedResponse.json()).photo;
  expect(saved.workoutId, workout.id, "Photo retains its workout identifier");
  expect([saved.date, saved.routine], [workout.date, "Pull"], "Photo date and routine come from the saved workout");
  expect(saved.muscles, getWorkedMuscles(workout), "Photo muscle list comes only from logged exercises");
  assert.ok(!("userId" in saved) && !("originalKey" in saved) && !("compositeKey" in saved), "Metadata must not expose bucket keys or identity.");
  checks.push("Metadata omits storage keys and user identity");
  expect((await info()).id, saved.id, "A fresh metadata read returns the saved photo");
  await verifyBytes(saved.url, compositeBytes, "Composite");
  await verifyBytes(saved.originalUrl, originalBytes, "Original");
  expect((await call(saved.url)).status, 401, "Saved photo URL still requires authentication");
  expect((await call(saved.url, { headers: { "oai-authenticated-user-id": "spoofed" } })).status, 401, "Spoofed identity cannot read saved image bytes");
  expect((await call("/api/photos/missing-synthetic-photo", { headers })).status, 404, "Unknown photo ID returns no bytes");
  const oldMuscles = getWorkedMuscles(workout);
  workout.finishedAt = null;
  logSet(workout, workout.exercises.find(exercise => exercise.name === "Ab crunch machine").id, 20, 10);
  workout.finishedAt = new Date().toISOString();
  await put(fixture);
  expect((await info()).muscles, oldMuscles, "Existing photo retains its original muscle snapshot after workout edits");
  expect((await upload(saved.id)).status, 409, "Old overlay context cannot replace a photo after newly logged muscles");
  await verifyBytes(saved.originalUrl, originalBytes, "Original retained for overlay regeneration");
  photoContext = JSON.stringify({ workoutId: workout.id, date: workout.date, routine: workout.routine, muscles: getWorkedMuscles(workout) });
  const regeneratedResponse = await upload(saved.id);
  expect(regeneratedResponse.status, 201, "Refreshed overlay context can replace the previous photo");
  const regenerated = (await regeneratedResponse.json()).photo;
  expect(regenerated.muscles, getWorkedMuscles(workout), "Regenerated photo records the newly trained muscles");
  expect((await call(saved.url, { headers })).status, 404, "Old photo URL no longer serves the outdated overlay");
  saved = regenerated;
  expect((await upload()).status, 409, "Creation cannot overwrite an existing photo");
  expect((await upload("stale-photo-id")).status, 409, "Stale replacement is rejected");
  expect((await info()).id, saved.id, "Stale requests preserve the committed photo");

  const race = await Promise.all([upload(saved.id), upload(saved.id)]);
  expect(race.map(response => response.status).sort(), [201, 409], "Concurrent replacements allow exactly one winner");
  const winner = (await race.find(response => response.status === 201).json()).photo;
  expect((await info()).id, winner.id, "Fresh metadata identifies the replacement winner");
  expect((await call(saved.url, { headers })).status, 404, "Replaced photo identifier no longer serves an image");
  await verifyBytes(winner.url, compositeBytes, "Replacement composite");
  expect((await call(photoPath, { method: "DELETE", headers: { ...headers, "If-Match": saved.id } })).status, 409, "Stale delete cannot remove the replacement");
  expect((await info()).id, winner.id, "Stale delete preserves the latest photo");
  expect((await call(photoPath, { method: "DELETE", headers: { ...headers, "If-Match": winner.id } })).status, 200, "Current photo deletion succeeds");
  expect(await info(), null, "Deleted photo is absent on reload");
  expect((await call(winner.url, { headers })).status, 404, "Deleted image URL returns no bytes");
  expect((await call(photoPath, { method: "DELETE", headers: { ...headers, "If-Match": winner.id } })).status, 200, "Retrying completed deletion is safe");

  const finalUpload = await upload();
  expect(finalUpload.status, 201, "A new photo can be added after deletion");
  const finalPhoto = (await finalUpload.json()).photo;
  await put(initial.state);
  expect((await call(photoPath, { headers })).status, 404, "Deleting a workout removes its photo from metadata access");
  expect((await call(finalPhoto.url, { headers })).status, 404, "Deleting a workout removes access to its image bytes");
  expect((await read()).state, initial.state, "Workout deletion leaves the original empty journal");
} finally {
  if (changed) {
    const current = await read();
    assert.ok(knownStates.some(state => isDeepStrictEqual(state, current.state)), "Concurrent local edits detected; refusing cleanup to preserve unfamiliar data.");
    revision = current.revision;
    if (!isDeepStrictEqual(current.state, initial.state)) await put(initial.state);
    expect((await read()).state, initial.state, "Cleanup preserves the initial empty journal");
    cleanup = "restored original empty journal; photo cleanup follows workout deletion; revisions retained";
  }
  await mkdir(".sites-runtime", { recursive: true });
  const report = { target: origin.origin, checkedAt: new Date().toISOString(), checks, cleanup, lastRevision: revision,
    limits: ["Only the isolated mock identity was used; separate real-account access was not exercised.", "No injected R2/D1 failure or deterministic delete-during-upload interleaving was exercised.", "HTTP checks establish access behavior; inspect local storage separately to verify physical object cleanup."] };
  await writeFile(".sites-runtime/photos-smoke-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
