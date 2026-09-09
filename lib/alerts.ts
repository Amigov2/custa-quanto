// Détection d'anomalies dans la configuration ou l'estimation d'un chantier.
// Framing prudent : "acima da faixa média Rio Centro", jamais "arnaque".

import type { EstimateConfig } from "./estimate";
import type { ChantierEstimate, PostEstimate } from "./types";

export type Alert = {
  level: "info" | "warn" | "danger";
  message: string;
};

const RJ_MEDIAN_PRICE_PER_M2 = 5500; // Rio Centro, chantier padrão residencial

export function detectAlerts(
  estimate: ChantierEstimate,
  config: EstimateConfig,
  chantierSurface: number,
): Alert[] {
  const alerts: Alert[] = [];
  const mid = (estimate.total[0] + estimate.total[1]) / 2;

  // Config anomalies
  if (config.bdi > 0.40) {
    alerts.push({
      level: "warn",
      message: `BDI ${Math.round(config.bdi * 100)}% é elevado — média BR fica entre 25-35%.`,
    });
  }
  if (config.bdi < 0.15) {
    alerts.push({
      level: "warn",
      message: `BDI ${Math.round(config.bdi * 100)}% é baixo — abaixo do padrão empreiteiro (~30%). Sub-estimativa provável.`,
    });
  }
  if (config.contingencia > 0.20) {
    alerts.push({
      level: "warn",
      message: `Contingência ${Math.round(config.contingencia * 100)}% é alta — média BR ~10-15%.`,
    });
  }
  if (config.contingencia < 0.05) {
    alerts.push({
      level: "warn",
      message: `Contingência ${Math.round(config.contingencia * 100)}% é baixa — recomendado 10-15% para imprevistos.`,
    });
  }
  if (config.encargos < 0.60) {
    alerts.push({
      level: "warn",
      message: `Encargos sociais ${Math.round(config.encargos * 100)}% é baixo — padrão BR ~80% (INSS+FGTS+férias+13º).`,
    });
  }

  // Prix / m² anomalies (si surface totale > 5 m²)
  if (chantierSurface >= 5) {
    const pricePerM2 = mid / chantierSurface;
    if (pricePerM2 > RJ_MEDIAN_PRICE_PER_M2 * 1.5) {
      const pct = Math.round(((pricePerM2 / RJ_MEDIAN_PRICE_PER_M2) - 1) * 100);
      alerts.push({
        level: "warn",
        message: `R$ ${Math.round(pricePerM2).toLocaleString("pt-BR")}/m² é ${pct}% acima da média Rio Centro (~R$ ${RJ_MEDIAN_PRICE_PER_M2.toLocaleString("pt-BR")}/m²).`,
      });
    }
  }

  return alerts;
}

// Comparação com um orçamento recebido de empreiteiro
export type ComparisonInput = {
  totalRecebido: number;                        // total du devis empreiteiro
  postsRecebido?: Record<string, number>;       // détail par serviceId (optional)
};

export type ComparisonResult = {
  totalRecebido: number;
  estimatedMid: number;
  estimatedRange: [number, number];
  deltaAbs: number;      // R$ écart absolu (positif = empreiteiro plus cher)
  deltaPct: number;      // % écart (positif = empreiteiro plus cher)
  verdict: "ok" | "acima" | "muito_acima" | "abaixo" | "muito_abaixo";
  perPost?: {
    serviceId: string;
    svcName: string;
    estimated: number;
    recebido: number;
    deltaAbs: number;
    deltaPct: number;
  }[];
};

export function compareWithOrcamento(
  estimate: ChantierEstimate,
  input: ComparisonInput,
): ComparisonResult {
  const estimatedMid = (estimate.total[0] + estimate.total[1]) / 2;
  const deltaAbs = input.totalRecebido - estimatedMid;
  const deltaPct = estimatedMid > 0 ? (deltaAbs / estimatedMid) : 0;

  let verdict: ComparisonResult["verdict"] = "ok";
  if (deltaPct > 0.35) verdict = "muito_acima";
  else if (deltaPct > 0.15) verdict = "acima";
  else if (deltaPct < -0.20) verdict = "muito_abaixo";
  else if (deltaPct < -0.05) verdict = "abaixo";

  let perPost: ComparisonResult["perPost"] | undefined = undefined;
  if (input.postsRecebido) {
    perPost = estimate.estimates
      .filter(e => input.postsRecebido && input.postsRecebido[e.post.serviceId] !== undefined)
      .map(e => {
        const rec = input.postsRecebido![e.post.serviceId];
        const est = (e.total[0] + e.total[1]) / 2;
        const d = rec - est;
        return {
          serviceId: e.post.serviceId,
          svcName: e.svc.name.replace(/^[^\s]+\s/, ""),
          estimated: est,
          recebido: rec,
          deltaAbs: d,
          deltaPct: est > 0 ? d / est : 0,
        };
      });
  }

  return {
    totalRecebido: input.totalRecebido,
    estimatedMid,
    estimatedRange: estimate.total,
    deltaAbs,
    deltaPct,
    verdict,
    perPost,
  };
}

export function verdictLabel(v: ComparisonResult["verdict"]): { label: string; color: string } {
  switch (v) {
    case "muito_acima":    return { label: "Muito acima da faixa Rio Centro", color: "#ff3b30" };
    case "acima":          return { label: "Acima da faixa Rio Centro", color: "#ff9500" };
    case "ok":             return { label: "Dentro da faixa Rio Centro", color: "#34c759" };
    case "abaixo":         return { label: "Abaixo da faixa Rio Centro", color: "#0071e3" };
    case "muito_abaixo":   return { label: "Muito abaixo da faixa — verificar qualidade", color: "#af52de" };
  }
}
