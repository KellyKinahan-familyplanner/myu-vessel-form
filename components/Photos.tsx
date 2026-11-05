"use client";
import { useRef, useState } from "react";
import type { Photo } from "@/lib/types";

async function compress(file: File, max = 1400, quality = 0.62): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/jpeg", quality));
}

export default function Photos({
  sectionId,
  suggestions,
  photos,
  onAdd,
  onRemove,
  onCaption,
  onRetry,
}: {
  sectionId: string;
  suggestions: string[];
  photos: Photo[];
  onAdd: (blob: Blob, caption: string) => void;
  onRemove: (id: string) => void;
  onCaption: (id: string, caption: string, commit: boolean) => void;
  onRetry: (id: string) => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const pending = useRef("");
  const [busy, setBusy] = useState(false);
  const mine = photos.filter((p) => p.sectionId === sectionId);

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) onAdd(await compress(f), pending.current);
    } finally {
      pending.current = "";
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (libRef.current) libRef.current.value = "";
    }
  };

  const doneCaptions = new Set(mine.map((p) => p.caption));

  return (
    <div className="photos">
      {suggestions.length > 0 && (
        <>
          <div className="sub">Suggested photos (tap to take one)</div>
          <div className="chips">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={"chip" + (doneCaptions.has(s) ? " done" : "")}
                onClick={() => {
                  pending.current = s;
                  camRef.current?.click();
                }}
              >
                {doneCaptions.has(s) ? "✓ " : ""}{s}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="photo-actions">
        <button type="button" className="btn primary" onClick={() => { pending.current = ""; camRef.current?.click(); }}>
          Take photo
        </button>
        <button type="button" className="btn ghost" onClick={() => { pending.current = ""; libRef.current?.click(); }}>
          Choose from library
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target.files)} />
      <input ref={libRef} type="file" accept="image/*" multiple hidden onChange={(e) => handle(e.target.files)} />
      {busy && <div className="listening">Processing photo…</div>}
      <div className="thumbs">
        {mine.map((p) => (
          <div key={p.id} className="thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption || "Vessel photo"} />
            <input
              value={p.caption}
              placeholder="Add a caption"
              onChange={(e) => onCaption(p.id, e.target.value, false)}
              onBlur={(e) => onCaption(p.id, e.target.value, true)}
              aria-label="Photo caption"
            />
            {p.status === "uploading" && <div className="badge">Uploading…</div>}
            {p.status === "error" && (
              <button type="button" className="badge bad" onClick={() => onRetry(p.id)}>Not saved. Tap to retry</button>
            )}
            <button type="button" className="remove" onClick={() => onRemove(p.id)} aria-label="Remove photo">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
