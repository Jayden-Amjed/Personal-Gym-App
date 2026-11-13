"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Timer, Volume2, VolumeX, X } from "lucide-react";
import { createRestTimer, formatRestTime, parseRestTimer, remainingRestSeconds, restAlertMode, type RestTimerInput, type RestTimerRecord } from "../lib/rest-timer";

type VoiceStatus = "off" | "testing" | "ready" | "unavailable";

/** This is a foreground timer. No service-worker timeout or push is implied. */
export function useRestTimer(userId: string) {
  const storageKey = `repbook-rest:v1:${userId}`;
  const [timer, setTimer] = useState<RestTimerRecord | null>(null);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("off");
  const [voiceMessage, setVoiceMessage] = useState("");
  const current = useRef<RestTimerRecord | null>(null);
  const localOnly = useRef(false);
  const mountedKey = useRef<string | null>(null);
  const voiceEnabled = useRef(false);
  const voiceAttempt = useRef(0);
  const voiceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checking = useRef(false);
  const pushScheduled = useRef<string | null>(null);
  const journalVerified = useRef(false);
  const setJournalVerified = useCallback((value: boolean) => { journalVerified.current = value; }, []);
  const setPushScheduled = useCallback((timerId: string | null) => { pushScheduled.current = timerId; }, []);

  const clearVoiceTimeout = useCallback(() => {
    if (voiceTimeout.current) clearTimeout(voiceTimeout.current);
    voiceTimeout.current = null;
  }, []);

  const disableVoice = useCallback(() => {
    voiceAttempt.current += 1;
    voiceEnabled.current = false;
    clearVoiceTimeout();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoiceStatus("off");
    setVoiceMessage("");
  }, [clearVoiceTimeout]);

  const speak = useCallback((message: string, isTest = false) => {
    if (!isTest && !voiceEnabled.current) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setVoiceStatus("unavailable");
      setVoiceMessage("This browser does not provide spoken alerts. The countdown still works.");
      return;
    }
    // Do not select a remote speech provider: this feature needs no AI service.
    const voice = window.speechSynthesis.getVoices().find(item => item.localService && /^en(?:-|$)/i.test(item.lang));
    if (!voice) {
      voiceEnabled.current = false;
      setVoiceStatus("unavailable");
      setVoiceMessage("No on-device English voice is available yet. Try Enable voice again after your device voices load.");
      return;
    }
    const attempt = ++voiceAttempt.current;
    clearVoiceTimeout();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1;
    if (isTest) setVoiceStatus("testing");
    utterance.onstart = () => {
      if (voiceAttempt.current !== attempt) return;
      clearVoiceTimeout();
      voiceEnabled.current = true;
      setVoiceStatus("ready");
      setVoiceMessage("");
    };
    utterance.onerror = () => {
      if (voiceAttempt.current !== attempt) return;
      clearVoiceTimeout();
      voiceEnabled.current = false;
      setVoiceStatus("unavailable");
      setVoiceMessage("The voice alert could not play. Check your audio output and tap Enable voice to try again.");
    };
    voiceTimeout.current = setTimeout(() => {
      if (voiceAttempt.current !== attempt) return;
      voiceEnabled.current = false;
      setVoiceStatus("unavailable");
      setVoiceMessage("The voice alert did not start. Check your audio output and try Enable voice again.");
    }, 5_000);
    // The speak call is synchronous with the Enable voice gesture on iPhone.
    window.speechSynthesis.speak(utterance);
  }, [clearVoiceTimeout]);

  const enableVoice = useCallback(() => speak("Repbook voice alerts are on.", true), [speak]);

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
    disableVoice();
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
        // Persist the claim before speaking, so a second tab/reload stays quiet.
        save({ ...latest, alertedAt: instant });
        setNotice(caughtUp ? "Rest ended while Repbook was away. You're ready for your next set." : "You're ready for your next set!");
        if (!caughtUp && pushScheduled.current !== latest.id) speak("Repbook says: you're ready for your next set!");
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
      disableVoice();
    };
  }, [disableVoice, readShared, save, show, speak, storageKey, withLock]);

  return {
    timer, ready, remainingSeconds: remainingRestSeconds(timer, now), notice, storageWarning,
    voiceStatus, voiceMessage, start, cancel, cancelForSet, enableVoice, disableVoice, setPushScheduled, setJournalVerified,
  };
}

export type RestTimerController = ReturnType<typeof useRestTimer>;

export function RestTimer({ controller, backgroundScheduled = false }: { controller: RestTimerController; backgroundScheduled?: boolean }) {
  const { timer, remainingSeconds, notice, storageWarning, voiceStatus, voiceMessage, cancel, enableVoice, disableVoice } = controller;
  const voiceReady = voiceStatus === "ready";
  return <section className="panel rest-timer" aria-label="Automatic rest timer">
    <div className="rest-timer-main">
      <Timer size={21} className="orange" />
      <div className="rest-timer-copy"><h3>{timer ? (remainingSeconds > 0 ? "Rest between sets" : "Rest complete") : "Automatic rest timer"}</h3><p>{timer?.exerciseName ?? "Starts when you log a new set."}</p></div>
      {timer && <strong className="rest-timer-count" role="timer" aria-label={`${remainingSeconds} seconds of rest remaining`}>{formatRestTime(remainingSeconds)}</strong>}
      {timer && <button type="button" className="icon-button" aria-label="Dismiss rest timer" onClick={() => void cancel()}><X size={18} /></button>}
    </div>
    <div className="rest-timer-controls">
      <button type="button" className="button secondary" onClick={voiceReady ? disableVoice : enableVoice} disabled={voiceStatus === "testing"}>{voiceReady ? <VolumeX size={15} /> : <Volume2 size={15} />}{voiceReady ? "Mute voice" : voiceStatus === "testing" ? "Testing voice…" : "Enable voice"}</button>
      {voiceReady && <button type="button" className="text-button" onClick={enableVoice}>Test voice</button>}
      <span className="muted">{backgroundScheduled ? "Notification scheduled · in-app voice paused for this set" : voiceReady ? "Voice on · your current audio output" : "Enable voice once each time you reopen Repbook."}</span>
    </div>
    {notice && <p className="rest-timer-notice" role="status">{notice}</p>}
    {voiceMessage && <p className="rest-timer-warning" role="status">{voiceMessage}</p>}
    {storageWarning && <p className="rest-timer-warning" role="status">{storageWarning}</p>}
    <p className="rest-timer-limit">{backgroundScheduled ? "A notification is scheduled for this set. Delivery depends on your connection and notification settings." : "Keep Repbook open for this alert. A locked-screen alert isn't scheduled for this set."}</p>
  </section>;
}
