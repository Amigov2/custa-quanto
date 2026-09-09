import type { Chantier } from "./types";
import { seedPaymentsIfEmpty } from "./payments";

const KEY = "cq_chantiers";

export function loadChantiers(): Chantier[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveChantier(item: Omit<Chantier, "id" | "createdAt">): Chantier {
  const list = loadChantiers();
  const chantier: Chantier = {
    ...item,
    id: "ch_" + Date.now(),
    createdAt: new Date().toISOString(),
  };
  list.push(chantier);
  localStorage.setItem(KEY, JSON.stringify(list));
  return chantier;
}

export function deleteChantier(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadChantiers().filter(c => c.id !== id)));
}

export function seedDemoIfEmpty(): void {
  if (typeof window === "undefined") return;
  if (loadChantiers().length > 0) return;
  const demo: Chantier[] = [
    {
      id: "ch_demo1",
      name: "Cozinha Riachuelo",
      posts: [
        { serviceId: "pintura_int", surface: 22, modifiers: {} },
        { serviceId: "piso_ceramico", surface: 12, modifiers: {} },
      ],
      finish: "padrao",
      total: [4200, 5800],
      createdAt: "2026-08-15T10:00:00Z",
    },
    {
      id: "ch_demo2",
      name: "Salão Ale — reforma completa",
      posts: [
        { serviceId: "piso_ceramico", surface: 45, modifiers: {} },
        { serviceId: "prep_superficie", surface: 80, modifiers: {} },
        { serviceId: "pintura_int", surface: 80, modifiers: {} },
      ],
      finish: "premium",
      total: [14200, 18900],
      createdAt: "2026-08-28T14:00:00Z",
    },
  ];
  localStorage.setItem(KEY, JSON.stringify(demo));

  // Seed quelques paiements sur le chantier demo Cozinha Riachuelo
  seedPaymentsIfEmpty("ch_demo1", [
    { valor: 800,  kind: "material", phaseId: "acabamento", serviceId: "pintura_int",   note: "Tinta Suvinil 18L + rolos",         date: "2026-08-20T09:15:00Z" },
    { valor: 1200, kind: "material", phaseId: "acabamento", serviceId: "piso_ceramico", note: "Cerâmica 60x60 Portobello",         date: "2026-08-24T14:30:00Z" },
    { valor: 1800, kind: "mo",       phaseId: "acabamento", serviceId: "piso_ceramico", note: "Valternir + equipe — assentamento", date: "2026-08-28T18:00:00Z" },
  ]);
}
