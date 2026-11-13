"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { RestTimerRecord } from "../lib/rest-timer";

type Config = { configured: boolean; publicKey: string | null; subscribed: boolean };
const isId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);

function applicationKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function supportMessage() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "Add Repbook to your Home Screen, then open it there to enable notifications.";
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "This browser does not support these notifications. The open-app timer still works.";
  return "";
}

/** Schedules only persisted sets. It never starts a notification permission prompt. */
export function usePushAlerts(userId: string, timer: RestTimerRecord | null, journalSaved: boolean) {
  const key = `repbook-push:v1:${userId}`;
  const [config, setConfig] = useState<Config | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [support, setSupport] = useState("");
  const [workerReady, setWorkerReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduledTimerId, setScheduledTimerId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [retry, setRetry] = useState(0);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const desired = useRef(timer);
  desired.current = timer;
  const activeKey = useRef<string | null>(null);
  const previousTimer = useRef<string | null>(null);
  const pendingCancels = useRef(new Set<string>());
  const cancelRequests = useRef(new Map<string, Promise<boolean>>());
  const sequence = useRef(0);

  const persistCancels = useCallback(() => {
    try { localStorage.setItem(`${key}:cancel`, JSON.stringify([...pendingCancels.current].slice(-100))); }
    catch { setError("A cancellation could not be kept for retry. Keep Repbook open until it reconnects."); }
  }, [key]);

  const cancelTimer = useCallback((timerId: string): Promise<boolean> => {
    pendingCancels.current.add(timerId);
    persistCancels();
    const existing = cancelRequests.current.get(timerId);
    if (existing) return existing;
    if (!deviceId || !config?.configured) return Promise.resolve(false);
    const operation = (async () => {
      try {
        const response = await fetch("/api/rest-alerts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", deviceId, timerId }),
          keepalive: true,
        });
        if (!response.ok) throw new Error("A previous alert could not be canceled. It may still arrive; cancellation will retry when connected.");
        if (activeKey.current !== key) return false;
        pendingCancels.current.delete(timerId);
        persistCancels();
        return true;
      } catch (cause) {
        if (activeKey.current === key) setError(cause instanceof Error ? cause.message : "An alert could not be canceled. Reconnect to retry.");
        return false;
      } finally { cancelRequests.current.delete(timerId); }
    })();
    cancelRequests.current.set(timerId, operation);
    return operation;
  }, [config?.configured, deviceId, key, persistCancels]);

  useEffect(() => {
    activeKey.current = key;
    previousTimer.current = null;
    pendingCancels.current = new Set();
    registration.current = null;
    setConfig(null); setDeviceId(null); setWorkerReady(false); setScheduledTimerId(null);
    setError(""); setNotice(""); setBusy(false);
    const abort = new AbortController();
    let disposed = false;
    const limitation = supportMessage();
    setSupport(limitation); setSupported(!limitation);
    let id: string;
    try {
      const stored = localStorage.getItem(`${key}:device`);
      id = stored && /^[A-Za-z0-9_-]{8,100}$/.test(stored) ? stored : crypto.randomUUID();
      localStorage.setItem(`${key}:device`, id);
      const pending: unknown = JSON.parse(localStorage.getItem(`${key}:cancel`) ?? "[]");
      if (Array.isArray(pending)) pendingCancels.current = new Set(pending.filter(isId).slice(-100));
      setDeviceId(id);
    } catch {
      setSupport("Notifications need browser storage. Check your privacy settings; the open-app timer still works.");
      setSupported(false);
      setError("Notifications need browser storage. Check your privacy settings and retry.");
      return () => { activeKey.current = null; };
    }
    const setup = async () => {
      try {
        const response = await fetch(`/api/rest-alerts?deviceId=${encodeURIComponent(id)}`, { cache: "no-store", signal: abort.signal });
        const payload = await responseBody(response);
        if (!response.ok) throw new Error("Notification settings could not load. Reconnect and try again.");
        const next: Config = { configured: payload.configured === true, publicKey: typeof payload.publicKey === "string" ? payload.publicKey : null, subscribed: payload.subscribed === true };
        if (disposed) return;
        setConfig({ ...next, subscribed: false });
        if (!next.configured || limitation) return;
        // Preparation runs before the button is enabled; subscribe itself must
        // run immediately inside the user's later click handler on iPhone.
        await navigator.serviceWorker.register("/sw.js");
        const readyWorker = await navigator.serviceWorker.ready;
        const subscription = await readyWorker.pushManager.getSubscription();
        if (disposed) return;
        registration.current = readyWorker;
        setWorkerReady(true);
        setConfig({ ...next, subscribed: Boolean(next.subscribed && subscription && Notification.permission === "granted") });
      } catch (cause) {
        if (!disposed && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Notification setup could not load.");
      }
    };
    void setup();
    return () => { disposed = true; activeKey.current = null; abort.abort(); };
  }, [key, retry]);

  const enable = useCallback(async () => {
    const worker = registration.current;
    if (!config?.configured || !config.publicKey || !worker || !deviceId || !supported) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // No await precedes this call: the permission request belongs to the tap.
      const subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) });
      const data = subscription.toJSON();
      if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) throw new Error("The browser did not return a complete notification subscription.");
      const response = await fetch("/api/rest-alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", deviceId, subscription: { endpoint: data.endpoint, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth } } }),
      });
      if (!response.ok) throw new Error("Notifications could not be enabled. Keep Repbook open and try again.");
      if (activeKey.current !== key) return;
      setConfig(value => value ? { ...value, subscribed: true } : value);
      setNotice("Notifications enabled for this device. New saved sets will schedule rest alerts.");
    } catch (cause) {
      if (activeKey.current === key) setError(typeof Notification !== "undefined" && Notification.permission === "denied" ? "Notifications are blocked. Allow Repbook notifications in your device settings, then retry." : cause instanceof Error ? cause.message : "Notifications could not be enabled.");
    } finally { if (activeKey.current === key) setBusy(false); }
  }, [config, deviceId, key, supported]);

  const disable = useCallback(async () => {
    if (!deviceId) return;
    setBusy(true); setError(""); setNotice("");
    const currentId = desired.current?.id;
    if (currentId) await cancelTimer(currentId);
    try {
      const response = await fetch("/api/rest-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsubscribe", deviceId }) });
      if (!response.ok) throw new Error("Notifications could not be disabled yet. Reconnect and retry; an existing alert may still arrive.");
      if (activeKey.current !== key) return;
      setConfig(value => value ? { ...value, subscribed: false } : value);
      setScheduledTimerId(null);
      setNotice("Rest notifications are off for this device.");
      // Server-side removal is sufficient. Retain the browser subscription so
      // notification permission and other signed-in identities are untouched.
    } catch (cause) {
      if (activeKey.current === key) setError(cause instanceof Error ? cause.message : "Notifications could not be disabled.");
    } finally { if (activeKey.current === key) setBusy(false); }
  }, [cancelTimer, deviceId, key]);

  useEffect(() => {
    const oldId = previousTimer.current;
    const newId = timer?.id ?? null;
    previousTimer.current = newId;
    if (oldId && oldId !== newId) {
      setScheduledTimerId(null);
      void cancelTimer(oldId);
    }
  }, [cancelTimer, timer?.id]);

  useEffect(() => {
    if (!config?.configured || !deviceId) return;
    const retryCancellation = () => { for (const id of pendingCancels.current) void cancelTimer(id); };
    retryCancellation();
    window.addEventListener("online", retryCancellation);
    return () => window.removeEventListener("online", retryCancellation);
  }, [cancelTimer, config?.configured, deviceId]);

  const timerId = timer?.id;
  const workoutId = timer?.workoutId;
  const setId = timer?.setId;
  const endsAt = timer?.endsAt;
  useEffect(() => {
    if (!config?.configured || !config.subscribed || !supported || !deviceId || !journalSaved || !timerId || !workoutId || !setId || !endsAt || endsAt <= Date.now() || pendingCancels.current.has(timerId)) return;
    const abort = new AbortController();
    const requestSequence = ++sequence.current;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    const currentRequest = () => !abort.signal.aborted && activeKey.current === key && desired.current?.id === timerId && requestSequence === sequence.current;
    const schedule = async (attempt = 0) => {
      retryTimeout = undefined;
      setScheduling(true);
      try {
        const response = await fetch("/api/rest-alerts", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ action: "schedule", deviceId, timer: { id: timerId, workoutId, setId, endsAt } }),
        });
        const payload = await responseBody(response);
        if (!currentRequest()) return;
        if (response.status === 409 && attempt < 3 && endsAt - Date.now() > 2_000) {
          retryTimeout = setTimeout(() => void schedule(attempt + 1), 500 * (attempt + 1));
          return;
        }
        if (!response.ok || payload.scheduled !== true || payload.timerId !== timerId) throw new Error("The locked-screen alert could not be scheduled. Keep Repbook open for this set's timer.");
        setScheduledTimerId(timerId);
        if (!pendingCancels.current.size) setError("");
      } catch (cause) {
        if (currentRequest()) { setScheduledTimerId(null); setError(cause instanceof Error ? cause.message : "The alert could not be scheduled. Keep Repbook open."); }
      } finally { if (currentRequest() && !retryTimeout) setScheduling(false); }
    };
    void schedule();
    return () => { abort.abort(); if (retryTimeout) clearTimeout(retryTimeout); setScheduling(false); };
  }, [config?.configured, config?.subscribed, deviceId, endsAt, journalSaved, key, setId, supported, timerId, workoutId]);

  const backgroundScheduled = Boolean(timerId && scheduledTimerId === timerId);
  return {
    configured: config?.configured ?? false, checked: config !== null, loading: config === null && !error, subscribed: config?.subscribed ?? false,
    supported, support, workerReady, busy, error, notice, scheduling, backgroundScheduled,
    scheduledTimerId: backgroundScheduled ? scheduledTimerId : null,
    enable, disable, retry: () => setRetry(value => value + 1),
  };
}

export type RestPushController = ReturnType<typeof usePushAlerts>;

export function RestPushSettings({ controller }: { controller: RestPushController }) {
  const { configured, checked, loading, subscribed, supported, support, workerReady, busy, error, notice, scheduling, backgroundScheduled, enable, disable, retry } = controller;
  return <section className="panel rest-push-settings" aria-label="Rest notification settings">
    <div className="section-heading"><div><h3>Rest notifications</h3><p>Get a reminder when it's time for your next set.</p></div><Bell size={19} /></div>
    {loading ? <p className="muted">Checking notification setup…</p> : !checked ? <p className="rest-timer-limit">Notification settings are unavailable right now.</p> : !configured ? <p className="rest-timer-limit">Locked-screen alerts need service setup. The open-app timer still works.</p> : !supported ? <p className="rest-timer-limit">{support}</p> : <>
      <button type="button" className="button secondary" disabled={busy || !workerReady} onClick={() => void (subscribed ? disable() : enable())}>{subscribed ? <BellOff size={15} /> : <Bell size={15} />}{busy ? "Updating…" : subscribed ? "Turn off notifications" : "Enable notifications"}</button>
      {subscribed && <p className="rest-timer-limit">{backgroundScheduled ? "Notification scheduled for the current set." : scheduling ? "Scheduling this set's notification…" : "Notifications are on. An alert is scheduled after each new set saves."}</p>}
    </>}
    {notice && <p className="rest-timer-notice" role="status">{notice}</p>}
    {error && <p className="rest-timer-warning" role="status">{error} <button type="button" className="text-button" onClick={retry}>Retry</button></p>}
  </section>;
}
