"use client";
import { useEffect, useRef, useState } from "react";
import { formatSpoken, speak, useDictation } from "./useSpeech";

type Props = {
  value: string;
  onChange: (v: string) => void;
  format?: "email" | "phone";
  placeholder?: string;
  rows?: number;
  autoStartKey?: string;
  readBack?: boolean;
};

export default function VoiceBox({ value, onChange, format, placeholder, rows = 4, readBack }: Props) {
  const [interim, setInterim] = useState("");
  // what was already in the box when this recording started; the recording text is added on top, never appended repeatedly
  const base = useRef("");
  const lastText = useRef("");
  const committed = useRef(true);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const { listening, error, start, stop } = useDictation((text, final) => {
    const commit = (t: string) => {
      setInterim("");
      committed.current = true;
      if (format) onChange(formatSpoken(format, t));
      else {
        const b = base.current.replace(/\s+$/, "");
        onChange(b ? b + " " + t : t.charAt(0).toUpperCase() + t.slice(1));
      }
    };
    if (!text) {
      // recording ended: if the last words were never marked final, keep them anyway
      if (lastText.current && !committed.current) commit(lastText.current);
      setInterim("");
      return;
    }
    lastText.current = text;
    if (!final) {
      committed.current = false;
      setInterim(text);
      return;
    }
    commit(text);
  });

  const toggle = () => {
    if (listening) stop();
    else {
      base.current = valueRef.current;
      lastText.current = "";
      start();
    }
  };

  return (
    <div className="voicebox">
      <div className="voice-row">
        <button type="button" className={"mic" + (listening ? " live" : "")} onClick={toggle} aria-pressed={listening} aria-label={listening ? "Stop recording" : "Start recording"}>
          <span className="mic-icon" aria-hidden>{listening ? "■" : "●"}</span>
          <span>{listening ? "Tap to stop" : "Tap to speak"}</span>
        </button>
        {readBack && value && (
          <button type="button" className="btn ghost" onClick={() => speak(format === "email" ? value.replace(/@/g, " at ").replace(/\./g, " dot ") : value.split("").join(" "))}>
            Read back
          </button>
        )}
      </div>
      <textarea
        value={value + (interim && !format ? (value ? " " : "") + interim : "")}
        onChange={(e) => onChange(e.target.value)}
        rows={format ? 1 : rows}
        placeholder={placeholder ?? "Your answer appears here. You can also type or edit."}
        className={interim ? "interim" : ""}
        inputMode={format === "phone" ? "tel" : format === "email" ? "email" : undefined}
        autoCapitalize={format ? "none" : "sentences"}
      />
      {listening && <div className="listening">Listening… speak now</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
