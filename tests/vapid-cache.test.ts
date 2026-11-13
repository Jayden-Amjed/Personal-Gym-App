import test from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import * as webpush from "web-push";
// @ts-ignore Native Node tests resolve explicit TypeScript extensions.
import { getCachedVapidAuthorization, type VapidDatabase } from "../lib/vapid-cache.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0002_vapid_token_cache.sql", import.meta.url), "utf8"));
  const db: VapidDatabase = {
    prepare(query) {
      return { bind(...values) { return { async first<T>() {
        // Let concurrent calls all observe a miss before attempting their atomic
        // writes; execute the actual production SQL against SQLite, not a mock.
        await Promise.resolve();
        return sqlite.prepare(query).get(...values) as T ?? null;
      } }; } };
    },
  };
  const identity = { ...webpush.generateVAPIDKeys(), subject: "https://repbook.example" };
  return { sqlite, db, identity, now: Date.now(), endpoint: "https://web.push.apple.com/test-fixture" };
}

function claims(authorization: string, publicKey: string) {
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
  assert.ok(match);
  assert.equal(match[2], publicKey);
  const [header, payload, signature] = match[1].split(".");
  const point = Buffer.from(publicKey, "base64url");
  const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: point.subarray(1, 33).toString("base64url"), y: point.subarray(33).toString("base64url") }, format: "jwk" });
  assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), true);
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as { aud: string; sub: string; exp: number };
}

test("VAPID tokens persist across callers and cover the delayed delivery deadline", async () => {
  const { sqlite, db, identity, now, endpoint } = fixture();
  try {
    const first = await getCachedVapidAuthorization(db, identity, endpoint, now + 600_000, now);
    const later = await getCachedVapidAuthorization(db, identity, endpoint, now + 3_750_000, now + 3_600_000);
    assert.equal(later, first);
    const value = claims(first, identity.publicKey);
    assert.equal(value.aud, new URL(endpoint).origin);
    assert.equal(value.sub, identity.subject);
    assert.ok(value.exp * 1000 > now + 600_000 + 90_000);
    assert.ok(value.exp * 1000 <= now + 12 * 3_600_000);
    const stored = sqlite.prepare("SELECT * FROM push_vapid_tokens").all();
    assert.equal(stored.length, 1);
    assert.equal(JSON.stringify(stored).includes(identity.privateKey), false);
  } finally { sqlite.close(); }
});

test("concurrent initial and refresh requests select exactly one shared authorization", async () => {
  const { sqlite, db, identity, now, endpoint } = fixture();
  try {
    const initial = await Promise.all(Array.from({ length: 8 }, () => getCachedVapidAuthorization(db, identity, endpoint, now + 150_000, now)));
    assert.equal(new Set(initial).size, 1);
    const beforeRefresh = now + 11 * 3_600_000 - 1;
    assert.equal(await getCachedVapidAuthorization(db, identity, endpoint, beforeRefresh + 600_000, beforeRefresh), initial[0]);
    const refreshAt = now + 11 * 3_600_000;
    const refreshed = await Promise.all(Array.from({ length: 8 }, () => getCachedVapidAuthorization(db, identity, endpoint, refreshAt + 600_000, refreshAt)));
    assert.equal(new Set(refreshed).size, 1);
    assert.notEqual(refreshed[0], initial[0]);
    assert.ok(claims(refreshed[0], identity.publicKey).exp * 1000 > refreshAt + 600_000 + 90_000);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM push_vapid_tokens").get()?.count, 1);
  } finally { sqlite.close(); }
});

test("VAPID cache separates audience, subject, and public key", async () => {
  const { sqlite, db, identity, now, endpoint } = fixture();
  try {
    const base = await getCachedVapidAuthorization(db, identity, endpoint, now + 150_000, now);
    const otherAudience = await getCachedVapidAuthorization(db, identity, "https://fcm.googleapis.com/test-fixture", now + 150_000, now);
    const otherSubject = await getCachedVapidAuthorization(db, { ...identity, subject: "https://another.example" }, endpoint, now + 150_000, now);
    const otherKey = await getCachedVapidAuthorization(db, { ...identity, ...webpush.generateVAPIDKeys() }, endpoint, now + 150_000, now);
    assert.equal(new Set([base, otherAudience, otherSubject, otherKey]).size, 4);
    assert.equal(claims(otherAudience, identity.publicKey).aud, "https://fcm.googleapis.com");
    assert.equal(claims(otherSubject, identity.publicKey).sub, "https://another.example");
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM push_vapid_tokens").get()?.count, 4);
  } finally { sqlite.close(); }
});

test("missing cache storage and unsafe delivery deadlines fail without a fallback token", async () => {
  const { sqlite, db, identity, now, endpoint } = fixture();
  try {
    await assert.rejects(getCachedVapidAuthorization(db, identity, endpoint, now - 1, now), /deadline/);
    await assert.rejects(getCachedVapidAuthorization(db, identity, endpoint, now + 600_001, now), /deadline/);
    sqlite.exec("DROP TABLE push_vapid_tokens");
    await assert.rejects(getCachedVapidAuthorization(db, identity, endpoint, now + 150_000, now), /no such table/);
  } finally { sqlite.close(); }
});
