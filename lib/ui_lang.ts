// Langue de l UI et des inputs. Contrôle l attribut lang du <html> et des <textarea>,
// ce qui influence directement le clavier + la dictée iOS/Android.
// Pas de traduction UI en V1 : les labels restent en PT-BR. Ce module sert
// uniquement à orienter la reconnaissance vocale et à hinter les prompts IA.

const KEY = "cq_ui_lang";

export type LangCode = "pt" | "fr" | "es" | "en" | "zh" | "it" | "de" | "ja";

export const LANGS: { code: LangCode; label: string; flag: string; bcp47: string }[] = [
  { code: "pt", label: "Português",  flag: "🇧🇷", bcp47: "pt-BR" },
  { code: "fr", label: "Français",   flag: "🇫🇷", bcp47: "fr-FR" },
  { code: "es", label: "Español",    flag: "🇪🇸", bcp47: "es-ES" },
  { code: "en", label: "English",    flag: "🇬🇧", bcp47: "en-US" },
  { code: "zh", label: "中文",        flag: "🇨🇳", bcp47: "zh-CN" },
  { code: "it", label: "Italiano",   flag: "🇮🇹", bcp47: "it-IT" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪", bcp47: "de-DE" },
  { code: "ja", label: "日本語",       flag: "🇯🇵", bcp47: "ja-JP" },
];

const CODES = new Set(LANGS.map(l => l.code));

// Détecte la langue navigateur au premier lancement.
// navigator.language retourne des BCP-47 : "fr-FR", "pt-BR", "en-US", "zh-CN", etc.
// On extrait juste la partie langue et on la matche à notre liste.
export function detectBrowserLang(): LangCode {
  if (typeof navigator === "undefined") return "pt";
  const raw = (navigator.language || "pt").toLowerCase();
  const short = raw.split("-")[0] as LangCode;
  return CODES.has(short) ? short : "pt";
}

export function getCurrentLang(): LangCode {
  if (typeof window === "undefined") return "pt";
  const stored = localStorage.getItem(KEY) as LangCode | null;
  if (stored && CODES.has(stored)) return stored;
  const detected = detectBrowserLang();
  localStorage.setItem(KEY, detected);
  return detected;
}

export function setCurrentLang(code: LangCode): void {
  if (typeof window === "undefined") return;
  if (!CODES.has(code)) return;
  localStorage.setItem(KEY, code);
  // Propage à <html lang="..."> pour que le clavier iOS/Android suive.
  const bcp = LANGS.find(l => l.code === code)?.bcp47 || "pt-BR";
  document.documentElement.lang = bcp;
  window.dispatchEvent(new CustomEvent("cq-lang-change", { detail: code }));
}

export function bcp47Of(code: LangCode): string {
  return LANGS.find(l => l.code === code)?.bcp47 || "pt-BR";
}

export function flagOf(code: LangCode): string {
  return LANGS.find(l => l.code === code)?.flag || "🌐";
}

export function onLangChange(cb: (code: LangCode) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<LangCode>).detail);
  window.addEventListener("cq-lang-change", handler);
  return () => window.removeEventListener("cq-lang-change", handler);
}
