"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;

export function speechSupported() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-AU";
  u.rate = 0.95;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Push-to-toggle dictation. onFinal gets each finalised phrase. */
export function useDictation(onFinal: (text: string) => void, onInterim?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<Rec>(null);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  useEffect(() => {
    finalRef.current = onFinal;
    interimRef.current = onInterim;
  });

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input is not supported in this browser. Please type your answer, or open this link in Chrome or Safari.");
      return;
    }
    stopSpeaking();
    setError("");
    const rec: Rec = new SR();
    rec.lang = "en-AU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      interimRef.current?.(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Microphone access is blocked. Please allow the microphone for this page in your browser settings.");
      else if (e.error === "no-speech") setError("I didn’t hear anything. Tap the microphone and try again.");
      else if (e.error !== "aborted") setError("Voice input stopped (" + e.error + "). You can tap the microphone to try again or type your answer.");
      setListening(false);
    };
    rec.onend = () => {
      interimRef.current?.("");
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => {
    try {
      recRef.current?.abort();
    } catch {}
  }, []);

  return { listening, error, start, stop };
}

const NUM: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
};

export function normaliseEmail(t: string) {
  return t
    .toLowerCase()
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+(underscore)\s+/g, "_")
    .replace(/\s+(dash|hyphen)\s+/g, "-")
    .replace(/\s+/g, "");
}

export function normalisePhone(t: string) {
  const words = t.toLowerCase().split(/[\s,-]+/).map((w) => NUM[w] ?? w);
  const joined = words.join("");
  return joined.replace(/[^\d+]/g, "");
}

export function formatSpoken(format: "email" | "phone" | undefined, t: string) {
  if (format === "email") return normaliseEmail(t);
  if (format === "phone") return normalisePhone(t);
  return t;
}
