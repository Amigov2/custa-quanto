// Boucle d'apprentissage prix : chaque chantier fini où l'user renseigne le prix
// réel payé génère un feedback qui recalibre les multiplicateurs prices_observed.
//
// Approche : on garde la data brute des feedbacks (per-chantier) en localStorage,
// et à la volée on calcule un ratio ajusté pour chaque service. Les 246 NFs Rio
// Centro initiales gardent leur poids (datapoints élevé) → les feedbacks user
// affinent progressivement plutôt que d'écraser la base.
//
// V1 : ratio global appliqué à tous les services du chantier (simplification).
// V2 : ratio par service/phase pour granularité fine.

import { getObservedMultiplier } from "./prices_observed";

const KEY = "cq_price_feedbacks";
const USER_FEEDBACK_WEIGHT = 3;  // 1 feedback user = équivalent à ~3 datapoints (vs 246 NFs base)

export type PriceFeedback = {
  id: string;
  chantierId: string;
  dateISO: string;
  totalEstimated: number;   // ce que Custa Quanto avait estimé (mid)
  totalPaid: number;         // ce que l'user a vraiment payé
  serviceIds: string[];      // tous les services concernés par ce chantier
  notes?: string;            // ex: "sobrou dinheiro por causa de material barato"
};

export function loadFeedbacks(): PriceFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveFeedback(fb: Omit<PriceFeedback, "id" | "dateISO">): PriceFeedback {
  const list = loadFeedbacks();
  const feedback: PriceFeedback = {
    ...fb,
    id: "pf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    dateISO: new Date().toISOString(),
  };
  list.push(feedback);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-feedbacks-change"));
  return feedback;
}

export function deleteFeedback(id: string): void {
  const list = loadFeedbacks().filter(f => f.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cq-feedbacks-change"));
}

export function getFeedbackForChantier(chantierId: string): PriceFeedback | undefined {
  return loadFeedbacks().find(f => f.chantierId === chantierId);
}

// Retourne le multiplier calibré pour un service : combine base Rio (prices_observed)
// + tous les feedbacks user qui incluent ce service, pondéré par nb datapoints.
//
// Formule : mult_final = (base_mult × base_dp + user_avg_ratio × user_dp) / (base_dp + user_dp)
//   où user_avg_ratio = moyenne des (paid / estimated) des feedbacks qui contiennent ce service
//         user_dp    = nb feedbacks × USER_FEEDBACK_WEIGHT
export function getAdjustedMultiplier(serviceId: string): {
  mult: number;
  datapoints: number;
  userFeedbackCount: number;
  baseSource: string | null;
} {
  const base = getObservedMultiplier(serviceId);
  const feedbacks = loadFeedbacks().filter(f => f.serviceIds.includes(serviceId));

  const baseMult = base?.mult ?? 1.0;
  const baseDp = base?.datapoints ?? 0;
  const baseSource = base?.source ?? null;

  if (feedbacks.length === 0) {
    return {
      mult: baseMult,
      datapoints: baseDp,
      userFeedbackCount: 0,
      baseSource,
    };
  }

  const ratios = feedbacks
    .filter(f => f.totalEstimated > 0)
    .map(f => f.totalPaid / f.totalEstimated);
  if (ratios.length === 0) {
    return { mult: baseMult, datapoints: baseDp, userFeedbackCount: 0, baseSource };
  }

  const userAvgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const userDp = ratios.length * USER_FEEDBACK_WEIGHT;

  // Le mult de base est appliqué au ratio estimé/SINAPI ; le feedback user aligne
  // sur le vrai marché. On combine linéairement pondéré par datapoints.
  const combined = (baseMult * baseDp + userAvgRatio * userDp) / (baseDp + userDp);

  return {
    mult: combined,
    datapoints: baseDp + userDp,
    userFeedbackCount: ratios.length,
    baseSource,
  };
}

export function onFeedbacksChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("cq-feedbacks-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("cq-feedbacks-change", handler);
    window.removeEventListener("storage", handler);
  };
}
