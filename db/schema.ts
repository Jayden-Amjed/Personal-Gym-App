import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** A versioned journal per authenticated user; revisions prevent lost updates. */
export const journals = sqliteTable("journals", {
  userId: text("user_id").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});
