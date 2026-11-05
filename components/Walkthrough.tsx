"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import { createClient } from "@supabase/supabase-js";
import {
  BAD_RATINGS, DECLARATION_TEXT, INTRO, SECTIONS, buildSteps, optsOf, sectionVisible, type Step,
} from "@/lib/form";
import type { FormState, RatingAnswer, Section } from "@/lib/types";
import VoiceBox from "./VoiceBox";
import Photos from "./Photos";
import { speak, speechSupported, stopSpeaking } from "./useSpeech";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Initial = any;

function initialState(init: Initial): FormState {
  const a: Record<string, any> = { ...(init.answers ?? {}) };
  const pf = init.prefill ?? {};
  if (a.sellerName === undefined && pf.sellerName) a.sellerName = pf.sellerName;
  if (a.sellerEmail === undefined && pf.sellerEmail) a.sellerEmail = pf.sellerEmail;
  if (a.sellerMobile === undefined && pf.sellerMobile) a.sellerMobile = pf.sellerMobile;
  if (a.vesselName === undefined && pf.vessel) a.vesselName = pf.vessel;
  return {
    answers: a,
    customInclusions: init.extras?.customInclusions ?? [],
    declarationName: init.declaration_name ?? "",
    declarationAgreed: !!init.declaration_agreed,
    step: init.step ?? 0,
    photos: (init.photos ?? [])
      .filter((p: any) => p.url)
      .map((p: any) => ({ id: p.id, sectionId: p.section, caption: p.caption ?? "", url: p.url, status: "ok" as const })),
  };
}

const payloadOf = (s: FormState) => ({
  answers: s.answers,
  extras: { customInclusions: s.customInclusions },
  declarationName: s.declarationName,
  declarationAgreed: s.declarationAgreed,
  step: s.step,
});

async function api(action: string, token: string, extra: Record<string, unknown> = {}) {
  const r = await fetch("/api/form", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token, ...extra }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

export default function Walkthrough({ token, initial }: { token: string; initial: Initial }) {
  const storeKey = "myu-vessel:" + token.slice(-24);
  const [state, setState] = useState<FormState>(() => initialState(initial));
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<null | { emailed: boolean; note?: string }>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const [voiceOk, setVoiceOk] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(JSON.stringify(payloadOf(initialState(initial))));
  const blobs = useRef(new Map<string, { blob: Blob; sectionId: string }>());
  const supa = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }),
    [],
  );

  // on this device: use unsynced local edits if they are newer than what the server has
  useEffect(() => {
    (async () => {
      try {
        const local = await get<{ payload: ReturnType<typeof payloadOf>; savedAt: string }>(storeKey);
        const serverAt = initial.last_saved_at ? Date.parse(initial.last_saved_at) : 0;
        if (local && Date.parse(local.savedAt) > serverAt + 5000) {
          setState((s) => ({
            ...s,
            answers: local.payload.answers,
            customInclusions: local.payload.extras?.customInclusions ?? [],
            declarationName: local.payload.declarationName ?? "",
            declarationAgreed: !!local.payload.declarationAgreed,
            step: local.payload.step ?? 0,
          }));
        }
      } catch {}
      setVoiceOk(speechSupported());
      try {
        setReadAloud(localStorage.getItem("myu-read-aloud") === "1");
      } catch {}
      setLoaded(true);
    })();
  }, [storeKey, initial.last_saved_at]);

  // autosave: to this device immediately, to the server shortly after
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const flush = useCallback(async () => {
    const payload = payloadOf(stateRef.current);
    const ser = JSON.stringify(payload);
    if (ser === lastSaved.current) return;
    try {
      await set(storeKey, { payload, savedAt: new Date().toISOString() });
    } catch {}
    await api("save", token, payload);
    lastSaved.current = ser;
  }, [storeKey, token]);

  useEffect(() => {
    if (!loaded) return;
    if (JSON.stringify(payloadOf(state)) === lastSaved.current) return;
    setSaved("saving");
    const t = setTimeout(async () => {
      try {
        await flush();
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [state, loaded, flush]);

  useEffect(() => {
    const on = () => setState((s) => ({ ...s }));
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);

  // photos: compress -> upload straight to private storage -> confirm
  const uploadPhoto = useCallback(
    async (localId: string, blob: Blob, sectionId: string, caption: string) => {
      try {
        const n = await api("photo_new", token, { section: sectionId, caption });
        const up = await supa.storage.from("crm-files").uploadToSignedUrl(n.path, n.upload_token, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        await api("photo_done", token, { photoId: n.photo_id });
        blobs.current.delete(localId);
        setState((s) => ({ ...s, photos: s.photos.map((p) => (p.id === localId ? { ...p, id: n.photo_id, status: "ok" } : p)) }));
      } catch {
        setState((s) => ({ ...s, photos: s.photos.map((p) => (p.id === localId ? { ...p, status: "error" } : p)) }));
      }
    },
    [token, supa],
  );
  const addPhoto = (sectionId: string, blob: Blob, caption: string) => {
    const id = crypto.randomUUID();
    blobs.current.set(id, { blob, sectionId });
    setState((s) => ({ ...s, photos: [...s.photos, { id, sectionId, caption, url: URL.createObjectURL(blob), status: "uploading" }] }));
    void uploadPhoto(id, blob, sectionId, caption);
  };
  const retryPhoto = (id: string) => {
    const b = blobs.current.get(id);
    const p = state.photos.find((x) => x.id === id);
    if (!b || !p) return;
    setState((s) => ({ ...s, photos: s.photos.map((x) => (x.id === id ? { ...x, status: "uploading" } : x)) }));
    void uploadPhoto(id, b.blob, b.sectionId, p.caption);
  };
  const removePhoto = (id: string) => {
    const p = state.photos.find((x) => x.id === id);
    setState((s) => ({ ...s, photos: s.photos.filter((x) => x.id !== id) }));
    blobs.current.delete(id);
    if (p?.status === "ok") void api("photo_remove", token, { photoId: id }).catch(() => {});
  };
  const captionPhoto = (id: string, caption: string, commit: boolean) => {
    setState((s) => ({ ...s, photos: s.photos.map((x) => (x.id === id ? { ...x, caption } : x)) }));
    const p = state.photos.find((x) => x.id === id);
    if (commit && p?.status === "ok") void api("photo_caption", token, { photoId: id, caption }).catch(() => {});
  };

  const steps = useMemo(() => buildSteps(state.answers), [state.answers]);
  const stepIdx = Math.min(state.step, steps.length - 1);
  const step = steps[stepIdx];

  const go = useCallback((i: number) => {
    setState((s) => ({ ...s, step: Math.max(0, i) }));
    setMenu(false);
    stopSpeaking();
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const setAnswer = (id: string, v: string | RatingAnswer) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [id]: v } }));
  const patchRating = (id: string, patch: Partial<RatingAnswer>) =>
    setState((s) => {
      const prev = s.answers[id];
      const base = typeof prev === "object" && prev ? prev : {};
      return { ...s, answers: { ...s.answers, [id]: { ...base, ...patch } } };
    });

  // read the question aloud when the step changes
  useEffect(() => {
    if (!loaded || !readAloud) return;
    if (step.kind === "item") speak(step.item.say ?? step.item.label);
    else stopSpeaking();
  }, [stepIdx, readAloud, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRead = () => {
    const v = !readAloud;
    setReadAloud(v);
    try {
      localStorage.setItem("myu-read-aloud", v ? "1" : "0");
    } catch {}
    if (!v) stopSpeaking();
  };

  const isAnswered = useCallback(
    (st: Step) => {
      if (st.kind === "checklist") {
        const sec = SECTIONS.find((x) => x.id === st.sectionId);
        return (sec?.checks ?? []).every((c) => !!(state.answers[c.id] as RatingAnswer | undefined)?.rating);
      }
      if (st.kind !== "item") return true;
      const a = state.answers[st.item.id];
      return typeof a === "string" && a.trim() !== "";
    },
    [state.answers],
  );

  const unanswered = steps.map((s, i) => ({ s, i })).filter(({ s }) => (s.kind === "item" || s.kind === "checklist") && !isAnswered(s));
  const unansweredCount = steps.reduce((n, st) => {
    if (st.kind === "item") return n + (isAnswered(st) ? 0 : 1);
    if (st.kind === "checklist") {
      const sec = SECTIONS.find((x) => x.id === st.sectionId);
      return n + (sec?.checks ?? []).filter((c) => !(state.answers[c.id] as RatingAnswer | undefined)?.rating).length;
    }
    return n;
  }, 0);

  const sectionProgress = (id: string) => {
    const sec = SECTIONS.find((x) => x.id === id);
    const mine = steps.filter((s) => s.kind === "item" && s.sectionId === id);
    const checks = sec?.checks ?? [];
    const answered = mine.filter(isAnswered).length + checks.filter((c) => !!(state.answers[c.id] as RatingAnswer | undefined)?.rating).length;
    return { total: mine.length + checks.length, answered };
  };

  const submit = async () => {
    setError("");
    if (state.photos.some((p) => p.status === "uploading")) {
      setError("Some photos are still uploading. Please wait a moment and try again.");
      return;
    }
    if (state.photos.some((p) => p.status === "error")) {
      setError("Some photos didn’t upload. Please retry or remove them (look for “Not saved” on the photo step).");
      return;
    }
    setSending(true);
    try {
      lastSaved.current = "";
      await flush();
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submission failed (" + res.status + ")");
      setDone({ emailed: !!data.emailed, note: data.note });
      try {
        await set(storeKey, undefined);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Your answers are saved; please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!loaded) return <div className="shell"><p className="center">Loading…</p></div>;

  if (done) {
    return (
      <div className="shell">
        <Header progress={1} title="Submitted" />
        <main className="card">
          <h1>Thank you</h1>
          <p>Your vessel report has been submitted. {done.emailed ? "A PDF copy has been emailed to Brendon and to you." : done.note}</p>
          <p>Brendon will be in touch shortly. You can now close this page.</p>
        </main>
      </div>
    );
  }

  const progress = stepIdx / Math.max(1, steps.length - 1);
  const currentSection = step.kind === "item" || step.kind === "photos" || step.kind === "checklist" ? SECTIONS.find((s) => s.id === step.sectionId) : undefined;
  const title =
    step.kind === "intro" ? "Welcome" : step.kind === "declaration" ? "Review and submit" : currentSection ? (currentSection.part ? currentSection.part + " · " : "") + currentSection.title : "";

  return (
    <div className="shell">
      <Header progress={progress} title={title} onMenu={() => setMenu(true)} saved={saved} />
      <div ref={topRef} />
      <main className="card">
        {step.kind === "intro" && (
          <>
            <h1>{INTRO.title}</h1>
            {INTRO.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            <h2>How it works</h2>
            <ol className="how">{INTRO.how.map((h, i) => <li key={i}>{h}</li>)}</ol>
            {!voiceOk && <div className="err">Voice input isn’t available in this browser. You can still type every answer, or open this link in Chrome (Android) or Safari (iPhone) to use voice.</div>}
            <label className="toggle">
              <input type="checkbox" checked={readAloud} onChange={toggleRead} />
              <span>Read each question aloud</span>
            </label>
          </>
        )}

        {step.kind === "item" && (
          <ItemCard
            key={step.item.id}
            step={step}
            sectionTitle={currentSection?.title ?? ""}
            remind={step.first ? currentSection?.remind : undefined}
            marketing={currentSection?.marketing}
            value={state.answers[step.item.id]}
            setAnswer={setAnswer}
            readAloud={readAloud}
            toggleRead={toggleRead}
          />
        )}

        {step.kind === "checklist" && currentSection && (
          <ChecklistCard
            key={currentSection.id}
            section={currentSection}
            answers={state.answers}
            patchRating={patchRating}
          />
        )}

        {step.kind === "photos" && (
          <>
            <div className="eyebrow">{currentSection?.title}</div>
            <h1>Photos for this section</h1>
            <p className="muted">Add clear photos of anything you described, plus the suggestions below. You can skip this if there is nothing to add.</p>
            <Photos
              sectionId={step.sectionId}
              suggestions={currentSection?.photos ?? []}
              photos={state.photos}
              onAdd={(blob, caption) => addPhoto(step.sectionId, blob, caption)}
              onRemove={removePhoto}
              onCaption={captionPhoto}
              onRetry={retryPhoto}
            />
          </>
        )}

        {step.kind === "declaration" && (
          <>
            <h1>Review and submit</h1>
            {unansweredCount > 0 ? (
              <div className="warn">
                <strong>{unansweredCount} item{unansweredCount === 1 ? "" : "s"} not answered yet.</strong>
                <p>Unanswered items appear as “Not answered” in the report, and a buyer may read a blank as a working item. Please tick “Not sure” or “N/A” rather than leaving it blank.</p>
                <button type="button" className="btn ghost" onClick={() => go(unanswered[0].i)}>Go to first unanswered</button>
              </div>
            ) : (
              <div className="ok">All questions answered.</div>
            )}
            <h2>Declaration</h2>
            <p className="decl">{DECLARATION_TEXT}</p>
            <div className="sub">Type or speak your full name to sign</div>
            <VoiceBox value={state.declarationName} onChange={(v) => setState((s) => ({ ...s, declarationName: v }))} format={undefined} rows={1} />
            <label className="toggle">
              <input type="checkbox" checked={state.declarationAgreed} onChange={(e) => setState((s) => ({ ...s, declarationAgreed: e.target.checked }))} />
              <span>I confirm the above declaration</span>
            </label>
            {error && <div className="err">{error}</div>}
            <button
              type="button"
              className="btn primary big"
              disabled={sending || !state.declarationAgreed || !state.declarationName.trim()}
              onClick={submit}
            >
              {sending ? "Submitting…" : "Submit report"}
            </button>
            {(!state.answers.sellerEmail || typeof state.answers.sellerEmail !== "string" || !/.+@.+\..+/.test(state.answers.sellerEmail)) && (
              <p className="muted">Your email address looks incomplete, so we may not be able to send you a copy. You can fix it in “Your details”.</p>
            )}
          </>
        )}
      </main>

      <footer className="nav">
        <button type="button" className="btn ghost" onClick={() => go(stepIdx - 1)} disabled={stepIdx === 0}>Back</button>
        {step.kind !== "declaration" && (
          <button type="button" className="btn primary" onClick={() => go(stepIdx + 1)}>
            {step.kind === "intro" ? "Start" : step.kind === "item" && !isAnswered(step) ? "Skip" : "Next"}
          </button>
        )}
      </footer>

      {menu && (
        <div className="drawer" role="dialog" aria-label="Sections">
          <div className="drawer-inner">
            <div className="drawer-head">
              <strong>Sections</strong>
              <button type="button" className="btn ghost" onClick={() => setMenu(false)}>Close</button>
            </div>
            <button type="button" className="sec-row" onClick={() => go(0)}>Welcome</button>
            {SECTIONS.filter((s) => sectionVisible(s, state.answers)).map((s) => {
              const idx = steps.findIndex((st) => (st.kind === "item" || st.kind === "photos" || st.kind === "checklist") && st.sectionId === s.id);
              const p = sectionProgress(s.id);
              return (
                <button key={s.id} type="button" className="sec-row" onClick={() => go(idx)}>
                  <span>{s.part ? <em className="part">{s.part}</em> : null}{s.title}</span>
                  <span className="count">{p.total ? `${p.answered}/${p.total}` : ""}</span>
                </button>
              );
            })}
            <button type="button" className="sec-row" onClick={() => go(steps.length - 1)}>Review and submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ progress, title, onMenu, saved }: { progress: number; title: string; onMenu?: () => void; saved?: string }) {
  return (
    <header className="top">
      <div className="top-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="top-logo" src="/myu-logo-horizontal.jpg" alt="Myachts Unlimited" />
        {onMenu && <button type="button" className="btn ghost small" onClick={onMenu}>Sections</button>}
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="top-row small">
        <span>{title}</span>
        <span className="saved">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "error" ? "Couldn’t save. Keep this page open" : ""}</span>
      </div>
    </header>
  );
}

function ItemCard({
  step, sectionTitle, remind, marketing, value, setAnswer, readAloud, toggleRead,
}: {
  step: Extract<Step, { kind: "item" }>;
  sectionTitle: string;
  remind?: string;
  marketing?: boolean;
  value: string | RatingAnswer | undefined;
  setAnswer: (id: string, v: string | RatingAnswer) => void;
  readAloud: boolean;
  toggleRead: () => void;
}) {
  const { item } = step;
  const text = typeof value === "string" ? value : "";

  return (
    <>
      <div className="eyebrow">{sectionTitle}{marketing ? " · marketing" : ""}</div>
      {remind && <div className="remind"><strong>Reminder</strong> {remind}</div>}
      <h1 className="q">{item.label}</h1>
      {item.hint && <p className="muted">{item.hint}</p>}
      <div className="q-tools">
        <button type="button" className="btn ghost small" onClick={() => speak(item.say ?? item.label)}>🔊 Read aloud</button>
        <label className="toggle small">
          <input type="checkbox" checked={readAloud} onChange={toggleRead} />
          <span>Always read aloud</span>
        </label>
      </div>

      {item.type === "voice" && (
        <VoiceBox
          value={text}
          onChange={(v) => setAnswer(item.id, v)}
          format={item.format}
          rows={item.format ? 1 : 5}
          readBack={!!item.format}
        />
      )}

      {item.type === "choice" && (
        <div className="choices">
          {item.options!.map((o) => (
            <button key={o} type="button" className={"choice" + (text === o ? " on" : "")} onClick={() => setAnswer(item.id, o)}>{o}</button>
          ))}
        </div>
      )}
    </>
  );
}

function ChecklistCard({
  section, answers, patchRating,
}: {
  section: Section;
  answers: Record<string, string | RatingAnswer>;
  patchRating: (id: string, patch: Partial<RatingAnswer>) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const checks = section.checks ?? [];
  const done = checks.filter((c) => !!(answers[c.id] as RatingAnswer | undefined)?.rating).length;
  return (
    <>
      <div className="eyebrow">{section.part ? section.part + " · " : ""}{section.title}</div>
      {section.remind && <div className="remind"><strong>Reminder</strong> {section.remind}</div>}
      <p className="muted">{done} of {checks.length} ticked. Tap one option for each row. Use the note to add detail.</p>
      <ul className="checklist">
        {checks.map((c) => {
          const ra = (typeof answers[c.id] === "object" ? answers[c.id] : {}) as RatingAnswer;
          const bad = !!ra.rating && BAD_RATINGS.includes(ra.rating);
          const showNote = open[c.id] || !!ra.note || bad;
          return (
            <li key={c.id} className={"check" + (bad ? " bad" : "") + (ra.rating ? " done" : "")}>
              <div className="check-label">{c.label}</div>
              {c.hint && <div className="check-hint">{c.hint}</div>}
              <div className="seg" role="group" aria-label={c.label}>
                {optsOf(section, c).map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={"segbtn " + o.replace(/[^A-Za-z]/g, "") + (ra.rating === o ? " on" : "")}
                    aria-pressed={ra.rating === o}
                    onClick={() => patchRating(c.id, { rating: o })}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {showNote ? (
                <>
                  <div className="sub">{bad ? "Describe the problem" : "Note (optional)"}</div>
                  <VoiceBox value={ra.note ?? ""} onChange={(v) => patchRating(c.id, { note: v })} rows={2} />
                </>
              ) : (
                <button type="button" className="linkbtn" onClick={() => setOpen((o) => ({ ...o, [c.id]: true }))}>+ Add note</button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
