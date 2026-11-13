export type RestTimerInput = {
  workoutId: string;
  exerciseId: string;
  setId: string;
  exerciseName: string;
  seconds: number;
};

export type RestTimerRecord = Omit<RestTimerInput, "seconds"> & {
  version: 1;
  id: string;
  startedAt: number;
  endsAt: number;
  alertedAt?: number;
};

const MAX_REST_SECONDS = 3_600;
const MAX_TIMER_AGE_MS = 24 * 60 * 60 * 1_000;
const validLabel = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const validTime = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function createRestTimer(input: RestTimerInput, now = Date.now(), id: string = crypto.randomUUID()): RestTimerRecord {
  if (!validTime(now) || !validLabel(id) || !validLabel(input.workoutId) || !validLabel(input.exerciseId) || !validLabel(input.setId) || !validLabel(input.exerciseName)) {
    throw new Error("This set is missing the information needed for a rest timer.");
  }
  if (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > MAX_REST_SECONDS) {
    throw new Error("Choose a rest time between 1 second and 60 minutes.");
  }
  return {
    version: 1, id, workoutId: input.workoutId, exerciseId: input.exerciseId,
    setId: input.setId, exerciseName: input.exerciseName,
    startedAt: now, endsAt: now + input.seconds * 1_000,
  };
}

/** Only accepts a short-lived timer, never arbitrary journal or recovery data. */
export function parseRestTimer(raw: string | null, now = Date.now()): RestTimerRecord | null {
  if (!raw || raw.length > 3_000) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || value.version !== 1 || !validLabel(value.id) || !validLabel(value.workoutId) || !validLabel(value.exerciseId) || !validLabel(value.setId) || !validLabel(value.exerciseName)) return null;
    if (!validTime(value.startedAt) || !validTime(value.endsAt) || value.endsAt <= value.startedAt || value.endsAt - value.startedAt > MAX_REST_SECONDS * 1_000) return null;
    if (now - value.endsAt > MAX_TIMER_AGE_MS || value.startedAt - now > 5 * 60 * 1_000) return null;
    if (value.alertedAt !== undefined && (!validTime(value.alertedAt) || value.alertedAt < value.endsAt)) return null;
    return {
      version: 1, id: value.id, workoutId: value.workoutId, exerciseId: value.exerciseId,
      setId: value.setId, exerciseName: value.exerciseName,
      startedAt: value.startedAt, endsAt: value.endsAt,
      ...(value.alertedAt === undefined ? {} : { alertedAt: value.alertedAt as number }),
    };
  } catch { return null; }
}

export function remainingRestSeconds(timer: RestTimerRecord | null, now = Date.now()): number {
  return timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1_000)) : 0;
}

export function formatRestTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

/** Late/resumed alerts update the screen without pretending they fired on time. */
export function restAlertMode(timer: RestTimerRecord | null, now = Date.now(), resumed = false): "none" | "wait" | "on-time" | "catch-up" {
  if (!timer || timer.alertedAt !== undefined) return "none";
  if (now < timer.endsAt) return "wait";
  return resumed || now - timer.endsAt > 2_000 ? "catch-up" : "on-time";
}
