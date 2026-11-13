import type { Workout } from "./model";
import { getWorkedMuscles, type Muscle } from "./training";
import { sessionOverlaySvg } from "./muscle-map";

export type SessionPhotoRecord = {
  id: string;
  workoutId: string;
  date: string;
  routine: string;
  createdAt: string;
  url: string;
  originalUrl: string;
  muscles: string[];
};

export type PreparedSessionPhoto = { original: Blob; composite: Blob; muscles: Muscle[]; context: string; width: number; height: number };
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4_000_000;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 2000;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This photo format could not be opened. Choose a JPEG, PNG, or WebP photo, or export the photo as JPEG first.")); };
    image.src = url;
  });
}

async function jpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const quality of [.88, .78, .66]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("The photo could not be prepared. Try a smaller image.");
    if (blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error("The prepared photo is too large. Please choose a smaller image.");
}

/** Draw the original pixels without cropping, then add a deterministic workout card. */
export async function prepareSessionPhoto(file: File, workout: Workout): Promise<PreparedSessionPhoto> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error("Choose a photo smaller than 25 MB.");
  if (file.type && !file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (!workout.finishedAt) throw new Error("Finish the workout before adding its session photo.");
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_PIXELS || Math.max(image.naturalWidth, image.naturalHeight) > 12000) {
    throw new Error("Choose a photo up to 40 megapixels. Panoramas may need resizing first.");
  }
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo editing is unavailable in this browser.");
  context.fillStyle = "#111111";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  // Re-encoding strips camera metadata, including location, from both uploads.
  const original = await jpeg(canvas);
  const muscles = getWorkedMuscles(workout);
  const overlay = await loadImage(new Blob([sessionOverlaySvg(muscles, workout.routine, workout.date)], { type: "image/svg+xml" }));
  const margin = Math.round(Math.min(width, height) * .025);
  const overlayWidth = Math.min(width * .32, height * .52 * (640 / 286), 640);
  context.drawImage(overlay, margin, margin, overlayWidth, overlayWidth * 286 / 640);
  const composite = await jpeg(canvas);
  canvas.width = canvas.height = 1;
  const photoContext = JSON.stringify({ workoutId: workout.id, date: workout.date, routine: workout.routine, muscles });
  return { original, composite, muscles, context: photoContext, width, height };
}

export function uploadSessionPhoto(workoutId: string, prepared: PreparedSessionPhoto, previousId: string | null, onProgress: (percent: number) => void, signal: AbortSignal): Promise<SessionPhotoRecord> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = () => signal.removeEventListener("abort", abort);
    request.open("POST", `/api/photos?workoutId=${encodeURIComponent(workoutId)}`);
    request.timeout = 90_000;
    request.setRequestHeader(previousId ? "If-Match" : "If-None-Match", previousId ?? "*");
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      finish();
      let payload: { photo?: SessionPhotoRecord; error?: string } = {};
      try { payload = JSON.parse(request.responseText); } catch { /* Return the status-specific message below. */ }
      if (request.status >= 200 && request.status < 300 && payload.photo) resolve(payload.photo);
      else reject(Object.assign(new Error(payload.error || "Your photo could not be saved. Your prepared photo is still here; try again."), { status: request.status }));
    };
    request.onerror = () => { finish(); reject(new Error("The upload lost its connection. Your prepared photo is still here; retry when connected.")); };
    request.ontimeout = () => { finish(); reject(new Error("The upload timed out. Your prepared photo is still here; try again.")); };
    request.onabort = () => { finish(); reject(new DOMException("Photo upload cancelled.", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { finish(); reject(new DOMException("Photo upload cancelled.", "AbortError")); return; }
    const form = new FormData();
    form.append("original", prepared.original, "original.jpg");
    form.append("composite", prepared.composite, "session.jpg");
    form.append("context", prepared.context);
    request.send(form);
  });
}
