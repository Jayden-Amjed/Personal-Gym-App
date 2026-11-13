import * as webpush from "web-push";
import { z } from "zod";
import type { State } from "./model";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { getRestSeconds } from "./training.ts";

const QSTASH_ORIGIN = "https://qstash.upstash.io";
export const READY_BODY = "Repbook says: you're ready for your next set!";
const urlSafe = /^[A-Za-z0-9_-]+$/;
const recordId = z.string().min(1).max(100).regex(urlSafe);
export const DeviceIdSchema = z.string().min(8).max(100).regex(urlSafe);

export function isTrustedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!url.port || url.port === "443") && !url.username && !url.password && !url.search && !url.hash
      && ["web.push.apple.com", "fcm.googleapis.com", "updates.push.services.mozilla.com"].includes(url.hostname)
      && url.pathname.length > 1 && url.href.length <= 2048;
  } catch { return false; }
}

export const SubscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(isTrustedPushEndpoint, "Use a supported Safari, Chrome, or Firefox push subscription."),
  keys: z.object({ p256dh: z.string().length(87).regex(urlSafe), auth: z.string().length(22).regex(urlSafe) }).strict(),
  expirationTime: z.number().nullable().optional(),
}).strict();
export type PushSubscription = z.infer<typeof SubscriptionSchema>;
const TimerSchema = z.object({ id: recordId, workoutId: recordId, setId: recordId, endsAt: z.number().int().positive() }).strict();
export type PushTimer = z.infer<typeof TimerSchema>;
export const PushActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), deviceId: DeviceIdSchema, subscription: SubscriptionSchema }).strict(),
  z.object({ action: z.literal("schedule"), deviceId: DeviceIdSchema, timer: TimerSchema }).strict(),
  z.object({ action: z.literal("cancel"), deviceId: DeviceIdSchema, timerId: recordId }).strict(),
  z.object({ action: z.literal("unsubscribe"), deviceId: DeviceIdSchema }).strict(),
]);

export type PushEnvironment = { QSTASH_TOKEN?: string; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };
export type PushConfig = { token: string; publicKey: string; privateKey: string; subject: string };
export function getPushConfig(env: PushEnvironment): PushConfig | null {
  if (!env.QSTASH_TOKEN?.trim() || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  if (!/^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY) || !/^[A-Za-z0-9_-]{43}$/.test(env.VAPID_PRIVATE_KEY)) return null;
  try {
    const subject = new URL(env.VAPID_SUBJECT);
    if (subject.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(subject.hostname)) return null;
  } catch { return null; }
  return { token: env.QSTASH_TOKEN, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
}

export class PushRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Only a recently saved real set may schedule its configured rest interval. */
export function verifySavedTimer(state: State, timer: PushTimer, now = Date.now()) {
  const workout = state.workouts.find(entry => entry.id === timer.workoutId);
  if (!workout || workout.finishedAt) throw new PushRequestError("This workout is no longer in progress.", 409);
  const exercise = workout.exercises.find(entry => entry.sets.some(set => set.id === timer.setId));
  const set = exercise?.sets.find(entry => entry.id === timer.setId);
  if (!exercise || !set?.context) throw new PushRequestError("Save this set before scheduling its rest alert.", 409);
  const setAt = Date.parse(set.context.loggedAt);
  const endsAt = setAt + getRestSeconds(exercise) * 1000;
  if (!Number.isFinite(setAt) || setAt > now + 2000 || endsAt <= now || endsAt > now + 600_000 || Math.abs(timer.endsAt - endsAt) > 2000) throw new PushRequestError("This rest timer expired or no longer matches the saved set.", 409);
  const newerSet = state.workouts.some(entry => entry.exercises.some(movement => movement.sets.some(saved => saved.context && (
    Date.parse(saved.context.loggedAt) > setAt || (entry.id === workout.id && saved.context.sequence > set.context!.sequence)
  ))));
  if (newerSet) throw new PushRequestError("A newer set has replaced this rest timer.", 409);
  return { endsAt, setAt, sequence: set.context.sequence };
}

export async function pushDeduplicationId(userId: string, deviceId: string, timerId: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([userId, deviceId, timerId]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function buildQstashRequest(config: PushConfig, subscription: PushSubscription, timer: Pick<PushTimer, "id" | "endsAt">, deduplicationId: string, authorization: string) {
  SubscriptionSchema.parse(subscription);
  const payload = JSON.stringify({ type: "repbook-rest-ready", timerId: timer.id, endsAt: timer.endsAt, title: "Repbook", body: READY_BODY });
  const details = webpush.generateRequestDetails(subscription, payload, {
    TTL: 60, urgency: "high", contentEncoding: "aes128gcm", topic: "repbook-rest",
  });
  // Encrypt each message independently, but reuse the D1-selected VAPID JWT.
  // Passing vapidDetails here would generate a new authorization on every set.
  details.headers.Authorization = authorization;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`, "Content-Type": "application/octet-stream",
    "Upstash-Not-Before": String(Math.ceil(timer.endsAt / 1000)), "Upstash-Retries": "0", "Upstash-Timeout": "5s",
    "Upstash-Deduplication-Id": deduplicationId,
    "Upstash-Redact-Fields": "body, header[Authorization]",
  };
  // Only transport headers from the trusted library may be forwarded. QStash
  // sees encrypted bytes and the push endpoint, never workout or health data.
  const allowed = new Set(["ttl", "urgency", "topic", "authorization", "content-encoding", "crypto-key", "encryption", "content-type"]);
  for (const [name, value] of Object.entries(details.headers)) if (allowed.has(name.toLowerCase())) headers[`Upstash-Forward-${name}`] = String(value);
  return { url: `${QSTASH_ORIGIN}/v2/publish/${details.endpoint}`, headers, body: new Uint8Array(details.body!) };
}

export async function schedulePush(config: PushConfig, subscription: PushSubscription, timer: Pick<PushTimer, "id" | "endsAt">, deduplicationId: string, authorization: string, send: typeof fetch = fetch): Promise<string> {
  const request = buildQstashRequest(config, subscription, timer, deduplicationId, authorization);
  // A second attempt uses the same dedupe ID, including after a lost response.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await send(request.url, { method: "POST", headers: request.headers, body: request.body, redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Scheduler unavailable");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("messageId" in result) || typeof result.messageId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(result.messageId)) throw new Error("Invalid scheduler response");
      return result.messageId;
    } catch { if (attempt === 1) throw new PushRequestError("The rest alert could not be confirmed. Keep Repbook open for its local timer.", 503); }
  }
  throw new PushRequestError("Rest alert scheduling is unavailable.", 503);
}

export async function cancelPush(config: PushConfig, messageId: string, send: typeof fetch = fetch): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(messageId)) throw new PushRequestError("Invalid stored alert reference.", 503);
  try {
    const response = await send(`${QSTASH_ORIGIN}/v2/messages/${messageId}`, { method: "DELETE", headers: { Authorization: `Bearer ${config.token}` }, redirect: "error", signal: AbortSignal.timeout(5000) });
    // A missing message has already left the queue; push delivery may have begun.
    if (!response.ok && response.status !== 404) throw new Error("Cancellation failed");
  } catch { throw new PushRequestError("Cancellation could not be confirmed; a pending alert may still arrive.", 503); }
}
