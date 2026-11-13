"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ArrowDownToLine, Trash2, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { Workout } from "../lib/model";
import { getWorkedMuscles, MUSCLE_LABELS, type Muscle } from "../lib/training";
import { prepareSessionPhoto, uploadSessionPhoto, type PreparedSessionPhoto, type SessionPhotoRecord } from "../lib/session-photo";

export default function SessionPhoto({ workout, journalSaved }: { workout: Workout; journalSaved: boolean }) {
  const [photo, setPhoto] = useState<SessionPhotoRecord | null>(null);
  const [prepared, setPrepared] = useState<PreparedSessionPhoto | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState<"loading" | "preparing" | "saving" | "deleting" | null>("loading");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const endpoint = `/api/photos?workoutId=${encodeURIComponent(workout.id)}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const payload = await response.json().catch(() => ({})) as { error?: string; photo?: SessionPhotoRecord | null };
    if (!response.ok) throw new Error(payload.error || "The session photo could not load. Try again.");
    setPhoto(payload.photo ?? null);
    setLoaded(true);
  }, [endpoint]);

  useEffect(() => {
    if (!journalSaved || loaded) { setBusy(current => current === "loading" ? null : current); return; }
    const controller = new AbortController();
    setBusy("loading");
    refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(null); });
    return () => controller.abort();
  }, [refresh, journalSaved, loaded]);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = async (file?: File) => {
    if (!file) return;
    const token = ++generation.current;
    setBusy("preparing"); setError(""); setNotice("");
    try {
      const next = await prepareSessionPhoto(file, workout);
      if (token !== generation.current) return;
      setPrepared(next); setPreview(URL.createObjectURL(next.composite));
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "This photo could not be prepared."); }
    finally { if (token === generation.current) setBusy(null); }
  };
  const regenerate = async () => {
    if (!photo || busy || !journalSaved || !loaded) return;
    const token = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    setBusy("preparing"); setError(""); setNotice("");
    try {
      const response = await fetch(photo.originalUrl, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("The saved original could not load. Retry, or choose the photo from your library.");
      const original = await response.blob();
      const next = await prepareSessionPhoto(new File([original], "saved-original.jpg", { type: "image/jpeg" }), workout);
      if (controller.signal.aborted || token !== generation.current) return;
      // Keep the already-sanitized saved original byte-for-byte; repeated map
      // updates should not repeatedly JPEG-compress the underlying photograph.
      setPrepared({ ...next, original }); setPreview(URL.createObjectURL(next.composite));
      setNotice("Updated overlay ready. Save it to replace the previous session photo.");
    } catch (e) {
      if (!controller.signal.aborted && token === generation.current) setError(e instanceof Error ? e.message : "The overlay could not be updated.");
    } finally { if (!controller.signal.aborted && token === generation.current) setBusy(null); }
  };
  const save = async () => {
    if (!prepared || !journalSaved || !loaded || busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy("saving"); setProgress(0); setError(""); setNotice("");
    try {
      const saved = await uploadSessionPhoto(workout.id, prepared, photo?.id ?? null, setProgress, controller.signal);
      if (controller.signal.aborted) return;
      setPhoto(saved); setPrepared(null); setPreview(""); setNotice("Session photo saved privately.");
    } catch (e) {
      if (controller.signal.aborted) return;
      if ((e as { status?: number }).status === 409) {
        await refresh(controller.signal).catch(() => {});
        setError("The saved photo or workout changed. Your preview is still here. If the workout changed, choose the photo again to rebuild its overlay. Otherwise, save again only if you want to replace the latest photo.");
      } else setError(e instanceof Error ? e.message : "Photo could not be saved. Try again.");
    } finally { if (!controller.signal.aborted) setBusy(null); }
  };
  const remove = async () => {
    if (!photo || busy || !confirm("Delete this session photo and its saved original? Your workout and sets will stay.")) return;
    const controller = new AbortController(); request.current = controller;
    setBusy("deleting"); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "If-Match": photo.id }, signal: controller.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 409) await refresh(controller.signal);
        throw new Error(payload.error || "The photo could not be deleted. Try again.");
      }
      setPhoto(null); setNotice("Session photo deleted.");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Photo could not be deleted."); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  };
  const imageUrl = preview || photo?.url;
  const muscles = prepared?.muscles ?? photo?.muscles ?? [];
  const disabled = !!busy || !journalSaved || !loaded;
  const staleOverlay = !!photo && (photo.date !== workout.date || photo.routine !== workout.routine || JSON.stringify(photo.muscles) !== JSON.stringify(getWorkedMuscles(workout)));

  return <section className="panel session-photo-panel" aria-labelledby={`session-photo-${workout.id}`}>
    <div className="section-heading"><div><h3 id={`session-photo-${workout.id}`}>Your session, captured.</h3><p>Optional photo · workout, date, and muscles trained.</p></div><Camera size={22} className="orange" /></div>
    {imageUrl && <figure className="session-photo-preview"><img src={imageUrl} alt={`${prepared ? "Unsaved preview" : "Saved photo"} of ${workout.routine} session on ${workout.date}, with front and back muscle diagrams`} /><figcaption>{prepared ? "Preview · not saved yet" : staleOverlay ? "Saved privately · overlay needs updating" : "Saved privately"}{muscles.length > 0 && <span>{muscles.map(muscle => MUSCLE_LABELS[muscle as Muscle] ?? muscle).join(" · ")}</span>}</figcaption></figure>}
    {staleOverlay && !prepared && <div className="alert" role="status"><div><strong>Your workout changed after this photo.</strong><p>Its saved muscle map reflects the earlier workout. Update the overlay using your saved original; you do not need to upload the photo again.</p><button className="button secondary" disabled={disabled} onClick={() => void regenerate()}><RefreshCw size={16} /> Update muscle overlay</button></div></div>}
    {!imageUrl && !busy && <div className="session-photo-empty"><Camera size={32} /><p>Take a photo or choose one from your library. Your workout is already recorded.</p></div>}
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden disabled={disabled} aria-label="Take a session photo" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file); }} />
    <input ref={gallery} type="file" accept="image/*" hidden disabled={disabled} aria-label="Choose a session photo" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file); }} />
    <div className="session-photo-actions">
      <button className="button secondary" disabled={disabled} onClick={() => camera.current?.click()}><Camera size={16} /> Take photo</button>
      <button className="button secondary" disabled={disabled} onClick={() => gallery.current?.click()}><ImagePlus size={16} /> Choose photo</button>
      {prepared && <><button className="button primary" disabled={disabled} onClick={() => void save()}>{photo ? "Replace saved photo" : "Save session photo"}</button><button className="text-button" disabled={!!busy} onClick={() => { generation.current++; setPrepared(null); setPreview(""); setError(""); }}><X size={15} /> Discard preview</button></>}
      {photo && !prepared && <><a className="button secondary" href={photo.url} download={`repbook-${photo.routine.toLowerCase()}-${photo.date}.jpg`}><ArrowDownToLine size={16} /> Download</a><button className="text-button" disabled={!!busy} onClick={() => void remove()}><Trash2 size={15} /> Delete photo</button></>}
    </div>
    {busy && <div className="session-photo-status" role="status"><LoaderCircle size={16} className="spin" /><span>{busy === "saving" ? progress === 100 ? "Upload complete. Saving privately…" : `Uploading photo… ${progress}%` : busy === "preparing" ? "Preparing your photo and muscle overlay…" : busy === "deleting" ? "Deleting photo…" : "Loading session photo…"}</span>{busy === "saving" && <progress value={progress} max={100} aria-label="Photo upload progress" />}</div>}
    {!journalSaved && <p className="form-hint" role="status">Waiting for this workout to finish syncing before adding a photo.</p>}
    {error && <div className="session-photo-error" role="alert"><p>{error}</p>{!busy && !loaded && <button className="text-button" onClick={() => { setBusy("loading"); setError(""); void refresh().catch(e => setError(e.message)).finally(() => setBusy(null)); }}><RefreshCw size={15} /> Retry loading photo</button>}</div>}
    {notice && <p className="session-photo-status" role="status">{notice}</p>}
    <p className="form-hint">Red shows muscles used by the exercises you logged, including assisting muscles. It is based on your workout, not an analysis of your body. Photos are resized and camera location metadata is removed before upload.</p>
  </section>;
}
