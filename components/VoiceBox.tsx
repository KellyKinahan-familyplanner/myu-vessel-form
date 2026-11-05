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
  /** called with each raw final phrase (used for guided/rating parsing) */
  onPhrase?: (t: string) => void;
};

export default function VoiceBox({ value, onChange, format, placeholder, rows = 4, readBack, onPhrase }: Props) {
  const [interim, setInterim] = useState("");
  const buffer = useRef("");
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const { listening, error, start, stop } = useDictation(
    (t) => {
      if (!t) return;
      onPhrase?.(t);
      if (format) {
        buffer.current = (buffer.current + " " + t).trim();
        onChange(formatSpoken(format, buffer.current));
      } else {
        const cur = valueRef.current;
        onChange(cur ? cur.replace(/\s+$/, "") + " " + t : t.charAt(0).toUpperCase() + t.slice(1));
      }
    },
    setInterim,
  );

  const toggle = () => {
    if (listening) stop();
    else {
      buffer.current = "";
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
        value={value + (interim ? (value ? " " : "") + interim : "")}
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
