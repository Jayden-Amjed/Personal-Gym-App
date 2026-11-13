import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
// @ts-ignore Node's native TypeScript runner resolves explicit .ts imports.
import { createRestTimer, formatRestTime, parseRestTimer, remainingRestSeconds, restAlertMode } from "../lib/rest-timer.ts";

const input = { workoutId: "workout", exerciseId: "rows", setId: "set", exerciseName: "T-bar rows", seconds: 150 };
const start = new Date("2026-11-13T01:00:00Z").getTime();

test("rest uses elapsed wall time after a paused tab or reload", () => {
  const timer = createRestTimer(input, start, "timer");
  assert.equal(remainingRestSeconds(timer, start), 150);
  assert.equal(remainingRestSeconds(timer, start + 61_250), 89);
  const restored = parseRestTimer(JSON.stringify(timer), start + 125_000);
  assert.deepEqual(restored, timer);
  assert.equal(remainingRestSeconds(restored, start + 125_000), 25);
  assert.equal(remainingRestSeconds(restored, start + 900_000), 0);
  assert.equal(formatRestTime(150), "2:30");
  assert.equal(formatRestTime(90), "1:30");
});

test("expired and resumed timers cannot masquerade as on-time alerts", () => {
  const timer = createRestTimer(input, start, "timer");
  assert.equal(restAlertMode(timer, timer.endsAt - 1), "wait");
  assert.equal(restAlertMode(timer, timer.endsAt + 500), "on-time");
  assert.equal(restAlertMode(timer, timer.endsAt + 500, true), "catch-up");
  assert.equal(restAlertMode(timer, timer.endsAt + 3_000), "catch-up");
  const alerted = { ...timer, alertedAt: timer.endsAt + 500 };
  assert.equal(restAlertMode(alerted, timer.endsAt + 600), "none");
  assert.equal(restAlertMode(parseRestTimer(JSON.stringify(alerted), timer.endsAt + 600), timer.endsAt + 600), "none");
});

test("invalid, stale, or impossible local timers are rejected", () => {
  const timer = createRestTimer(input, start, "timer");
  for (const raw of ["not JSON", "null", "[]", JSON.stringify({ ...timer, endsAt: start - 1 }), JSON.stringify({ ...timer, alertedAt: start }), JSON.stringify({ ...timer, workoutId: "" }), JSON.stringify({ ...timer, endsAt: start + 3_601_000 })]) {
    assert.equal(parseRestTimer(raw, start), null);
  }
  assert.equal(parseRestTimer(JSON.stringify(timer), timer.endsAt + 86_400_001), null);
  assert.throws(() => createRestTimer({ ...input, seconds: 0 }, start, "timer"));
  assert.throws(() => createRestTimer({ ...input, seconds: 1.5 }, start, "timer"));
  assert.throws(() => createRestTimer({ ...input, seconds: 3_601 }, start, "timer"));
});

function workerHarness(windows: { url: string; focus: () => Promise<void> }[] = []) {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const notifications: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const worker = {
    location: { origin: "https://repbook.example" },
    addEventListener: (name: string, listener: typeof handlers[string]) => { handlers[name] = listener; },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => { notifications.push({ title, options }); } },
    clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self: worker, URL, Date });
  const dispatch = async (name: string, event: Record<string, unknown>) => {
    let work: Promise<unknown> = Promise.resolve();
    handlers[name]({ ...event, waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
  };
  return { notifications, opened, dispatch };
}

test("push always shows a generic notification, including malformed or delayed payloads", async () => {
  const worker = workerHarness();
  await worker.dispatch("push", { data: { json: () => ({ timerId: "timer_1", endsAt: Date.now() - 61_000, body: "private workout data" }) } });
  assert.equal(worker.notifications[0].title, "Repbook");
  assert.match(String(worker.notifications[0].options.body), /earlier rest timer/);
  assert.doesNotMatch(JSON.stringify(worker.notifications), /private workout data/);
  await worker.dispatch("push", { data: { json: () => { throw new Error("bad JSON"); } } });
  assert.equal(worker.notifications.length, 2);
  assert.equal(worker.notifications[1].options.body, "You're ready for your next set!");
});

test("notification clicks focus this origin or open its root, never a payload URL", async () => {
  let focused = 0;
  const worker = workerHarness([{ url: "https://repbook.example/?view=train", focus: async () => { focused++; } }]);
  await worker.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://untrusted.example" } } });
  assert.equal(focused, 1);
  assert.deepEqual(worker.opened, []);
  const other = workerHarness([{ url: "https://untrusted.example", focus: async () => { throw new Error("wrong origin"); } }]);
  await other.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://untrusted.example" } } });
  assert.deepEqual(other.opened, ["https://repbook.example/"]);
});
