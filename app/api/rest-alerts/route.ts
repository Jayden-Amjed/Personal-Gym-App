import { env } from "cloudflare:workers";
import { and, eq, gt, isNotNull, lt, ne, or } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db/index";
import { journals } from "../../../db/schema";
import { pushSubscriptions, pushTimers } from "../../../db/push-schema";
import { validateState } from "../../../lib/model";
import { DeviceIdSchema, PushActionSchema, PushRequestError, SubscriptionSchema, cancelPush, getPushConfig, pushDeduplicationId, schedulePush, verifySavedTimer, type PushConfig } from "../../../lib/push-service";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const unavailable = "Locked-screen rest alerts need the scheduler to be configured. The in-app timer is available.";
const deviceScope = (userId: string, deviceId: string) => and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.deviceId, deviceId));
const timerScope = (userId: string, deviceId: string, timerId?: string) => and(eq(pushTimers.userId, userId), eq(pushTimers.deviceId, deviceId), timerId ? eq(pushTimers.timerId, timerId) : undefined);

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in to manage rest alerts." }, 401);
  const config = getPushConfig(env);
  if (!config) return json({ configured: false, publicKey: null, subscribed: false, reason: unavailable });
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("deviceId"));
  if (!device.success) return json({ error: "A valid device identifier is required." }, 400);
  try {
    const row = await getDb().select().from(pushSubscriptions).where(deviceScope(user.userId, device.data)).get();
    return json({ configured: true, publicKey: config.publicKey, subscribed: !!row?.subscription });
  } catch { return json({ configured: false, publicKey: null, subscribed: false, reason: "Rest alert storage is unavailable. Keep Repbook open for its local timer." }, 503); }
}

async function boundedJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 8192) throw new PushRequestError("Rest alert request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PushRequestError("Send a JSON rest alert request.");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw new PushRequestError("Rest alert request is too large.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

async function cancelTimer(config: PushConfig, userId: string, deviceId: string, timerId: string) {
  const db = getDb(), now = Date.now();
  // Commit cancellation before making a network call. A concurrent publisher
  // sees this tombstone and cancels its just-created provider message itself.
  await db.insert(pushTimers).values({ userId, deviceId, timerId, status: "canceled", createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [pushTimers.userId, pushTimers.deviceId, pushTimers.timerId], set: { status: "canceled", updatedAt: now } });
  await db.update(pushSubscriptions).set({ activeTimerId: null, updatedAt: now }).where(and(deviceScope(userId, deviceId), eq(pushSubscriptions.activeTimerId, timerId)));
  const row = await db.select().from(pushTimers).where(timerScope(userId, deviceId, timerId)).get();
  if (row?.messageId) {
    await cancelPush(config, row.messageId);
    await db.update(pushTimers).set({ messageId: null, operationId: null }).where(and(timerScope(userId, deviceId, timerId), eq(pushTimers.messageId, row.messageId)));
  } else if (row?.operationId) {
    // The publisher may be in flight or have lost a provider acknowledgement.
    // A tombstone prevents resurrection, but cannot retract an unknown message.
    throw new PushRequestError("Cancellation is pending confirmation; an alert may still arrive. Keep Repbook open and retry.", 503);
  }
}

async function cancelOtherTimers(config: PushConfig, userId: string, deviceId: string, except?: string, olderThan?: { setAt: number; sequence: number }) {
  const rows = await getDb().select().from(pushTimers).where(and(timerScope(userId, deviceId), except ? ne(pushTimers.timerId, except) : undefined,
    olderThan ? or(lt(pushTimers.setAt, olderThan.setAt), and(eq(pushTimers.setAt, olderThan.setAt), lt(pushTimers.setSequence, olderThan.sequence))) : undefined,
    or(ne(pushTimers.status, "canceled"), isNotNull(pushTimers.messageId), and(isNotNull(pushTimers.operationId), gt(pushTimers.endsAt, Date.now() - 60_000))))).all();
  const results = await Promise.allSettled(rows.map(row => cancelTimer(config, userId, deviceId, row.timerId)));
  if (results.some(result => result.status === "rejected")) throw new PushRequestError("An earlier alert could not be canceled. Keep Repbook open and retry.", 503);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in to manage rest alerts." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "This request must come from Repbook." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Send a JSON rest alert request." }, 415);
  const config = getPushConfig(env);
  if (!config) return json({ configured: false, error: unavailable }, 503);
  try {
    const parsed = PushActionSchema.safeParse(await boundedJson(request));
    if (!parsed.success) return json({ error: "The rest alert request is invalid." }, 400);
    const action = parsed.data, userId = user.userId, deviceId = action.deviceId, db = getDb(), now = Date.now();
    // Old timers cannot pass the recent-set check, so expired tombstones can be pruned.
    await db.delete(pushTimers).where(and(eq(pushTimers.userId, userId), lt(pushTimers.updatedAt, now - 172_800_000)));
    if (action.action === "cancel") {
      await cancelTimer(config, userId, deviceId, action.timerId);
      return json({ canceled: true, timerId: action.timerId });
    }
    if (action.action === "unsubscribe") {
      await db.update(pushSubscriptions).set({ subscription: null, activeTimerId: null, updatedAt: now }).where(deviceScope(userId, deviceId));
      await cancelOtherTimers(config, userId, deviceId);
      return json({ subscribed: false });
    }
    if (action.action === "subscribe") {
      await db.update(pushSubscriptions).set({ subscription: null, activeTimerId: null, updatedAt: now }).where(deviceScope(userId, deviceId));
      await cancelOtherTimers(config, userId, deviceId);
      await db.insert(pushSubscriptions).values({ userId, deviceId, subscription: JSON.stringify(action.subscription), updatedAt: now })
        .onConflictDoUpdate({ target: [pushSubscriptions.userId, pushSubscriptions.deviceId], set: { subscription: JSON.stringify(action.subscription), activeTimerId: null, updatedAt: now } });
      return json({ subscribed: true });
    }

    const device = await db.select().from(pushSubscriptions).where(deviceScope(userId, deviceId)).get();
    if (!device?.subscription) throw new PushRequestError("Enable notifications on this device first.", 409);
    const subscription = SubscriptionSchema.parse(JSON.parse(device.subscription));
    const journal = await db.select({ state: journals.state }).from(journals).where(eq(journals.userId, userId)).get();
    if (!journal) throw new PushRequestError("Save this set before scheduling its rest alert.", 409);
    const timer = action.timer, saved = verifySavedTimer(validateState(JSON.parse(journal.state)), timer, now);
    const operationId = crypto.randomUUID();
    const inserted = await db.insert(pushTimers).values({ userId, deviceId, timerId: timer.id, status: "publishing", operationId, endsAt: saved.endsAt, setAt: saved.setAt, setSequence: saved.sequence, createdAt: now, updatedAt: now })
      .onConflictDoNothing().returning({ timerId: pushTimers.timerId });
    if (!inserted.length) {
      const existing = await db.select().from(pushTimers).where(timerScope(userId, deviceId, timer.id)).get();
      if (!existing || existing.status === "canceled" || existing.endsAt !== saved.endsAt) throw new PushRequestError("This rest timer has been canceled or replaced.", 409);
      if (existing.status === "scheduled" && device.activeTimerId === timer.id) return json({ scheduled: true, timerId: timer.id, endsAt: existing.endsAt });
      if (existing.status === "publishing" && existing.updatedAt > now - 15_000) throw new PushRequestError("This alert is still being scheduled. Retry shortly.", 409);
      const retried = await db.update(pushTimers).set({ status: "publishing", operationId, updatedAt: now }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.updatedAt, existing.updatedAt), ne(pushTimers.status, "canceled"))).returning({ timerId: pushTimers.timerId });
      if (!retried.length) throw new PushRequestError("This rest timer changed. Retry shortly.", 409);
    }
    const claimed = await db.update(pushSubscriptions).set({ activeTimerId: timer.id, latestSetAt: saved.setAt, latestSequence: saved.sequence, updatedAt: now }).where(and(
      deviceScope(userId, deviceId), eq(pushSubscriptions.subscription, device.subscription),
      or(lt(pushSubscriptions.latestSetAt, saved.setAt), and(eq(pushSubscriptions.latestSetAt, saved.setAt), lt(pushSubscriptions.latestSequence, saved.sequence)), eq(pushSubscriptions.activeTimerId, timer.id)),
    )).returning({ deviceId: pushSubscriptions.deviceId });
    if (!claimed.length) {
      // A newly inserted operation has not contacted the provider. Retried rows
      // may still represent a lost earlier acknowledgement, so keep their marker.
      if (inserted.length) await db.update(pushTimers).set({ operationId: null }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.operationId, operationId)));
      await cancelTimer(config, userId, deviceId, timer.id);
      throw new PushRequestError("A newer rest timer replaced this one.", 409);
    }
    let messageId: string | null = null, publicationStarted = false;
    try {
      await cancelOtherTimers(config, userId, deviceId, timer.id, saved);
      const beforePublish = await db.select().from(pushTimers).where(timerScope(userId, deviceId, timer.id)).get();
      const beforeDevice = await db.select({ timerId: pushSubscriptions.activeTimerId }).from(pushSubscriptions).where(deviceScope(userId, deviceId)).get();
      if (beforePublish?.status !== "publishing" || beforePublish.operationId !== operationId || beforeDevice?.timerId !== timer.id || saved.endsAt <= Date.now()) throw new PushRequestError("This rest timer was canceled or expired.", 409);
      const deduplicationId = await pushDeduplicationId(userId, deviceId, timer.id);
      publicationStarted = true;
      messageId = await schedulePush(config, subscription, { id: timer.id, endsAt: saved.endsAt }, deduplicationId);
      await db.update(pushTimers).set({ messageId }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.operationId, operationId)));
      const active = await db.select({ timerId: pushSubscriptions.activeTimerId }).from(pushSubscriptions).where(deviceScope(userId, deviceId)).get();
      const finalized = active?.timerId === timer.id ? await db.update(pushTimers).set({ status: "scheduled", updatedAt: Date.now() }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.operationId, operationId), eq(pushTimers.status, "publishing"))).returning({ timerId: pushTimers.timerId }) : [];
      if (!finalized.length) { await cancelTimer(config, userId, deviceId, timer.id); throw new PushRequestError("This rest timer was canceled or replaced.", 409); }
      return json({ scheduled: true, timerId: timer.id, endsAt: saved.endsAt });
    } catch (error) {
      // Keep known IDs for a later cancellation retry. Never report an uncertain
      // provider response as a successfully scheduled notification.
      if (messageId) await cancelPush(config, messageId).catch(() => {});
      await db.update(pushTimers).set({ status: "failed", updatedAt: Date.now() }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.operationId, operationId), eq(pushTimers.status, "publishing")));
      if (!publicationStarted) await db.update(pushTimers).set({ operationId: null }).where(and(timerScope(userId, deviceId, timer.id), eq(pushTimers.operationId, operationId)));
      throw error;
    }
  } catch (error) {
    if (error instanceof PushRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Rest alerts are temporarily unavailable. Keep Repbook open for its local timer." }, 503);
  }
}
