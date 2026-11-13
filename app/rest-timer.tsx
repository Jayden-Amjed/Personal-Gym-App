"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";
import { createRestTimer, formatRestTime, parseRestTimer, remainingRestSeconds, restAlertMode, type RestTimerInput, type RestTimerRecord } from "../lib/rest-timer";

/** This is a foreground timer. No service-worker timeout or push is implied. */
export function useRestTimer(userId: string) {
  const storageKey = `repbook-rest:v1:${userId}`;
  const [timer, setTimer] = useState<RestTimerRecord | null>(null);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const current = useRef<RestTimerRecord | null>(null);
  const localOnly = useRef(false);
  const mountedKey = useRef<string | null>(null);
  const checking = useRef(false);
  const journalVerified = useRef(false);
  const setJournalVerified = useCallback((value: boolean) => { journalVerified.current = value; }, []);

  const readShared = useCallback(() => {
    if (localOnly.current) return current.current;
    try {
      return parseRestTimer(localStorage.getItem(storageKey));
    } catch {
      localOnly.current = true;
      setStorageWarning("Timer storage is unavailable. This timer stays in this window only.");
      return current.current;
    }
  }, [storageKey]);

  const show = useCallback((value: RestTimerRecord | null) => {
    current.current = value;
    setTimer(value);
    setNow(Date.now());
  }, []);

  const save = useCallback((value: RestTimerRecord | null) => {
    show(value);
    try {
      if (value) localStorage.setItem(storageKey, JSON.stringify(value));
      else localStorage.removeItem(storageKey);
      localOnly.current = false;
      setStorageWarning("");
    } catch {
      localOnly.current = true;
      setStorageWarning("Timer storage is unavailable. This timer stays in this window only.");
    }
  }, [show, storageKey]);

  // All cooperating tabs use the same lock for start, cancel and expiry claims.
  // Browsers without Web Locks retain best-effort localStorage coordination.
  const withLock = useCallback(async (action: () => void) => {
    try {
      const run = () => { if (mountedKey.current === storageKey) action(); };
      if (navigator.locks?.request) await navigator.locks.request(storageKey, run);
      else run();
    } catch {
      setNotice("The timer could not update. Keep Repbook open and try again.");
    }
  }, [storageKey]);

  const start = useCallback(async (input: RestTimerInput) => {
    try {
      const next = createRestTimer(input);
      await withLock(() => { save(next); setNotice(""); });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The rest timer could not start.");
    }
  }, [save, withLock]);

  const cancel = useCallback(async (workoutId?: string) => {
    await withLock(() => {
      const latest = readShared();
      if (workoutId && latest?.workoutId !== workoutId) return;
      save(null);
      setNotice("");
    });
  }, [readShared, save, withLock]);

  const cancelForSet = useCallback(async (setId: string) => {
    await withLock(() => {
      if (readShared()?.setId !== setId) return;
      save(null);
      setNotice("");
    });
  }, [readShared, save, withLock]);

  useEffect(() => {
    mountedKey.current = storageKey;
    current.current = null;
    localOnly.current = false;
    setReady(false);
    setNotice("");
    show(readShared());
    setReady(true);
    let disposed = false;
    let resumed = true;
    const tick = () => {
      if (disposed || document.visibilityState !== "visible" || !journalVerified.current) return;
      const currentTimer = current.current;
      if (!currentTimer) return;
      const instant = Date.now();
      setNow(previous => remainingRestSeconds(currentTimer, previous) === remainingRestSeconds(currentTimer, instant) ? previous : instant);
      const mode = restAlertMode(currentTimer, instant, resumed);
      resumed = false;
      if (mode === "none" || mode === "wait" || checking.current || !currentTimer) return;
      checking.current = true;
      void withLock(() => {
        const latest = readShared();
        const instant = Date.now();
        if (disposed || document.visibilityState !== "visible" || latest?.id !== currentTimer.id || !["on-time", "catch-up"].includes(restAlertMode(latest, instant))) return;
        const caughtUp = mode === "catch-up" || restAlertMode(latest, instant) === "catch-up";
        // Persist the claim before showing the notice, so another tab/reload
        // does not repeat the completion alert.
        save({ ...latest, alertedAt: instant });
        setNotice(caughtUp ? "Rest ended while Repbook was away. You're ready for your next set." : "You're ready for your next set!");
      }).finally(() => { checking.current = false; });
    };
    const resume = () => { resumed = true; tick(); };
    const receive = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      show(readShared());
      setNotice("");
      tick();
    };
    tick();
    const interval = setInterval(tick, 500);
    window.addEventListener("storage", receive);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      mountedKey.current = null;
      clearInterval(interval);
      window.removeEventListener("storage", receive);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [readShared, save, show, storageKey, withLock]);

  return {
    timer, ready, remainingSeconds: remainingRestSeconds(timer, now), notice, storageWarning,
    start, cancel, cancelForSet, setJournalVerified,
  };
}

export type RestTimerController = ReturnType<typeof useRestTimer>;

export function RestTimer({ controller, backgroundScheduled = false, inline = false }: { controller: RestTimerController; backgroundScheduled?: boolean; inline?: boolean }) {
  const { timer, remainingSeconds, notice, storageWarning, cancel } = controller;
  return <section className={inline ? "rest-timer rest-timer-inline" : "panel rest-timer"} aria-label={inline && timer ? `Rest timer for ${timer.exerciseName}` : "Automatic rest timer"}>
    <div className="rest-timer-main">
      <Timer size={inline ? 18 : 21} className="orange" />
      <div className="rest-timer-copy"><h3>{timer ? (remainingSeconds > 0 ? "Rest between sets" : "Rest complete") : "Automatic rest timer"}</h3>{!inline && <p>{timer?.exerciseName ?? "Starts when you log a new set."}</p>}</div>
      {timer && <strong className="rest-timer-count" role="timer" aria-label={`${remainingSeconds} seconds of rest remaining`}>{formatRestTime(remainingSeconds)}</strong>}
      {timer && <button type="button" className="icon-button" aria-label="Dismiss rest timer" onClick={() => void cancel()}><X size={18} /></button>}
    </div>
    {notice && <p className="rest-timer-notice" role="status">{notice}</p>}
    {storageWarning && <p className="rest-timer-warning" role="status">{storageWarning}</p>}
    <p className="rest-timer-limit">{backgroundScheduled ? "Notification scheduled for this set." : "A locked-screen alert isn't scheduled for this set. Keep Repbook open to follow the countdown."}</p>
  </section>;
}
