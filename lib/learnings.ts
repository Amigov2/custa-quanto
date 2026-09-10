// Log des corrections user pour calibrer l'IA vision au fil du temps.
// Chaque fois que l'user override quelque chose que l'IA avait proposé (ambiente, m², itens),
// on stocke la paire (ce que l'IA disait, ce que l'user a mis). Ensuite on résume ces
// patterns et on les injecte dans le prompt Vision pour les analyses futures.
//
// Sans backend : les learnings sont per-device. Ce sera consolidé cross-users en V2.

import type { PhotoAnalysis } from "./vision";

const KEY = "cq_learnings";
const MAX_RECORDS = 100; // au-delà, on drop les plus vieux (FIFO)

export type LearningType = "ambiente" | "m2_delta" | "scope";

export type LearningRecord = {
  id: string;
  dateISO: string;
  type: LearningType;
  // Contexte utile pour identifier les patterns futurs (ex: photo type).
  context: {
    ambienteDetected?: PhotoAnalysis["ambiente"];   // ce que l'IA a détecté au moment
    m2Detected?: number;                             // ce que l'IA a estimé
  };
  correction: {
    ambienteCorrected?: PhotoAnalysis["ambiente"];   // ce que l'user a mis
    m2Corrected?: number;                            // ce que l'user a mis
    scopeText?: string;                              // scope tapé (pour analyser récurrences)
  };
};

export function loadLearnings(): LearningRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLearning(rec: Omit<LearningRecord, "id" | "dateISO">): void {
  const list = loadLearnings();
  list.push({
    ...rec,
    id: "lr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    dateISO: new Date().toISOString(),
  });
  // FIFO cap : garde les MAX_RECORDS derniers.
  const capped = list.slice(-MAX_RECORDS);
  localStorage.setItem(KEY, JSON.stringify(capped));
  window.dispatchEvent(new CustomEvent("cq-learnings-change"));
}

export function deleteLearning(id: string): void {
  const list = loadLearnings().filter(l => l.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-learnings-change"));
}

export function clearAllLearnings(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("cq-learnings-change"));
}

export function onLearningsChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("cq-learnings-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("cq-learnings-change", handler);
    window.removeEventListener("storage", handler);
  };
}

// Résumé natural language des learnings à injecter dans le prompt Vision.
// Retourne "" si moins de 3 corrections (pas encore assez de signal).
export function summarizeLearnings(): string {
  const learnings = loadLearnings();
  if (learnings.length < 3) return "";

  const lines: string[] = [];

  // Pattern 1 : corrections d'ambiente récurrentes (X → Y ≥ 2×)
  const ambienteFixes = learnings.filter(l => l.type === "ambiente" && l.context.ambienteDetected && l.correction.ambienteCorrected);
  const ambCounts: Record<string, number> = {};
  ambienteFixes.forEach(l => {
    const key = `${l.context.ambienteDetected}→${l.correction.ambienteCorrected}`;
    ambCounts[key] = (ambCounts[key] || 0) + 1;
  });
  Object.entries(ambCounts)
    .filter(([, n]) => n >= 2)
    .forEach(([key, n]) => {
      const [from, to] = key.split("→");
      lines.push(`- Já corrigi ${n}× "${from}" → "${to}". Se a foto for parecida, escolha "${to}" diretamente.`);
    });

  // Pattern 2 : delta systématique sur m² (sur/sous-estimation moyenne)
  const m2Deltas = learnings
    .filter(l => l.type === "m2_delta" && l.context.m2Detected && l.correction.m2Corrected)
    .map(l => (l.correction.m2Corrected! - l.context.m2Detected!) / l.context.m2Detected!);
  if (m2Deltas.length >= 3) {
    const avgDelta = m2Deltas.reduce((s, d) => s + d, 0) / m2Deltas.length;
    if (Math.abs(avgDelta) > 0.15) {
      const dir = avgDelta > 0 ? "sub-estime" : "sobre-estime";
      const pct = Math.round(Math.abs(avgDelta) * 100);
      lines.push(`- Tenho tendência a ${dir} o m² em ~${pct}%. Ajuste sua estimativa nesse sentido.`);
    }
  }

  // Pattern 3 : mots-clés récurrents dans les scopes user (ce qui compte pour lui)
  const scopeWords = learnings
    .filter(l => l.correction.scopeText)
    .flatMap(l => l.correction.scopeText!.toLowerCase().split(/[\s,;]+/))
    .filter(w => w.length > 3);
  const wordCounts: Record<string, number> = {};
  scopeWords.forEach(w => (wordCounts[w] = (wordCounts[w] || 0) + 1));
  const topWords = Object.entries(wordCounts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
  if (topWords.length > 0) {
    lines.push(`- Palavras recorrentes nos escopos do usuário : ${topWords.join(", ")}. Foque nisso quando plausível.`);
  }

  if (lines.length === 0) return "";
  return `\n\nAPRENDIZADOS DO USUÁRIO (correções passadas — aplique se relevante) :\n${lines.join("\n")}\n`;
}

// Nombre de learnings enregistrés — pour l'affichage UI ("N corrections apprises").
export function countLearnings(): number {
  return loadLearnings().length;
}
