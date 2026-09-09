// Groupement des services SINAPI en phases chronologiques d'un chantier.
// Ordre standard BR : Preparação → Estrutura → Instalações → Acabamentos → Limpeza.

export type PhaseId = "preparo" | "estrutura" | "instalacoes" | "acabamento" | "final";

export const PHASES: {
  id: PhaseId;
  label: string;
  short: string;
  color: string;
  emoji: string;
  order: number;
  serviceIds: string[];
}[] = [
  {
    id: "preparo",
    label: "Preparação",
    short: "Preparo",
    color: "#8e8e93",
    emoji: "🔨",
    order: 1,
    serviceIds: ["prep_canteiro", "demolicao", "decapage"],
  },
  {
    id: "estrutura",
    label: "Estrutura",
    short: "Estrutura",
    color: "#af52de",
    emoji: "🧱",
    order: 2,
    serviceIds: ["alvenaria", "contrapiso", "escada", "bancada", "porta", "janela"],
  },
  {
    id: "instalacoes",
    label: "Instalações",
    short: "Instalações",
    color: "#ff9500",
    emoji: "⚡",
    order: 3,
    serviceIds: ["hidraulica", "eletrica", "impermeabilizacao", "ar_condicionado", "chamine", "serralheria"],
  },
  {
    id: "acabamento",
    label: "Acabamentos",
    short: "Acabamento",
    color: "#0071e3",
    emoji: "🎨",
    order: 4,
    serviceIds: [
      "prep_superficie", "revestimento", "piso_ceramico", "piso_laminado",
      "cimento_queimado", "marmore_granito", "vidro_espelho", "marcenaria",
      "forro_gesso", "forro_pvc", "rodape", "pintura_int", "pintura_ext",
    ],
  },
  {
    id: "final",
    label: "Finalização",
    short: "Limpeza",
    color: "#34c759",
    emoji: "✨",
    order: 5,
    serviceIds: ["limpeza_final"],
  },
];

export function getPhaseForService(serviceId: string): typeof PHASES[number] {
  const found = PHASES.find(p => p.serviceIds.includes(serviceId));
  return found ?? PHASES[3]; // default = acabamento
}
