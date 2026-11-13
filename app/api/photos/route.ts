import { getChatGPTUser } from "../../chatgpt-auth";
import { deletePhoto, ownedPhoto, ownedWorkout, photoRecord, privateJson, sameOrigin, uploadPhoto } from "../../../lib/photo-service";
export const dynamic = "force-dynamic";

async function handle(request: Request, method: "GET" | "POST" | "DELETE") {
  const user = await getChatGPTUser();
  if (!user) return privateJson({ error: "Sign in to access session photos." }, 401);
  if (method !== "GET" && !sameOrigin(request)) return privateJson({ error: "Use Repbook to change your photos." }, 403);
  const workoutId = new URL(request.url).searchParams.get("workoutId");
  if (!workoutId || workoutId.length > 100) return privateJson({ error: "Choose a workout." }, 400);
  try {
    if (method === "POST") return await uploadPhoto(request, user.userId, workoutId);
    if (method === "DELETE") return await deletePhoto(request, user.userId, workoutId);
    if (!await ownedWorkout(user.userId, workoutId)) return privateJson({ error: "Workout not found." }, 404);
    const photo = await ownedPhoto(user.userId, workoutId);
    return privateJson({ photo: photo ? photoRecord(photo) : null });
  } catch { return privateJson({ error: "Session photos are unavailable. Please retry." }, 503); }
}
export const GET = (request: Request) => handle(request, "GET");
export const POST = (request: Request) => handle(request, "POST");
export const DELETE = (request: Request) => handle(request, "DELETE");
