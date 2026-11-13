import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db/index";
import { sessionPhotos } from "../../../../db/schema";
import { ownedWorkout, privateJson } from "../../../../lib/photo-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ error: "Sign in to view this photo." }, 401);
  try {
    const { id } = await context.params;
    const row = await getDb().select().from(sessionPhotos).where(and(eq(sessionPhotos.id, id), eq(sessionPhotos.userId, user.userId))).get();
    if (!row || row.deletedAt || !await ownedWorkout(user.userId, row.workoutId)) return privateJson({ error: "Photo not found." }, 404);
    if (!env.BUCKET) return privateJson({ error: "Photo storage is unavailable." }, 503);
    const original = new URL(request.url).searchParams.get("variant") === "original";
    const file = await env.BUCKET.get(original ? row.originalKey : row.compositeKey);
    if (!file) return privateJson({ error: "Photo not found." }, 404);
    return new Response(file.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename="repbook-${row.routine.toLowerCase()}-${row.date}${original ? "-original" : ""}.jpg"` } });
  } catch { return privateJson({ error: "Photo could not load. Please retry." }, 503); }
}
