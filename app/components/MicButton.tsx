"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentLang, bcp47Of, onLangChange, type LangCode } from "@/lib/ui_lang";

// Type minimal pour l API SpeechRecognition (pas typée dans lib.dom standard).
type SpeechRecResult = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};
type SpeechRecEvent = {
  results: ArrayLike<SpeechRecResult> & { [key: number]: SpeechRecResult };
  resultIndex: number;
};
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecConstructor = new () => SpeechRec;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecConstructor;
    webkitSpeechRecognition?: SpeechRecConstructor;
  }
}

// Bouton mic custom qui force la langue courante via Web Speech Recognition,
// bypassant le clavier iOS système. Compatible Safari iOS 14.5+ et Chrome.
// Sur Firefox : le bouton se cache automatiquement (API non supportée).
export default function MicButton({
  onTranscript,
  className = "",
}: {
  onTranscript: (text: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<LangCode>("pt");
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    setLang(getCurrentLang());
    return onLangChange(setLang);
  }, []);

  function start() {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = bcp47Of(lang);
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e: SpeechRecEvent) => {
      // Concatène tous les segments finaux — utile si l'user parle en plusieurs phrases.
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) onTranscript(text);
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`shrink-0 rounded-full w-11 h-11 flex items-center justify-center transition ${
        listening
          ? "bg-[#ff3b30] text-white animate-pulse"
          : "bg-[color:var(--color-accent)] text-white hover:opacity-90"
      } ${className}`}
      aria-label={listening ? "Parar ditado" : `Ditar em ${bcp47Of(lang)}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
