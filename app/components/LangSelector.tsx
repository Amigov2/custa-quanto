"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentLang, setCurrentLang, LANGS, onLangChange, type LangCode } from "@/lib/ui_lang";

// Chip cliquable qui affiche la langue courante et ouvre un dropdown
// pour la changer. La langue choisie oriente le clavier + dictée iOS.
export default function LangSelector() {
  const [lang, setLang] = useState<LangCode>("pt");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = getCurrentLang();
    setLang(current);
    // Sync l attribut <html> au mount pour que la dictée soit alignée dès le début.
    const bcp = LANGS.find(l => l.code === current)?.bcp47 || "pt-BR";
    document.documentElement.lang = bcp;
    setReady(true);
    return onLangChange(setLang);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  if (!ready) return null;

  const current = LANGS.find(l => l.code === lang) || LANGS[0];

  function choose(code: LangCode) {
    setCurrentLang(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-bg-2)] px-2.5 py-1 text-[11px] font-semibold hover:bg-[color:var(--color-line)] transition"
        aria-label="Escolher idioma"
      >
        <span>{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <span className="text-[9px] text-[color:var(--color-muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white rounded-2xl border border-[color:var(--color-line)] shadow-lg overflow-hidden">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
                l.code === lang
                  ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] font-semibold"
                  : "hover:bg-[color:var(--color-bg-2)]"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === lang && <span className="text-[color:var(--color-accent)]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
