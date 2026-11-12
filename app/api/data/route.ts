import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db/index";
import { journals } from "../../../db/schema";
import { newState, StateSchema, validateState } from "../../../lib/model";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1_500_000;
const Envelope = z.object({ revision: z.number().int().min(0).max(2147483646), state: StateSchema }).strict();
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in to load your journal." }, 401);
  try {
    const row = await getDb().select().from(journals).where(eq(journals.userId, user.userId)).get();
    return row ? json({ state: validateState(JSON.parse(row.state)), revision: row.revision }) : json({ state: newState(), revision: 0 });
  } catch {
    return json({ error: "Your journal could not be loaded. Please retry; saved data has not been changed." }, 503);
  }
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0, result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in to save your journal." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "This request must come from the app." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Send a JSON journal." }, 415);

  let body: z.infer<typeof Envelope>;
  try {
    const raw = await readBoundedBody(request);
    if (raw === null) return json({ error: "This journal is too large to save. Export a backup and contact the app maintainer." }, 413);
    const parsed = Envelope.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: "Some entries are invalid. Check dates, positive rep counts, and nonnegative weights and nutrients.", issues: parsed.error.issues.slice(0, 5).map(issue => ({ path: issue.path.join("."), message: issue.message })) }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "The save request was not valid JSON." }, 400);
  }

  try {
    const db = getDb();
    const nextRevision = body.revision + 1;
    const values = { state: JSON.stringify(body.state), revision: nextRevision, updatedAt: new Date().toISOString() };
    // Atomic insert/update predicates scope every write to the signed-in user.
    const changed = body.revision === 0
      ? await db.insert(journals).values({ userId: user.userId, ...values }).onConflictDoNothing().returning({ revision: journals.revision })
      : await db.update(journals).set(values).where(and(eq(journals.userId, user.userId), eq(journals.revision, body.revision))).returning({ revision: journals.revision });
    if (changed.length === 0) return json({ error: "Your journal changed in another window or device. Export your unsynced entries before reloading the latest journal.", conflict: true }, 409);
    return json({ revision: nextRevision });
  } catch {
    return json({ error: "Your changes could not be saved. Keep this window open and retry." }, 503);
  }
}
