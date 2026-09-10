import { getService } from "./sinapi";
import type { ChantierEstimate, PostEstimate, ServicePost } from "./types";
import type { Finish } from "./materials";
import { getObservedMultiplier } from "./prices_observed";
import { getAdjustedMultiplier } from "./price_feedback";

const FINISH_PRICE: Record<Finish, number> = {
  economico: 0.75,
  padrao: 1.0,
  premium: 1.4,
};

// Config de calcul devis
export type EstimateConfig = {
  modoContrato: "empreiteira" | "diaria"; // empreiteira = SINAPI+encargos+BDI, diaria = R$/jour direct MEI
  bdi: number;             // 0-1 (default 0.30) — Bonificação e Despesas Indiretas de l'empreiteira
  encargos: number;        // 0-1 (default 0.80) — Encargos sociaux appliqués sur MO brute (INSS, FGTS, férias, 13e)
  contingencia: number;    // 0-1 (default 0.10) — Réserve pour imprévus chantier
  materialMode: "included" | "client"; // included = empreiteira fornece avec marge, client = client compra (pas de BDI sur matériel)
  oficiais: number;        // pedreiros/pintores/encanadores qualifiés (1-4, default 1)
  ajudantes: number;       // serventes/auxiliares (0-3, default 1). Coef 0.6 vs oficial (calibré Riachuelo)
  diariaOficial: number;   // R$/dia par oficial en mode diaria (default 250, marché Rio Centro 2026)
  diariaAjudante: number;  // R$/dia par ajudante en mode diaria (default 150)
};

export const DEFAULT_CONFIG: EstimateConfig = {
  modoContrato: "diaria", // majoritaire au BR pour particuliers
  bdi: 0.30,
  encargos: 0.80,
  contingencia: 0.10,
  materialMode: "client", // en mode diaria, o client compra o material
  oficiais: 1,
  ajudantes: 1,
  diariaOficial: 250,
  diariaAjudante: 150,
};

// Baseline SINAPI = équipe padrão 1 oficial + 1 servente (coef 1 + 0.6×1 = 1.6).
// Le champ svc.daily est calibré sur cette baseline.
export const TEAM_BASELINE = 1.6;
export const AJUDANTE_COEF = 0.6;

export function teamMultiplier(oficiais: number, ajudantes: number): number {
  return oficiais + AJUDANTE_COEF * ajudantes;
}

// Facteur vitesse vs baseline : > 1 = plus rapide, < 1 = plus lent.
// Cap à 3.5× (au-delà les ouvriers se marchent dessus, surtout sur petites pièces).
export function teamSpeedFactor(oficiais: number, ajudantes: number): number {
  const mult = teamMultiplier(oficiais, ajudantes);
  return Math.min(3.5, Math.max(0.3, mult / TEAM_BASELINE));
}

const range = (a: number, b: number): [number, number] => [Math.round(a), Math.round(b)];
const mult = (r: [number, number], m: number): [number, number] => [Math.round(r[0] * m), Math.round(r[1] * m)];
const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];

export function estimatePost(
  post: ServicePost,
  finish: Finish,
  config: EstimateConfig = DEFAULT_CONFIG,
): PostEstimate | null {
  const svc = getService(post.serviceId);
  if (!svc) return null;

  let priceFactor = 1;
  let timeFactor = 1;
  (svc.modifiers || []).forEach(m => {
    const opt = m.options[post.modifiers?.[m.id] ?? 0];
    if (opt) {
      priceFactor *= opt.factor_price;
      timeFactor *= opt.factor_time;
    }
  });

  const finishMult = FINISH_PRICE[finish];
  const qty = post.surface;
  const baseMin = svc.min * qty * priceFactor * finishMult;
  const baseMax = svc.max * qty * priceFactor * finishMult;
  const moPct = svc.mo_pct;

  // Calibration matériel : combine base Rio (246 NFs Rio Centro) + feedbacks user
  // ("j'ai payé X pour ce chantier") pondérés dans getAdjustedMultiplier.
  // observed reste utilisé pour observedSource dans PostEstimate (transparence).
  const observed = getObservedMultiplier(svc.id);
  const adjusted = getAdjustedMultiplier(svc.id);
  const materialMult = adjusted.mult;

  // Matériel brut (SINAPI × observation Rio)
  const materialBase: [number, number] = range(
    baseMin * (1 - moPct) * materialMult,
    baseMax * (1 - moPct) * materialMult,
  );

  const teamFactor = teamSpeedFactor(config.oficiais, config.ajudantes);
  const days = Math.max(0.5, (qty / svc.daily) * timeFactor / teamFactor);

  let moBase: [number, number];
  let moEncargos: [number, number];
  let moFinal: [number, number];
  let bdi: [number, number];

  if (config.modoContrato === "diaria") {
    // Mode diária MEI : R$/jour direct, sem encargos sem BDI
    const diariaTotal = config.oficiais * config.diariaOficial + config.ajudantes * config.diariaAjudante;
    const moFlat = Math.round(days * diariaTotal);
    moBase = [moFlat, moFlat];
    moEncargos = [0, 0];
    moFinal = moBase;
    bdi = [0, 0];
  } else {
    // Mode empreiteira CLT : SINAPI + encargos sociais + BDI
    moBase = range(baseMin * moPct, baseMax * moPct);
    moEncargos = mult(moBase, config.encargos);
    moFinal = add(moBase, moEncargos);
    const subMaterialForBdi: [number, number] = config.materialMode === "client" ? [0, 0] : materialBase;
    const subForBdi: [number, number] = add(subMaterialForBdi, moFinal);
    bdi = mult(subForBdi, config.bdi);
  }

  // Sous-total = matériel + MO complète
  const subMaterial: [number, number] = config.materialMode === "client" ? [0, 0] : materialBase;
  const subtotal: [number, number] = add(subMaterial, moFinal);

  // Contingência sur (sous-total + BDI)
  const preContingencia: [number, number] = add(subtotal, bdi);
  const contingencia: [number, number] = mult(preContingencia, config.contingencia);

  const totalFinal: [number, number] = add(preContingencia, contingencia);

  return {
    svc,
    post,
    material: materialBase,
    moBase,
    moEncargos,
    moFinal,
    bdi,
    contingencia,
    total: totalFinal,
    days: days < 1 ? Number(days.toFixed(1)) : Math.round(days),
    observedSource: observed ?? null,
  };
}

export function estimateChantier(
  posts: ServicePost[],
  finish: Finish,
  config: EstimateConfig = DEFAULT_CONFIG,
): ChantierEstimate {
  const enabled = posts.filter(p => p.enabled !== false);
  const estimates = enabled
    .map(p => estimatePost(p, finish, config))
    .filter((e): e is PostEstimate => e !== null);

  const sum = (key: "total" | "material" | "moBase" | "moEncargos" | "moFinal" | "bdi" | "contingencia") =>
    estimates.reduce<[number, number]>(
      (acc, e) => [acc[0] + e[key][0], acc[1] + e[key][1]],
      [0, 0],
    );

  const totalDays = estimates.reduce((s, e) => s + e.days, 0);

  return {
    estimates,
    total: sum("total"),
    material: sum("material"),
    moBase: sum("moBase"),
    moEncargos: sum("moEncargos"),
    moFinal: sum("moFinal"),
    bdi: sum("bdi"),
    contingencia: sum("contingencia"),
    days: Math.round(totalDays * 10) / 10,
    workers: enabled.length > 2 ? 2 : 1,
  };
}

export const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const fmtBRL = (n: number) => "R$ " + fmt(n);
export const midOf = ([a, b]: [number, number]) => (a + b) / 2;
export const fmtPct = (n: number) => Math.round(n * 100) + "%";

// Explique le calcul de durée d'un poste (transparence : d'où viennent les X dias).
export type DaysBreakdown = {
  baseDaily: number;               // rendement SINAPI (unités/jour équipe standard)
  unit: string;                    // ex: "m²", "ponto"
  qty: number;
  daysRaw: number;                 // qty / baseDaily, avant modifiers
  modifierSteps: { modifierLabel: string; optionLabel: string; factor: number }[];
  teamStep: { oficiais: number; ajudantes: number; factor: number } | null; // null si équipe = baseline
  daysFinal: number;               // après modifiers + team + clamp
  clamped: boolean;                // true si le calcul brut était < 0.5j → forcé à 0.5j
  source: "SINAPI RJ 2025";
};

export function explainDays(post: ServicePost, config: EstimateConfig = DEFAULT_CONFIG): DaysBreakdown | null {
  const svc = getService(post.serviceId);
  if (!svc) return null;

  const steps: DaysBreakdown["modifierSteps"] = [];
  let timeFactor = 1;
  (svc.modifiers || []).forEach(m => {
    const optIdx = post.modifiers?.[m.id] ?? 0;
    const opt = m.options[optIdx];
    if (opt && opt.factor_time !== 1) {
      timeFactor *= opt.factor_time;
      steps.push({ modifierLabel: m.label, optionLabel: opt.label, factor: opt.factor_time });
    }
  });

  const teamFactor = teamSpeedFactor(config.oficiais, config.ajudantes);
  const teamStep = teamFactor === 1
    ? null
    : { oficiais: config.oficiais, ajudantes: config.ajudantes, factor: teamFactor };

  const daysRaw = post.surface / svc.daily;
  const withFactor = daysRaw * timeFactor / teamFactor;
  const clamped = withFactor < 0.5;
  const daysFinal = Math.max(0.5, withFactor);

  return {
    baseDaily: svc.daily,
    unit: svc.unit,
    qty: post.surface,
    daysRaw: withFactor,
    modifierSteps: steps,
    teamStep,
    daysFinal: daysFinal < 1 ? Number(daysFinal.toFixed(1)) : Math.round(daysFinal),
    clamped,
    source: "SINAPI RJ 2025",
  };
}
