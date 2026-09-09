// Système de crédits gratuits (Phase A). Stockage localStorage, pas de compte utilisateur.
// Phase B ajoutera l'auth + recharge PIX.

const KEY = "cq_credits";
const DEFAULT_CREDITS = 10;

export function getCredits(): number {
  if (typeof window === "undefined") return DEFAULT_CREDITS;
  const raw = localStorage.getItem(KEY);
  if (raw === null) {
    localStorage.setItem(KEY, String(DEFAULT_CREDITS));
    return DEFAULT_CREDITS;
  }
  const n = parseInt(raw);
  return isNaN(n) ? DEFAULT_CREDITS : n;
}

export function deductCredit(): number {
  const current = getCredits();
  const next = Math.max(0, current - 1);
  localStorage.setItem(KEY, String(next));
  window.dispatchEvent(new CustomEvent("cq-credits-change", { detail: next }));
  return next;
}

export function hasCredits(): boolean {
  return getCredits() > 0;
}

// Écoute les changements pour hydrater les UI qui affichent le badge en temps réel.
export function onCreditsChange(cb: (n: number) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<number>).detail);
  window.addEventListener("cq-credits-change", handler);
  window.addEventListener("storage", () => cb(getCredits()));
  return () => window.removeEventListener("cq-credits-change", handler);
}
