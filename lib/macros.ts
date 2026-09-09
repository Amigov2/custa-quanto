// MACROS — packages pré-configurés par pièce ou par action.
// Approche user : le client pense "je veux refaire ma cozinha", pas "je veux du piso + pintura + elétrica".
// Chaque macro = combinaison de services SINAPI avec ratios calibrés.
// Ratios calibrés depuis observations chantiers Riachuelo + validations Wolf/Valternir.

import type { ServicePost } from "./types";

export type MacroPost = {
  serviceId: string;
  qtyPerUnit: number;
  modifiers: Record<string, number>;
  note?: string; // pourquoi ce poste dans ce package
};

export type MacroGroup = "comodo" | "servico" | "estrutural";

export type Macro = {
  id: string;
  emoji: string;
  name: string;
  nameFr?: string;
  unit: string;
  unitFr?: string;
  defaultQty: number;
  minQty: number;
  maxQty: number;
  group: MacroGroup;
  description: string;
  descriptionFr?: string;
  posts: MacroPost[];
};

export const MACRO_GROUPS: { id: MacroGroup; label: string; desc: string }[] = [
  { id: "comodo",     label: "Cômodos",           desc: "Reforme um ambiente inteiro" },
  { id: "servico",    label: "Serviços rápidos",  desc: "Uma ação específica" },
  { id: "estrutural", label: "Estrutural",        desc: "Alvenaria e obras pesadas" },
];

export const MACROS: Macro[] = [
  // ============ CÔMODOS ============
  {
    id: "reforma_cozinha",
    emoji: "🍳",
    name: "Reforma completa de cozinha",
    unit: "m² de cozinha",
    defaultQty: 12, minQty: 4, maxQty: 40,
    group: "comodo",
    description: "Demolição do existente, novos pontos hidráulica/elétrica, revestimento, piso e pintura.",
    posts: [
      { serviceId: "demolicao",     qtyPerUnit: 0.8, modifiers: { materiau: 1, evac: 0 }, note: "Demolição azulejo + bancada antiga (~80% da área do piso)" },
      { serviceId: "hidraulica",    qtyPerUnit: 0.25, modifiers: { type: 1 },              note: "3 pontos: pia + máquina + esgoto (para 12m²)" },
      { serviceId: "eletrica",      qtyPerUnit: 0.66, modifiers: { type: 0, chase: 0 },   note: "~8 pontos: 5 tomadas + 2 luz + 1 ar (para 12m²)" },
      { serviceId: "revestimento",  qtyPerUnit: 1.0,  modifiers: { format: 1, hauteur: 1 }, note: "Meia parede backsplash cozinha" },
      { serviceId: "contrapiso",    qtyPerUnit: 1,    modifiers: { epaisseur: 1 },        note: "Regularização antes do piso novo" },
      { serviceId: "piso_ceramico", qtyPerUnit: 1,    modifiers: { format: 1, pose: 0 },  note: "Piso porcelanato 60×60" },
      { serviceId: "pintura_int",   qtyPerUnit: 2.5,  modifiers: { couches: 1, support: 1, type_peinture: 0 }, note: "Paredes (~3× área) + teto (~1× área), massa incluída" },
    ],
  },
  {
    id: "reforma_banheiro",
    emoji: "🚽",
    name: "Reforma completa de banheiro",
    unit: "m² de banheiro",
    defaultQty: 5, minQty: 2, maxQty: 15,
    group: "comodo",
    description: "Novo do zero : alvenaria (se preciso), impermé, hidro, elétrica, revestimento total, piso.",
    posts: [
      { serviceId: "demolicao",         qtyPerUnit: 1.2, modifiers: { materiau: 1, evac: 0 }, note: "Piso + azulejo antigos + louças" },
      { serviceId: "impermeabilizacao", qtyPerUnit: 1,   modifiers: { couches: 1, zone: 1 },  note: "Área húmida completa" },
      { serviceId: "hidraulica",        qtyPerUnit: 0.8, modifiers: { type: 1 },              note: "~4 pontos: vaso + pia + chuveiro + ralo (para 5m²)" },
      { serviceId: "eletrica",          qtyPerUnit: 0.6, modifiers: { type: 0, chase: 0 },   note: "3 pontos: luz + tomada + chuveiro elétrico" },
      { serviceId: "revestimento",      qtyPerUnit: 5,   modifiers: { format: 1, hauteur: 2 }, note: "Azulejo do chão ao teto (~5m² por m² de piso)" },
      { serviceId: "contrapiso",        qtyPerUnit: 1,   modifiers: { epaisseur: 1 } },
      { serviceId: "piso_ceramico",     qtyPerUnit: 1,   modifiers: { format: 1, pose: 0 }, note: "Piso antiderrapante" },
    ],
  },
  {
    id: "reforma_sala",
    emoji: "🛋️",
    name: "Reforma de sala",
    unit: "m² de sala",
    defaultQty: 25, minQty: 8, maxQty: 80,
    group: "comodo",
    description: "Piso novo + pintura completa paredes/teto + revisão pontos elétricos.",
    posts: [
      { serviceId: "demolicao",       qtyPerUnit: 0.5, modifiers: { materiau: 0, evac: 0 }, note: "Retirada do piso antigo (~50% da área)" },
      { serviceId: "contrapiso",      qtyPerUnit: 1,   modifiers: { epaisseur: 1 } },
      { serviceId: "piso_ceramico",   qtyPerUnit: 1,   modifiers: { format: 1, pose: 0 } },
      { serviceId: "prep_superficie", qtyPerUnit: 3,   modifiers: { etat: 1 },             note: "Massa corrida paredes + teto (~4× m² sol)" },
      { serviceId: "pintura_int",     qtyPerUnit: 3,   modifiers: { couches: 1, support: 0, type_peinture: 0 }, note: "Paredes (~3×) + teto (~1×)" },
      { serviceId: "eletrica",        qtyPerUnit: 0.2, modifiers: { type: 0, chase: 0 },  note: "~5 pontos para sala de 25m²" },
    ],
  },
  {
    id: "reforma_quarto",
    emoji: "🛏️",
    name: "Reforma de quarto",
    unit: "m² de quarto",
    defaultQty: 12, minQty: 6, maxQty: 30,
    group: "comodo",
    description: "Piso laminado + pintura complète + pontos elétricos.",
    posts: [
      { serviceId: "piso_laminado",   qtyPerUnit: 1,   modifiers: { type: 0, manta: 0 } },
      { serviceId: "prep_superficie", qtyPerUnit: 3,   modifiers: { etat: 1 } },
      { serviceId: "pintura_int",     qtyPerUnit: 3,   modifiers: { couches: 1, support: 0, type_peinture: 0 } },
      { serviceId: "eletrica",        qtyPerUnit: 0.3, modifiers: { type: 0, chase: 0 },  note: "~4 pontos: 2 tomadas + 1 luz + 1 ponto AC" },
      { serviceId: "rodape",          qtyPerUnit: 1.4, modifiers: { materiau: 0 },        note: "Perímetro ~4× √(área)" },
    ],
  },
  {
    id: "reforma_home_office",
    emoji: "💻",
    name: "Home office",
    unit: "m² do escritório",
    defaultQty: 8, minQty: 4, maxQty: 20,
    group: "comodo",
    description: "Piso laminado + pintura + pontos elétrica/rede + iluminação embutida.",
    posts: [
      { serviceId: "piso_laminado",   qtyPerUnit: 1,   modifiers: { type: 0, manta: 0 } },
      { serviceId: "prep_superficie", qtyPerUnit: 3,   modifiers: { etat: 0 } },
      { serviceId: "pintura_int",     qtyPerUnit: 3,   modifiers: { couches: 1, support: 0, type_peinture: 0 } },
      { serviceId: "eletrica",        qtyPerUnit: 0.75, modifiers: { type: 4, chase: 0 }, note: "~6 pontos: 3 tomadas + 2 rede RJ45 + 1 luz" },
      { serviceId: "forro_gesso",     qtyPerUnit: 1,   modifiers: { type: 1 },            note: "Forro rebaixado com iluminação" },
    ],
  },
  {
    id: "reforma_apto_completo",
    emoji: "🏠",
    name: "Reforma completa de apartamento",
    unit: "m² total",
    defaultQty: 60, minQty: 30, maxQty: 300,
    group: "comodo",
    description: "Reforma pesada: sala + quartos + cozinha + banheiro. Estimativa global agregada.",
    posts: [
      { serviceId: "demolicao",       qtyPerUnit: 0.5, modifiers: { materiau: 1, evac: 1 }, note: "Retirada pisos + azulejos + louças (~50% da área total)" },
      { serviceId: "hidraulica",      qtyPerUnit: 0.13, modifiers: { type: 1 },             note: "~8 pontos para 60m² (cozinha + 1 banheiro)" },
      { serviceId: "eletrica",        qtyPerUnit: 0.4, modifiers: { type: 0, chase: 0 },   note: "~24 pontos para 60m²" },
      { serviceId: "contrapiso",      qtyPerUnit: 0.85, modifiers: { epaisseur: 1 },        note: "~85% da área recebe contrapiso novo" },
      { serviceId: "piso_ceramico",   qtyPerUnit: 0.85, modifiers: { format: 1, pose: 0 } },
      { serviceId: "revestimento",    qtyPerUnit: 0.35, modifiers: { format: 1, hauteur: 0 }, note: "Cozinha + banheiro (~35% da área tem azulejo parede)" },
      { serviceId: "prep_superficie", qtyPerUnit: 2.8, modifiers: { etat: 1 },             note: "Paredes + teto (~2.8× área total)" },
      { serviceId: "pintura_int",     qtyPerUnit: 2.8, modifiers: { couches: 1, support: 0, type_peinture: 0 } },
      { serviceId: "impermeabilizacao", qtyPerUnit: 0.1, modifiers: { couches: 1, zone: 1 }, note: "Banheiro (~10% da área)" },
      { serviceId: "limpeza_final",   qtyPerUnit: 1,   modifiers: { niveau: 1 } },
    ],
  },

  // ============ SERVIÇOS RÁPIDOS ============
  {
    id: "pintar_parede",
    emoji: "🖌️",
    name: "Pintar parede",
    unit: "m² de parede",
    defaultQty: 15, minQty: 2, maxQty: 200,
    group: "servico",
    description: "Preparo (lixamento + massa) + 2 demãos de tinta acrílica.",
    posts: [
      { serviceId: "prep_superficie", qtyPerUnit: 1, modifiers: { etat: 1 } },
      { serviceId: "pintura_int",     qtyPerUnit: 1, modifiers: { couches: 1, support: 0, type_peinture: 0 } },
    ],
  },
  {
    id: "pintar_comodo",
    emoji: "🎨",
    name: "Pintar cômodo completo",
    unit: "m² de piso",
    defaultQty: 15, minQty: 4, maxQty: 100,
    group: "servico",
    description: "Preparo + pintura paredes (~3× piso) + teto (~1× piso). Fita, lona e limpeza inclusos.",
    posts: [
      { serviceId: "prep_superficie", qtyPerUnit: 4, modifiers: { etat: 1 } },
      { serviceId: "pintura_int",     qtyPerUnit: 4, modifiers: { couches: 1, support: 0, type_peinture: 0 } },
      { serviceId: "limpeza_final",   qtyPerUnit: 1, modifiers: { niveau: 1 } },
    ],
  },
  {
    id: "pintar_fachada",
    emoji: "🏠",
    name: "Pintar fachada",
    unit: "m² de fachada",
    defaultQty: 40, minQty: 10, maxQty: 400,
    group: "servico",
    description: "Preparo + 2 demãos tinta acrílica externa resistente ao tempo.",
    posts: [
      { serviceId: "prep_superficie", qtyPerUnit: 1, modifiers: { etat: 1 } },
      { serviceId: "pintura_ext",     qtyPerUnit: 1, modifiers: { couches: 0, hauteur: 1 } },
    ],
  },
  {
    id: "trocar_piso",
    emoji: "🔲",
    name: "Trocar piso",
    unit: "m² de piso",
    defaultQty: 15, minQty: 3, maxQty: 200,
    group: "servico",
    description: "Demolir piso antigo + contrapiso + piso cerâmico novo.",
    posts: [
      { serviceId: "demolicao",     qtyPerUnit: 1, modifiers: { materiau: 0, evac: 0 } },
      { serviceId: "contrapiso",    qtyPerUnit: 1, modifiers: { epaisseur: 1 } },
      { serviceId: "piso_ceramico", qtyPerUnit: 1, modifiers: { format: 1, pose: 0 } },
    ],
  },
  {
    id: "trocar_piso_laminado",
    emoji: "🪵",
    name: "Colocar piso laminado",
    unit: "m² de piso",
    defaultQty: 15, minQty: 3, maxQty: 200,
    group: "servico",
    description: "Manta + piso laminado clique 7 mm sobre piso existente nivelado.",
    posts: [
      { serviceId: "piso_laminado", qtyPerUnit: 1, modifiers: { type: 0, manta: 0 } },
      { serviceId: "rodape",        qtyPerUnit: 1.4, modifiers: { materiau: 0 }, note: "Perímetro estimado" },
    ],
  },
  {
    id: "colocar_azulejo",
    emoji: "🧱",
    name: "Colocar azulejo/revestimento",
    unit: "m² de parede",
    defaultQty: 10, minQty: 2, maxQty: 80,
    group: "servico",
    description: "Argamassa AC-II + azulejo + rejunte.",
    posts: [
      { serviceId: "revestimento", qtyPerUnit: 1, modifiers: { format: 1, hauteur: 0 } },
    ],
  },
  {
    id: "instalar_ar",
    emoji: "❄️",
    name: "Instalar ar-condicionado split",
    unit: "aparelho",
    defaultQty: 1, minQty: 1, maxQty: 8,
    group: "servico",
    description: "Ponto elétrico 20A dedicado + tubulação + fixação e teste.",
    posts: [
      { serviceId: "eletrica",         qtyPerUnit: 1, modifiers: { type: 1, chase: 0 } },
      { serviceId: "ar_condicionado",  qtyPerUnit: 1, modifiers: { btu: 1, instal: 0 } },
    ],
  },
  {
    id: "novo_ponto_eletrico",
    emoji: "⚡",
    name: "Novo ponto elétrico",
    unit: "ponto",
    defaultQty: 1, minQty: 1, maxQty: 20,
    group: "servico",
    description: "Tomada, interruptor ou ponto de luz — rasgo de parede + fio + acabamento.",
    posts: [
      { serviceId: "eletrica", qtyPerUnit: 1, modifiers: { type: 0, chase: 0 } },
    ],
  },
  {
    id: "novo_ponto_hidraulico",
    emoji: "🚿",
    name: "Novo ponto hidráulico",
    unit: "ponto",
    defaultQty: 1, minQty: 1, maxQty: 15,
    group: "servico",
    description: "Ponto de água fria (padrão), quente, ou esgoto — rasgo + tubulação PVC.",
    posts: [
      { serviceId: "hidraulica", qtyPerUnit: 1, modifiers: { type: 0 } },
    ],
  },
  {
    id: "instalar_forro",
    emoji: "🔳",
    name: "Instalar forro (teto)",
    unit: "m² de teto",
    defaultQty: 15, minQty: 4, maxQty: 100,
    group: "servico",
    description: "Estrutura metálica + placas de gesso (forro reto ou rebaixado com iluminação).",
    posts: [
      { serviceId: "forro_gesso", qtyPerUnit: 1, modifiers: { type: 0 } },
    ],
  },
  {
    id: "colocar_rodape",
    emoji: "📏",
    name: "Colocar rodapé",
    unit: "m linear",
    defaultQty: 20, minQty: 4, maxQty: 200,
    group: "servico",
    description: "Rodapé MDF branco 7 cm posado e pintado.",
    posts: [
      { serviceId: "rodape", qtyPerUnit: 1, modifiers: { materiau: 0 } },
    ],
  },
  {
    id: "trocar_porta",
    emoji: "🚪",
    name: "Trocar porta",
    unit: "porta",
    defaultQty: 1, minQty: 1, maxQty: 10,
    group: "servico",
    description: "Porta interna madeira 80×210 fornecida + posada (incluindo batente e ferragens).",
    posts: [
      { serviceId: "porta", qtyPerUnit: 1, modifiers: { type: 0 } },
    ],
  },
  {
    id: "trocar_janela",
    emoji: "🪟",
    name: "Trocar janela",
    unit: "janela",
    defaultQty: 1, minQty: 1, maxQty: 10,
    group: "servico",
    description: "Janela alumínio/vidro 1×1 m fornecida + posada.",
    posts: [
      { serviceId: "janela", qtyPerUnit: 1, modifiers: { type: 0 } },
    ],
  },
  {
    id: "impermeabilizar_area",
    emoji: "💧",
    name: "Impermeabilizar área",
    unit: "m² de superfície",
    defaultQty: 10, minQty: 2, maxQty: 100,
    group: "servico",
    description: "Preparo do substrato + 2 demãos de manta líquida ou asfáltica.",
    posts: [
      { serviceId: "impermeabilizacao", qtyPerUnit: 1, modifiers: { couches: 0, zone: 0 } },
    ],
  },

  // ============ ESTRUTURAL ============
  {
    id: "criar_parede",
    emoji: "🧱",
    name: "Criar parede/divisória",
    unit: "m² de parede",
    defaultQty: 6, minQty: 2, maxQty: 40,
    group: "estrutural",
    description: "Alvenaria de tijolo + reboco + preparo para pintura.",
    posts: [
      { serviceId: "alvenaria",       qtyPerUnit: 1, modifiers: { epaisseur: 0 } },
      { serviceId: "prep_superficie", qtyPerUnit: 2, modifiers: { etat: 2 }, note: "Dois lados da parede" },
    ],
  },
  {
    id: "demolir_parede",
    emoji: "💥",
    name: "Demolir parede",
    unit: "m² de parede",
    defaultQty: 8, minQty: 2, maxQty: 50,
    group: "estrutural",
    description: "Demolição tijolo + retirada de gravats + limpeza da área.",
    posts: [
      { serviceId: "demolicao", qtyPerUnit: 1, modifiers: { materiau: 1, evac: 0 } },
    ],
  },
];

export function getMacro(id: string): Macro | undefined {
  return MACROS.find(m => m.id === id);
}

export function getMacrosByGroup(group: MacroGroup): Macro[] {
  return MACROS.filter(m => m.group === group);
}

// Convertit un macro + quantité en liste de ServicePost pour l'estimation.
export function macroToServicePosts(macro: Macro, qty: number): ServicePost[] {
  return macro.posts.map(p => ({
    serviceId: p.serviceId,
    surface: Math.max(0.5, Math.round(p.qtyPerUnit * qty * 10) / 10),
    modifiers: p.modifiers,
    enabled: true,
  }));
}

// Traductions FR discrètes affichées sous les libellés PT-BR.
// Ajoutées séparément pour ne pas surcharger la struct MACROS.
export const MACRO_FR: Record<string, { name: string; unit: string; description: string }> = {
  reforma_cozinha:       { name: "Rénovation complète de cuisine",        unit: "m² de cuisine",       description: "Démolition existant, nouveaux points plomberie/électricité, revêtement, sol et peinture." },
  reforma_banheiro:      { name: "Rénovation complète de salle de bain",  unit: "m² de salle de bain", description: "Refait à neuf : maçonnerie si besoin, étanchéité, plomberie, électricité, revêtement total, sol." },
  reforma_sala:          { name: "Rénovation de salon",                    unit: "m² de salon",         description: "Sol neuf + peinture complète murs/plafond + révision points électriques." },
  reforma_quarto:        { name: "Rénovation de chambre",                  unit: "m² de chambre",       description: "Sol stratifié + peinture complète + points électriques." },
  reforma_home_office:   { name: "Bureau à domicile",                      unit: "m² de bureau",        description: "Sol stratifié + peinture + prises électriques/réseau + éclairage encastré." },
  reforma_apto_completo: { name: "Rénovation complète d'appartement",      unit: "m² total",            description: "Grosse rénovation : salon + chambres + cuisine + SdB. Estimation globale agrégée." },
  pintar_parede:         { name: "Peindre un mur",                         unit: "m² de mur",           description: "Préparation (ponçage + enduit) + 2 couches de peinture acrylique." },
  pintar_comodo:         { name: "Peindre une pièce entière",              unit: "m² de sol",           description: "Préparation + peinture murs (~3× sol) + plafond (~1× sol). Ruban, bâche et nettoyage inclus." },
  pintar_fachada:        { name: "Peindre une façade",                     unit: "m² de façade",        description: "Préparation + 2 couches peinture acrylique extérieure résistante aux intempéries." },
  trocar_piso:           { name: "Changer le sol",                         unit: "m² de sol",           description: "Démolition ancien sol + chape + carrelage neuf." },
  trocar_piso_laminado:  { name: "Poser un sol stratifié",                 unit: "m² de sol",           description: "Sous-couche + parquet stratifié clip 7 mm sur sol existant nivelé." },
  colocar_azulejo:       { name: "Poser du carrelage mural",               unit: "m² de mur",           description: "Colle carrelage AC-II + carreaux + joints." },
  instalar_ar:           { name: "Installer un climatiseur split",         unit: "appareil",            description: "Prise électrique 20A dédiée + tubage + fixation et test." },
  novo_ponto_eletrico:   { name: "Nouveau point électrique",               unit: "point",               description: "Prise, interrupteur ou point lumineux — saignée + fil + finition." },
  novo_ponto_hidraulico: { name: "Nouveau point de plomberie",             unit: "point",               description: "Point eau froide (standard), chaude, ou évacuation — saignée + tuyauterie PVC." },
  instalar_forro:        { name: "Installer un faux-plafond",              unit: "m² de plafond",       description: "Structure métallique + plaques de plâtre (plat ou en retrait avec éclairage)." },
  colocar_rodape:        { name: "Poser des plinthes",                     unit: "m linéaire",          description: "Plinthe MDF blanc 7 cm posée et peinte." },
  trocar_porta:          { name: "Changer une porte",                      unit: "porte",               description: "Porte intérieure bois 80×210 fournie + posée (incluant huisserie et quincaillerie)." },
  trocar_janela:         { name: "Changer une fenêtre",                    unit: "fenêtre",             description: "Fenêtre aluminium/verre 1×1 m fournie + posée." },
  impermeabilizar_area:  { name: "Étanchéifier une zone",                  unit: "m² de surface",       description: "Préparation du support + 2 couches de résine liquide ou bitumineuse." },
  criar_parede:          { name: "Créer une cloison",                       unit: "m² de mur",           description: "Maçonnerie brique + enduit + préparation pour peinture." },
  demolir_parede:        { name: "Démolir un mur",                          unit: "m² de mur",           description: "Démolition brique + évacuation des gravats + nettoyage de la zone." },
};

export function getMacroFr(id: string): { name: string; unit: string; description: string } | undefined {
  return MACRO_FR[id];
}
