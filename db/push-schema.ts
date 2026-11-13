import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Private browser subscription and the newest set allowed to claim this device. */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  subscription: text("subscription"),
  activeTimerId: text("active_timer_id"),
  latestSetAt: integer("latest_set_at").notNull().default(0),
  latestSequence: integer("latest_sequence").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.deviceId] })]);

/** Cancellation tombstones prevent a delayed schedule request reviving a timer. */
export const pushTimers = sqliteTable("push_timers", {
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  timerId: text("timer_id").notNull(),
  status: text("status").notNull(),
  messageId: text("message_id"),
  operationId: text("operation_id"),
  endsAt: integer("ends_at").notNull().default(0),
  setAt: integer("set_at").notNull().default(0),
  setSequence: integer("set_sequence").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.deviceId, table.timerId] })]);

/** Shared expiring VAPID authorization; never stores the signing private key. */
export const vapidTokens = sqliteTable("push_vapid_tokens", {
  publicKey: text("public_key").notNull(),
  audience: text("audience").notNull(),
  subject: text("subject").notNull(),
  authorization: text("authorization").notNull(),
  refreshAt: integer("refresh_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [primaryKey({ columns: [table.publicKey, table.audience, table.subject] })]);
