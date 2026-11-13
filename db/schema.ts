import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** A versioned journal per authenticated user; revisions prevent lost updates. */
export const journals = sqliteTable("journals", {
  userId: text("user_id").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Private file metadata; image bytes live in the authenticated R2 bucket. */
export const sessionPhotos = sqliteTable("session_photos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workoutId: text("workout_id").notNull(),
  date: text("date").notNull(),
  routine: text("routine").notNull(),
  muscles: text("muscles").notNull(),
  originalKey: text("original_key").notNull(),
  compositeKey: text("composite_key").notNull(),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
}, table => [uniqueIndex("session_photos_user_workout").on(table.userId, table.workoutId)]);

export { pushSubscriptions, pushTimers } from "./push-schema";
