import * as webpush from "web-push";

type VapidIdentity = { publicKey: string; privateKey: string; subject: string };
type BindValue = string | number;
/** The small D1 surface also lets tests exercise these statements in real SQLite. */
export type VapidDatabase = {
  prepare(query: string): { bind(...values: BindValue[]): { first<T>(): Promise<T | null> } };
};
type CachedToken = { authorization: string; refreshAt: number; expiresAt: number };

const LIFETIME_MS = 12 * 60 * 60 * 1000;
const REUSE_MS = 11 * 60 * 60 * 1000;
const DELIVERY_MARGIN_MS = 90_000;

/**
 * Reuse one signed authorization across isolates and devices, as Apple requires.
 * Only the signed, expiring JWT is stored; the VAPID private key stays in runtime
 * secrets. Refresh at eleven hours leaves an hour for a delayed ten-minute rest.
 */
export async function getCachedVapidAuthorization(db: VapidDatabase, identity: VapidIdentity, endpoint: string, deliveryAt: number, now = Date.now()): Promise<string> {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(deliveryAt) || deliveryAt < now || deliveryAt > now + 600_000) throw new Error("Invalid VAPID delivery deadline.");
  const audience = new URL(endpoint).origin;
  const keys = [identity.publicKey, audience, identity.subject];
  const existing = await db.prepare(`SELECT authorization, refresh_at AS refreshAt, expires_at AS expiresAt
    FROM push_vapid_tokens WHERE public_key = ? AND audience = ? AND subject = ?`).bind(...keys).first<CachedToken>();
  if (existing && existing.refreshAt > now && existing.expiresAt > deliveryAt + DELIVERY_MARGIN_MS) return existing.authorization;

  const expiresAt = Math.floor((now + LIFETIME_MS) / 1000) * 1000;
  const authorization = webpush.getVapidHeaders(audience, identity.subject, identity.publicKey, identity.privateKey, "aes128gcm", expiresAt / 1000).Authorization;
  // An atomic upsert elects one winner when concurrent isolates see a miss or
  // expiry. The losers read that winner, never send their freshly signed tokens.
  const claimed = await db.prepare(`INSERT INTO push_vapid_tokens
    (public_key, audience, subject, authorization, refresh_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (public_key, audience, subject) DO UPDATE SET
      authorization = excluded.authorization, refresh_at = excluded.refresh_at, expires_at = excluded.expires_at
    WHERE push_vapid_tokens.refresh_at <= ?
    RETURNING authorization, refresh_at AS refreshAt, expires_at AS expiresAt`)
    .bind(...keys, authorization, now + REUSE_MS, expiresAt, now).first<CachedToken>();
  const winner = claimed ?? await db.prepare(`SELECT authorization, refresh_at AS refreshAt, expires_at AS expiresAt
    FROM push_vapid_tokens WHERE public_key = ? AND audience = ? AND subject = ?`).bind(...keys).first<CachedToken>();
  // Fail closed if storage or the clock is inconsistent, instead of bypassing
  // the shared cache with a token that could trigger provider rate limiting.
  if (!winner || winner.refreshAt <= now || winner.expiresAt <= deliveryAt + DELIVERY_MARGIN_MS) throw new Error("VAPID authorization is unavailable.");
  return winner.authorization;
}
