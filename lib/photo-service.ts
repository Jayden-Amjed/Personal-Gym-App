import { env } from "cloudflare:workers";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/index";
import { journals, sessionPhotos } from "../db/schema";
import { validateState } from "./model";
import { getWorkedMuscles } from "./training";
import { validateJpegBytes } from "./photo-validation";

export const privateJson = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});
export const sameOrigin = (request: Request) => !request.headers.get("origin") || request.headers.get("origin") === new URL(request.url).origin;
const MAX_FILE = 4_000_000;
const MAX_REQUEST = 9_000_000;
type Photo = typeof sessionPhotos.$inferSelect;
export function photoRecord(row: Omit<Photo, "deletedAt">) {
  return { id: row.id, workoutId: row.workoutId, date: row.date, routine: row.routine,
    muscles: JSON.parse(row.muscles) as string[], createdAt: row.createdAt,
    url: `/api/photos/${encodeURIComponent(row.id)}`, originalUrl: `/api/photos/${encodeURIComponent(row.id)}?variant=original` };
}
export async function ownedWorkout(userId: string, workoutId: string) {
  const row = await getDb().select().from(journals).where(eq(journals.userId, userId)).get();
  return row && validateState(JSON.parse(row.state)).workouts.find(workout => workout.id === workoutId);
}
export async function ownedPhoto(userId: string, workoutId: string, includeDeleted = false) {
  return getDb().select().from(sessionPhotos).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.workoutId, workoutId), includeDeleted ? undefined : isNull(sessionPhotos.deletedAt))).get();
}
async function boundedForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Error("Upload JPEG photo files.");
  if (Number(request.headers.get("content-length")) > MAX_REQUEST) throw new Error("Photo upload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a photo first.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_REQUEST) { await reader.cancel(); throw new Error("Photo upload is too large."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
}
async function jpeg(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || value.type !== "image/jpeg" || value.size > MAX_FILE || value.size < 4) throw new Error("Each photo must be a JPEG smaller than 4 MB.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  validateJpegBytes(bytes);
  return bytes;
}
function matches(request: Request, existing: Photo | undefined) {
  return existing ? request.headers.get("if-match") === existing.id : request.headers.get("if-none-match") === "*";
}
export async function uploadPhoto(request: Request, userId: string, workoutId: string) {
  const journal = await getDb().select().from(journals).where(eq(journals.userId, userId)).get();
  const workout = journal && validateState(JSON.parse(journal.state)).workouts.find(w => w.id === workoutId);
  if (!workout?.finishedAt) return privateJson({ error: "Finish and save this workout before adding its photo." }, 409);
  if (!env.BUCKET) return privateJson({ error: "Photo storage is unavailable. Your workout is saved; keep the photo and retry." }, 503);
  // A failed deletion can outlive the page that requested it. Finish that
  // persisted intent before creation so a hidden tombstone cannot permanently
  // occupy the unique workout slot. Immutable IDs protect newer replacements.
  const pending = await ownedPhoto(userId, workoutId, true);
  if (pending?.deletedAt) {
    try {
      await env.BUCKET.delete([pending.originalKey, pending.compositeKey]);
      await getDb().delete(sessionPhotos).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, pending.id), isNotNull(sessionPhotos.deletedAt)));
    } catch {
      return privateJson({ error: "The previous photo is still being deleted. Your new preview is safe; retry when storage is available." }, 503);
    }
  }
  const existing = await ownedPhoto(userId, workoutId);
  if (!matches(request, existing)) return privateJson({ error: "This session photo changed elsewhere. Refresh before replacing it." }, 409);
  let original: Uint8Array, composite: Uint8Array;
  try {
    const form = await boundedForm(request);
    const expectedContext = JSON.stringify({ workoutId: workout.id, date: workout.date, routine: workout.routine, muscles: getWorkedMuscles(workout) });
    if (form.get("context") !== expectedContext) return privateJson({ error: "The workout's muscle map changed. Choose the photo again to update its overlay." }, 409);
    [original, composite] = await Promise.all([jpeg(form.get("original")), jpeg(form.get("composite"))]);
  } catch (error) { return privateJson({ error: error instanceof Error ? error.message : "Unable to read photo." }, 400); }
  const id = crypto.randomUUID(), base = `session-photos/${encodeURIComponent(userId)}/${id}`;
  const values = { id, userId, workoutId, date: workout.date, routine: workout.routine,
    muscles: JSON.stringify(getWorkedMuscles(workout)), originalKey: `${base}/original.jpg`, compositeKey: `${base}/composite.jpg`, createdAt: new Date().toISOString() };
  try {
    const uploads = await Promise.allSettled([env.BUCKET.put(values.originalKey, original, { httpMetadata: { contentType: "image/jpeg" } }), env.BUCKET.put(values.compositeKey, composite, { httpMetadata: { contentType: "image/jpeg" } })]);
    if (uploads.some(result => result.status === "rejected")) { await env.BUCKET.delete([values.originalKey, values.compositeKey]).catch(() => {}); throw new Error("Photo storage failed."); }
    // Recheck the authoritative workout after the upload, including exercise edits.
    const latest = await ownedWorkout(userId, workoutId);
    if (!latest?.finishedAt || JSON.stringify(latest) !== JSON.stringify(workout)) {
      await env.BUCKET.delete([values.originalKey, values.compositeKey]);
      return privateJson({ error: "The workout changed during upload. Refresh and prepare the photo again." }, 409);
    }
    // The existence/finished/workout snapshot predicate and metadata mutation are
    // one D1 statement, closing the delete-during-upload race.
    const predicate = sql`exists (select 1 from journals where journals.user_id = ${userId} and journals.revision = ${journal!.revision})`;
    const changed = existing
      ? await getDb().update(sessionPhotos).set(values).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, existing.id), isNull(sessionPhotos.deletedAt), predicate)).returning()
      : await getDb().all(sql`insert into session_photos (id,user_id,workout_id,date,routine,muscles,original_key,composite_key,created_at)
          select ${values.id},${userId},${workoutId},${values.date},${values.routine},${values.muscles},${values.originalKey},${values.compositeKey},${values.createdAt}
          where ${predicate} on conflict do nothing returning id`);
    if (!changed.length) {
      await env.BUCKET.delete([values.originalKey, values.compositeKey]);
      return privateJson({ error: "The photo changed in another window. Refresh before trying again." }, 409);
    }
    if (existing) await env.BUCKET.delete([existing.originalKey, existing.compositeKey]).catch(() => {});
    return privateJson({ photo: photoRecord(values) }, 201);
  } catch {
    // Never remove a successfully committed image if metadata commit status is uncertain.
    const readback = await ownedPhoto(userId, workoutId).then(photo => ({ known: true, photo })).catch(() => ({ known: false, photo: undefined }));
    if (readback.photo?.id === id) return privateJson({ photo: photoRecord(readback.photo) }, 201);
    if (readback.known) await env.BUCKET.delete([values.originalKey, values.compositeKey]).catch(() => {});
    return privateJson({ error: "The photo could not be saved. Keep this preview and retry." }, 503);
  }
}
export async function deletePhoto(request: Request, userId: string, workoutId: string) {
  const existing = await ownedPhoto(userId, workoutId, true);
  if (!existing) return privateJson({ photo: null });
  if (!matches(request, existing)) return privateJson({ error: "This photo changed elsewhere. Refresh before deleting it." }, 409);
  if (!env.BUCKET) return privateJson({ error: "Photo storage is unavailable. Retry deletion when connected." }, 503);
  // Persist deletion intent atomically before touching immutable image keys.
  // Reads hide the tombstone, while retries retain the keys until cleanup works.
  const marked = await getDb().update(sessionPhotos).set({ deletedAt: new Date().toISOString() }).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, existing.id))).returning();
  if (!marked.length) return privateJson({ error: "The photo changed elsewhere. Refresh and retry." }, 409);
  await env.BUCKET.delete([existing.originalKey, existing.compositeKey]);
  const removed = await getDb().delete(sessionPhotos).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, existing.id))).returning();
  if (!removed.length) return privateJson({ error: "The photo changed elsewhere. Refresh and retry." }, 409);
  return privateJson({ photo: null });
}

/** Hide and remove images for deleted workouts after the journal's revision-checked save. */
export async function removeDeletedWorkoutPhotos(userId: string, workoutIds: string[]) {
  const rows = await getDb().select().from(sessionPhotos).where(eq(sessionPhotos.userId, userId));
  const keep = new Set(workoutIds);
  for (const row of rows) if (row.deletedAt || !keep.has(row.workoutId)) {
    // Recheck the latest journal atomically, rather than trusting a prior save's
    // list if another device has already saved a later revision.
    const stillMissing = sql`not exists (select 1 from journals, json_each(journals.state, '$.workouts') as w where journals.user_id = ${userId} and json_extract(w.value, '$.id') = ${row.workoutId})`;
    const marked = row.deletedAt ? [row] : await getDb().update(sessionPhotos).set({ deletedAt: new Date().toISOString() }).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, row.id), stillMissing)).returning();
    if (!marked.length || !env.BUCKET) continue;
    await env.BUCKET.delete([row.originalKey, row.compositeKey]);
    await getDb().delete(sessionPhotos).where(and(eq(sessionPhotos.userId, userId), eq(sessionPhotos.id, row.id)));
  }
}
