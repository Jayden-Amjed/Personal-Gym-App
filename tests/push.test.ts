import test from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import * as webpush from "web-push";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { newState, newWorkout } from "../lib/model.ts";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { logSet } from "../lib/training.ts";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { PushActionSchema, READY_BODY, SubscriptionSchema, buildQstashRequest, cancelPush, getPushConfig, isTrustedPushEndpoint, pushDeduplicationId, schedulePush, verifySavedTimer } from "../lib/push-service.ts";

const require = createRequire(import.meta.url);
const ece = require("http_ece") as { decrypt: (body: Buffer, options: { version: string; privateKey: ReturnType<typeof createECDH>; authSecret: string }) => Buffer };
function fixtures() {
  const key = createECDH("prime256v1"); key.generateKeys();
  const subscription = { endpoint: "https://web.push.apple.com/test-fixture", keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
  const vapid = webpush.generateVAPIDKeys();
  const config = { token: "TEST-ONLY-NOT-A-REAL-TOKEN", ...vapid, subject: "https://repbook.example" };
  const authorization = webpush.getVapidHeaders(new URL(subscription.endpoint).origin, config.subject, config.publicKey, config.privateKey, "aes128gcm").Authorization;
  const now = Date.UTC(2026, 10, 12, 20, 0);
  const state = newState(), workout = newWorkout(state.gyms[0], "Pull", new Date(now));
  state.workouts.push(workout);
  const set = logSet(workout, workout.exercises[0].id, 90, 10, new Date(now));
  const timer = { id: "timer-test", workoutId: workout.id, setId: set.id, endsAt: now + 150_000 };
  return { key, subscription, config, authorization, now, state, workout, set, timer };
}

test("unconfigured push remains unavailable without all valid server settings", () => {
  const { config } = fixtures();
  assert.equal(getPushConfig({}), null);
  assert.equal(getPushConfig({ QSTASH_TOKEN: config.token }), null);
  assert.equal(getPushConfig({ QSTASH_TOKEN: config.token, VAPID_PUBLIC_KEY: config.publicKey, VAPID_PRIVATE_KEY: config.privateKey, VAPID_SUBJECT: "http://localhost" }), null);
  assert.deepEqual(getPushConfig({ QSTASH_TOKEN: config.token, VAPID_PUBLIC_KEY: config.publicKey, VAPID_PRIVATE_KEY: config.privateKey, VAPID_SUBJECT: config.subject }), config);
});

test("push endpoint validation blocks arbitrary URLs, credentials, ports, and lookalikes", () => {
  for (const endpoint of ["https://web.push.apple.com/id", "https://fcm.googleapis.com/fcm/send/id", "https://updates.push.services.mozilla.com/wpush/v2/id"]) assert.equal(isTrustedPushEndpoint(endpoint), true);
  for (const endpoint of ["http://web.push.apple.com/id", "https://127.0.0.1/id", "https://web.push.apple.com.evil.example/id", "https://evil.example/web.push.apple.com", "https://user:secret@web.push.apple.com/id", "https://web.push.apple.com:8443/id", "https://web.push.apple.com/id?redirect=https://internal", "https://web.push.apple.com/id#fragment", "https://web.push.apple.com/"]) assert.equal(isTrustedPushEndpoint(endpoint), false, endpoint);
  const { subscription } = fixtures();
  assert.doesNotThrow(() => SubscriptionSchema.parse(subscription));
  assert.throws(() => SubscriptionSchema.parse({ ...subscription, keys: { ...subscription.keys, auth: "short" } }));
  assert.throws(() => PushActionSchema.parse({ action: "cancel", deviceId: "device-1234", timerId: "../another" }));
});

test("only a persisted current set can schedule its configured, unexpired interval", () => {
  const { now, state, workout, set, timer } = fixtures();
  assert.deepEqual(verifySavedTimer(state, timer, now + 1000), { endsAt: timer.endsAt, setAt: now, sequence: 1 });
  assert.throws(() => verifySavedTimer(state, { ...timer, setId: "missing" }, now + 1000));
  assert.throws(() => verifySavedTimer(state, { ...timer, endsAt: timer.endsAt + 10_000 }, now + 1000));
  assert.throws(() => verifySavedTimer(state, timer, timer.endsAt));
  workout.finishedAt = new Date(now + 1000).toISOString();
  assert.throws(() => verifySavedTimer(state, timer, now + 1000));
  workout.finishedAt = null;
  logSet(workout, workout.exercises[1].id, 70, 10, new Date(now + 2000));
  assert.throws(() => verifySavedTimer(state, timer, now + 3000));
  assert.ok(set.context);
});

test("QStash receives encrypted binary and only a generic ready payload", () => {
  const { key, subscription, config, timer, authorization } = fixtures();
  const request = buildQstashRequest(config, subscription, timer, "hashed-fixture-id", authorization);
  assert.equal(request.url, `https://qstash.upstash.io/v2/publish/${subscription.endpoint}`);
  assert.equal(request.headers.Authorization, `Bearer ${config.token}`);
  const headers = new Headers(request.headers);
  assert.match(headers.get("upstash-forward-authorization")!, /^vapid /);
  assert.equal(headers.get("upstash-forward-authorization"), authorization);
  assert.equal(headers.get("upstash-forward-authorization")!.includes(config.token), false);
  assert.equal(headers.get("upstash-forward-ttl"), "60");
  assert.equal(headers.get("upstash-forward-content-encoding"), "aes128gcm");
  assert.equal(headers.get("upstash-retries"), "0");
  assert.equal(headers.get("upstash-redact-fields"), "body, header[Authorization]");
  assert.equal(headers.get("upstash-not-before"), String(Math.ceil(timer.endsAt / 1000)));
  assert.equal(Buffer.from(request.body).includes(Buffer.from(READY_BODY)), false);
  const decrypted = JSON.parse(ece.decrypt(Buffer.from(request.body), { version: "aes128gcm", privateKey: key, authSecret: subscription.keys.auth }).toString());
  assert.deepEqual(decrypted, { type: "repbook-rest-ready", timerId: timer.id, endsAt: timer.endsAt, title: "Repbook", body: READY_BODY });
  assert.equal(JSON.stringify(decrypted).includes(timer.workoutId), false);
  assert.equal(JSON.stringify(decrypted).includes(timer.setId), false);
  const another = buildQstashRequest(config, subscription, { ...timer, id: "next-timer" }, "next-hash", authorization);
  assert.equal(new Headers(another.headers).get("upstash-forward-authorization"), authorization);
  assert.notDeepEqual(request.body, another.body, "Authorization reuse must not reuse payload encryption.");
});

test("scheduling retries lost acknowledgements with stable idempotency and no cleartext data", async () => {
  const { subscription, config, timer, authorization } = fixtures();
  const dedupe = await pushDeduplicationId("private-user", "device-1234", timer.id);
  assert.match(dedupe, /^[a-f0-9]{64}$/);
  assert.equal(dedupe, await pushDeduplicationId("private-user", "device-1234", timer.id));
  assert.notEqual(dedupe, await pushDeduplicationId("other-user", "device-1234", timer.id));
  const requests: RequestInit[] = [];
  const send: typeof fetch = async (_url, options) => {
    requests.push(options!);
    if (requests.length === 1) throw new Error("Lost acknowledgement");
    return Response.json({ messageId: "msg_test", deduplicated: true }, { status: 202 });
  };
  assert.equal(await schedulePush(config, subscription, timer, dedupe, authorization, send), "msg_test");
  assert.equal(requests.length, 2);
  assert.equal(new Headers(requests[0].headers).get("upstash-deduplication-id"), new Headers(requests[1].headers).get("upstash-deduplication-id"));
  assert.deepEqual(requests[0].body, requests[1].body);
  assert.equal(requests[0].redirect, "error");
});

test("provider errors never become scheduled success and do not expose responses or tokens", async () => {
  const { subscription, config, timer, authorization } = fixtures();
  await assert.rejects(schedulePush(config, subscription, timer, "test", authorization, async () => new Response(`Provider detail ${config.token}`, { status: 401 })), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(config.token), false);
    return /could not be confirmed/.test(error.message);
  });
  await assert.rejects(schedulePush(config, subscription, timer, "test", authorization, async () => Response.json({ messageId: "../../secrets" })));
});

test("cancellation addresses only the known message and reports uncertainty", async () => {
  const { config } = fixtures();
  let requestUrl = "";
  await cancelPush(config, "msg_test", async (url, options) => {
    requestUrl = String(url);
    assert.equal(options?.method, "DELETE");
    assert.equal(options?.redirect, "error");
    return new Response(null, { status: 202 });
  });
  assert.equal(requestUrl, "https://qstash.upstash.io/v2/messages/msg_test");
  await cancelPush(config, "msg_gone", async () => new Response(null, { status: 404 }));
  await assert.rejects(cancelPush(config, "msg_test", async () => new Response(null, { status: 503 })), /Cancellation could not be confirmed/);
  await assert.rejects(cancelPush(config, "../bad", async () => { throw new Error("Must never fetch"); }), /Invalid stored alert reference/);
});
