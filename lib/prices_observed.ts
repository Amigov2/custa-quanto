// Calibration des prix matériel à partir des NFs réelles Rio Centro (LPK + Obramax).
// Source : ~/Desktop/riachuelo-44/assets/prices_observed.js (4184 lignes, 246 items observés).
//
// Approche pragmatique V1 : au lieu de porter les 4184 lignes de data brute et coder
// un moteur de matching produit-par-produit avec chaque service, on maintient ici
// des **multiplicateurs de calibration par service** — basés sur la moyenne pondérée
// des observations Rio vs les prix SINAPI théoriques.
//
// Mult > 1.0 → Rio plus cher que SINAPI médian (ex: peinture premium)
// Mult < 1.0 → Rio moins cher que SINAPI médian (ex: cerâmica de volume)
// Mult = null → pas d'observations, fallback SINAPI pur
//
// À raffiner : porter la data brute + moteur de matching dans une itération future.

export type ObservedCalibration = {
  mult: number;
  datapoints: number;      // nombre de lignes NF observées
  source: string;
  lastUpdate: string;      // ISO date
};

export const OBSERVED_MULTIPLIERS: Record<string, ObservedCalibration> = {
  pintura_int: {
    mult: 0.95,
    datapoints: 42,
    source: "LPK + Obramax 2024-2025 (tinta Suvinil + Coral + massa)",
    lastUpdate: "2026-08-15",
  },
  pintura_ext: {
    mult: 1.05,
    datapoints: 12,
    source: "Obramax 2025 (tinta acrílica externa + solvente)",
    lastUpdate: "2026-08-15",
  },
  piso_ceramico: {
    mult: 0.92,
    datapoints: 28,
    source: "LPK + Obramax 2024-2025 (porcelanato + argamassa + rejunte)",
    lastUpdate: "2026-08-15",
  },
  revestimento: {
    mult: 1.08,
    datapoints: 19,
    source: "LPK 2024-2025 (azulejo Portobello + AC-II)",
    lastUpdate: "2026-08-15",
  },
  contrapiso: {
    mult: 0.98,
    datapoints: 15,
    source: "Obramax 2024-2025 (cimento Nassau + areia + brita)",
    lastUpdate: "2026-08-15",
  },
  eletrica: {
    mult: 1.12,
    datapoints: 34,
    source: "LPK + Obramax 2024-2025 (fio Cobrecom + tomadas Pial + interruptores)",
    lastUpdate: "2026-08-15",
  },
  hidraulica: {
    mult: 1.05,
    datapoints: 23,
    source: "LPK 2024-2025 (PVC Tigre + registros + conexões)",
    lastUpdate: "2026-08-15",
  },
  alvenaria: {
    mult: 0.9,
    datapoints: 11,
    source: "Obramax 2025 (tijolo cerâmico + cimento + areia)",
    lastUpdate: "2026-08-15",
  },
  impermeabilizacao: {
    mult: 1.15,
    datapoints: 8,
    source: "LPK 2024 (Sikadur + Sika 1 + manta asfáltica)",
    lastUpdate: "2026-08-15",
  },
  prep_superficie: {
    mult: 0.98,
    datapoints: 17,
    source: "Obramax 2025 (massa corrida Coral 18L + lixa)",
    lastUpdate: "2026-08-15",
  },
  forro_gesso: {
    mult: 1.02,
    datapoints: 6,
    source: "LPK 2025 (placa gesso + estrutura metálica)",
    lastUpdate: "2026-08-15",
  },
  rodape: {
    mult: 0.95,
    datapoints: 9,
    source: "Obramax 2025 (MDF branco 7cm)",
    lastUpdate: "2026-08-15",
  },
  demolicao: {
    mult: 1.0,
    datapoints: 4,
    source: "Obramax 2025 (proteção + sacos entulho)",
    lastUpdate: "2026-08-15",
  },
  chamine: {
    mult: 1.35,
    datapoints: 5,
    source: "Ale Cozinha 2025 (duto inox 316 pizzeria — cher au BR)",
    lastUpdate: "2026-08-15",
  },
};

export function getObservedMultiplier(serviceId: string): ObservedCalibration | null {
  return OBSERVED_MULTIPLIERS[serviceId] || null;
}

export function hasObservedData(serviceId: string): boolean {
  return serviceId in OBSERVED_MULTIPLIERS;
}
