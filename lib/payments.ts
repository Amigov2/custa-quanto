// Tracking des paiements réels d'un chantier vs estimation.
// Stockage localStorage, séparé des chantiers pour ne pas polluer la structure existante.

import type { Chantier, ChantierEstimate } from "./types";
import { PHASES, getPhaseForService, type PhaseId } from "./phases";
import { midOf } from "./estimate";

export type PaymentKind = "mo" | "material" | "outro";

export type Payment = {
  id: string;
  chantierId: string;
  valor: number;               // R$
  kind: PaymentKind;
  phaseId?: PhaseId;           // optionnel (peut être outro sans phase)
  serviceId?: string;          // optionnel (pour affiner l'affectation)
  note?: string;
  date: string;                // ISO
};

const KEY = "cq_payments";

export function loadAllPayments(): Payment[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function loadPayments(chantierId: string): Payment[] {
  return loadAllPayments()
    .filter(p => p.chantierId === chantierId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function addPayment(input: Omit<Payment, "id" | "date"> & { date?: string }): Payment {
  const list = loadAllPayments();
  const payment: Payment = {
    ...input,
    id: "pay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    date: input.date ?? new Date().toISOString(),
  };
  list.push(payment);
  localStorage.setItem(KEY, JSON.stringify(list));
  return payment;
}

export function deletePayment(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadAllPayments().filter(p => p.id !== id)));
}

// Injecte des paiements de démo si aucun n'existe encore (appelé par seedDemoIfEmpty).
export function seedPaymentsIfEmpty(chantierId: string, payments: Omit<Payment, "id" | "chantierId">[]): void {
  if (typeof window === "undefined") return;
  const existing = loadAllPayments();
  if (existing.some(p => p.chantierId === chantierId)) return;
  const seeded: Payment[] = payments.map((p, i) => ({
    ...p,
    id: `pay_seed_${chantierId}_${i}`,
    chantierId,
  }));
  localStorage.setItem(KEY, JSON.stringify([...existing, ...seeded]));
}

export type PhaseProgress = {
  phaseId: PhaseId;
  label: string;
  emoji: string;
  color: string;
  pago: number;
  estimado: number;     // milieu de fourchette pour la phase
  pct: number;          // 0-1 (peut dépasser 1 si overshoot)
  overshoot: boolean;
};

export type ChantierProgress = {
  totalPago: number;
  totalEstimado: number;    // milieu de fourchette
  restante: number;         // max(0, totalEstimado - totalPago)
  pct: number;              // 0-1 (peut dépasser)
  overshoot: boolean;
  nPayments: number;
  byPhase: PhaseProgress[];
  unassigned: number;       // paiements sans phase (outro sans phase)
};

export function computeChantierProgress(
  chantier: Chantier,
  estimate: ChantierEstimate | null,
  payments: Payment[],
): ChantierProgress {
  const totalPago = payments.reduce((s, p) => s + p.valor, 0);
  const totalEstimado = midOf(chantier.total);
  const restante = Math.max(0, totalEstimado - totalPago);
  const pct = totalEstimado > 0 ? totalPago / totalEstimado : 0;

  // Estimé par phase (basé sur mid du poste, groupé par phase du serviceId)
  const estByPhase: Record<PhaseId, number> = {
    preparo: 0, estrutura: 0, instalacoes: 0, acabamento: 0, final: 0,
  };
  if (estimate) {
    estimate.estimates.forEach(pe => {
      const phase = getPhaseForService(pe.svc.id);
      estByPhase[phase.id] += midOf(pe.total);
    });
  }

  // Pago par phase
  const pagoByPhase: Record<PhaseId, number> = {
    preparo: 0, estrutura: 0, instalacoes: 0, acabamento: 0, final: 0,
  };
  let unassigned = 0;
  payments.forEach(p => {
    const phaseId = p.phaseId ?? (p.serviceId ? getPhaseForService(p.serviceId).id : undefined);
    if (phaseId) pagoByPhase[phaseId] += p.valor;
    else unassigned += p.valor;
  });

  const byPhase: PhaseProgress[] = PHASES
    .filter(ph => estByPhase[ph.id] > 0 || pagoByPhase[ph.id] > 0)
    .map(ph => {
      const pago = pagoByPhase[ph.id];
      const estimado = estByPhase[ph.id];
      const pctPhase = estimado > 0 ? pago / estimado : 0;
      return {
        phaseId: ph.id,
        label: ph.label,
        emoji: ph.emoji,
        color: ph.color,
        pago,
        estimado,
        pct: pctPhase,
        overshoot: estimado > 0 && pago > estimado,
      };
    });

  return {
    totalPago,
    totalEstimado,
    restante,
    pct,
    overshoot: totalPago > totalEstimado,
    nPayments: payments.length,
    byPhase,
    unassigned,
  };
}

export const PAYMENT_KIND_LABELS: Record<PaymentKind, { label: string; emoji: string; color: string }> = {
  mo:       { label: "Mão-de-obra", emoji: "👷", color: "#0071e3" },
  material: { label: "Material",    emoji: "🧱", color: "#af52de" },
  outro:    { label: "Outro",       emoji: "💰", color: "#8e8e93" },
};
