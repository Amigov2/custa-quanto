// SINAPI RJ 2025 — référentiel prix + cadence
// Porté de jade-board (~/Desktop/riachuelo-44/assets/sinapi.js) vers TS le 05/09/2026.
// Source : Sistema Nacional de Pesquisa de Custos e Índices, région Rio de Janeiro.
// Chaque modifier a { label, factor_price, factor_time } où 1.0 = base.

export type ModifierOption = {
  label: string;
  factor_price: number;
  factor_time: number;
};

export type Modifier = {
  id: string;
  label: string;
  options: ModifierOption[];
};

export type Service = {
  id: string;
  name: string;
  cat: string;
  emoji: string;
  min: number;
  max: number;
  daily: number;
  unit: string;
  mo_pct: number;
  modifiers?: Modifier[];
};

export type MacroPost = {
  serviceId: string;
  qtyPerUnit: number;
  mods: Record<string, number>;
};

export type Macro = {
  id: string;
  name: string;
  unit: string;
  description: string;
  posts: MacroPost[];
};

export const SERVICES: Service[] = [
  { id: "prep_canteiro", name: "Préparation canteiro (démarrage)", cat: "Préparation", emoji: "🚧", min: 500, max: 1500, daily: 1, unit: "chantier", mo_pct: 0.80,
    modifiers: [
      { id: "taille", label: "Taille chantier", options: [
        { label: "Petit (1 pièce)", factor_price: 0.6, factor_time: 0.5 },
        { label: "Moyen (appartement)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Grand (étage/immeuble)", factor_price: 1.8, factor_time: 2.0 },
      ]},
      { id: "protection", label: "Protection meubles/sols", options: [
        { label: "Basique (film + papier)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Renforcée (MDF + film + papier kraft)", factor_price: 1.5, factor_time: 1.4 },
      ]},
    ]
  },
  { id: "decapage", name: "Décapage / retrait revêtement", cat: "Préparation", emoji: "🪓", min: 20, max: 60, daily: 25, unit: "m²", mo_pct: 0.85,
    modifiers: [
      { id: "type", label: "Type à retirer", options: [
        { label: "Papier peint / peinture écaillée", factor_price: 0.7, factor_time: 0.7 },
        { label: "Peinture épaisse / massa antiga",  factor_price: 1.0, factor_time: 1.0 },
        { label: "Azulejo / cerâmica (piso ou parede)", factor_price: 1.8, factor_time: 2.0 },
        { label: "Piso vinyl / carpete colé",        factor_price: 1.3, factor_time: 1.4 },
      ]},
    ]
  },
  { id: "prep_superficie", name: "Préparation surface (avant pintura)", cat: "Préparation", emoji: "🧽", min: 15, max: 40, daily: 30, unit: "m²", mo_pct: 0.70,
    modifiers: [
      { id: "etat", label: "État actuel du support", options: [
        { label: "Léger nettoyage + lixamento",  factor_price: 0.6, factor_time: 0.5 },
        { label: "Massa corrida (bouchage trous)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Complet (limpar + massa + selador + lixamento)", factor_price: 1.6, factor_time: 1.7 },
      ]},
    ]
  },
  { id: "limpeza_final", name: "Nettoyage fin de chantier", cat: "Préparation", emoji: "🧹", min: 8, max: 20, daily: 60, unit: "m²", mo_pct: 0.95,
    modifiers: [
      { id: "niveau", label: "Niveau de nettoyage", options: [
        { label: "Balayage + poussière",        factor_price: 0.5, factor_time: 0.5 },
        { label: "Standard (aspirador + lavage)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Fine (vitres + détail + polissage piso)", factor_price: 1.6, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "cimento_queimado", name: "Cimento queimado", cat: "Pisos", emoji: "⬛", min: 120, max: 250, daily: 8, unit: "m²", mo_pct: 0.45,
    modifiers: [
      { id: "couches", label: "Camadas de resina", options: [
        { label: "1 camada (économico)", factor_price: 0.85, factor_time: 0.8 },
        { label: "2 camadas (standard)",  factor_price: 1.0,  factor_time: 1.0 },
        { label: "3 camadas (premium brillant)", factor_price: 1.3, factor_time: 1.4 },
      ]},
      { id: "prep", label: "Préparation support", options: [
        { label: "Contrapiso neuf", factor_price: 1.0, factor_time: 1.0 },
        { label: "Support à niveler (+ auto-nivelant)", factor_price: 1.4, factor_time: 1.5 },
      ]},
    ]
  },
  { id: "contrapiso", name: "Contrapiso (chape)", cat: "Pisos", emoji: "🏗️", min: 45, max: 80, daily: 15, unit: "m²", mo_pct: 0.35,
    modifiers: [
      { id: "epaisseur", label: "Épaisseur", options: [
        { label: "3 cm",   factor_price: 0.75, factor_time: 0.8 },
        { label: "5 cm (standard)", factor_price: 1.0, factor_time: 1.0 },
        { label: "8 cm",   factor_price: 1.35, factor_time: 1.3 },
        { label: "10+ cm (renforcé)", factor_price: 1.7, factor_time: 1.6 },
      ]},
    ]
  },
  { id: "piso_ceramico", name: "Piso cerâmico / porcelanato", cat: "Pisos", emoji: "🔲", min: 80, max: 200, daily: 12, unit: "m²", mo_pct: 0.30,
    modifiers: [
      { id: "format", label: "Format des dalles", options: [
        { label: "45×45 (petit)",         factor_price: 0.85, factor_time: 0.85 },
        { label: "60×60 (standard)",      factor_price: 1.0,  factor_time: 1.0  },
        { label: "80×80 ou 90×90 (grand)",factor_price: 1.15, factor_time: 1.15 },
        { label: "120×60 ou plus (XXL)",  factor_price: 1.35, factor_time: 1.4  },
      ]},
      { id: "pose", label: "Type de pose", options: [
        { label: "Pose droite (standard)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Pose diagonale",         factor_price: 1.2, factor_time: 1.3 },
        { label: "Pose motifs (chevron/damier)", factor_price: 1.5, factor_time: 1.7 },
      ]},
    ]
  },
  { id: "pintura_int", name: "Pintura interna", cat: "Finitions", emoji: "🖌️", min: 40, max: 70, daily: 20, unit: "m²", mo_pct: 0.50,
    modifiers: [
      { id: "couches", label: "Nombre de couches", options: [
        { label: "1 couche (rapide)",    factor_price: 0.6, factor_time: 0.5 },
        { label: "2 couches (standard)", factor_price: 1.0, factor_time: 1.0 },
        { label: "3 couches (mur foncé/tache)", factor_price: 1.5, factor_time: 1.4 },
      ]},
      { id: "support", label: "État du support", options: [
        { label: "Neuf ou repeint récemment", factor_price: 1.0, factor_time: 1.0 },
        { label: "Massa corrida à passer", factor_price: 1.35, factor_time: 1.5 },
        { label: "Ancien + fissures/moisi",  factor_price: 1.7, factor_time: 2.0 },
      ]},
      { id: "type_peinture", label: "Type de peinture", options: [
        { label: "PVA/Acrilica standard", factor_price: 1.0, factor_time: 1.0 },
        { label: "Acrilica premium (Suvinil, Coral)", factor_price: 1.3, factor_time: 1.0 },
        { label: "Epóxi ou spéciale", factor_price: 1.8, factor_time: 1.2 },
      ]},
    ]
  },
  { id: "pintura_ext", name: "Pintura externa / fachada", cat: "Finitions", emoji: "🏠", min: 50, max: 90, daily: 15, unit: "m²", mo_pct: 0.55,
    modifiers: [
      { id: "couches", label: "Nombre de couches", options: [
        { label: "2 couches (standard)", factor_price: 1.0, factor_time: 1.0 },
        { label: "3 couches (protection maximale)", factor_price: 1.4, factor_time: 1.35 },
      ]},
      { id: "hauteur", label: "Hauteur/accès", options: [
        { label: "Jusqu'à 3 m (échelle)",   factor_price: 1.0, factor_time: 1.0 },
        { label: "3-8 m (échafaudage simple)", factor_price: 1.35, factor_time: 1.4 },
        { label: "8 m+ (échafaudage lourd)",  factor_price: 1.8, factor_time: 1.9 },
      ]},
    ]
  },
  { id: "revestimento", name: "Revestimento parede (azulejo)", cat: "Finitions", emoji: "🧱", min: 80, max: 180, daily: 10, unit: "m²", mo_pct: 0.40,
    modifiers: [
      { id: "format", label: "Format", options: [
        { label: "10×10 ou 15×15 (subway)", factor_price: 1.15, factor_time: 1.3 },
        { label: "30×60 (standard)",         factor_price: 1.0,  factor_time: 1.0 },
        { label: "60×120 (grand format)",    factor_price: 1.25, factor_time: 1.2 },
      ]},
      { id: "hauteur", label: "Zone", options: [
        { label: "Banheiro standard",  factor_price: 1.0, factor_time: 1.0 },
        { label: "Meia parede cuisine", factor_price: 0.9, factor_time: 0.9 },
        { label: "Toda parede (do chão ao teto)", factor_price: 1.15, factor_time: 1.2 },
      ]},
    ]
  },
  { id: "eletrica", name: "Elétrica – ponto", cat: "Instalações", emoji: "⚡", min: 150, max: 350, daily: 4, unit: "ponto", mo_pct: 0.40,
    modifiers: [
      { id: "type", label: "Type de ponto", options: [
        { label: "Tomada 10A (standard)",    factor_price: 1.0,  factor_time: 1.0 },
        { label: "Tomada 20A (chuveiro/ar)", factor_price: 1.3,  factor_time: 1.1 },
        { label: "Interruptor simple",       factor_price: 0.85, factor_time: 0.9 },
        { label: "Ponto de luz (teto)",      factor_price: 1.15, factor_time: 1.15 },
        { label: "Rede lógica/RJ45",         factor_price: 1.4,  factor_time: 1.3 },
      ]},
      { id: "chase", label: "Instalação", options: [
        { label: "Embutida (rasgo parede)",  factor_price: 1.0, factor_time: 1.0 },
        { label: "Sobreposta (calha/moldura)", factor_price: 0.75, factor_time: 0.6 },
      ]},
    ]
  },
  { id: "hidraulica", name: "Hidráulica – ponto", cat: "Instalações", emoji: "🚿", min: 200, max: 500, daily: 3, unit: "ponto", mo_pct: 0.45,
    modifiers: [
      { id: "type", label: "Type", options: [
        { label: "Água fria (standard)",  factor_price: 1.0, factor_time: 1.0 },
        { label: "Água fria + quente",    factor_price: 1.6, factor_time: 1.5 },
        { label: "Esgoto (100 mm)",       factor_price: 1.3, factor_time: 1.3 },
      ]},
    ]
  },
  { id: "forro_gesso", name: "Forro de gesso", cat: "Finitions", emoji: "🔳", min: 60, max: 120, daily: 15, unit: "m²", mo_pct: 0.45,
    modifiers: [
      { id: "type", label: "Type", options: [
        { label: "Reto (simple)",           factor_price: 1.0, factor_time: 1.0 },
        { label: "Rebaixado + iluminação",  factor_price: 1.4, factor_time: 1.4 },
        { label: "Sancado/moldura décorée", factor_price: 1.7, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "alvenaria", name: "Alvenaria (parede nova)", cat: "Structure", emoji: "🧱", min: 100, max: 200, daily: 8, unit: "m²", mo_pct: 0.40,
    modifiers: [
      { id: "epaisseur", label: "Épaisseur", options: [
        { label: "½ tijolo (9 cm) - separação leve",  factor_price: 0.8, factor_time: 0.85 },
        { label: "1 tijolo (14 cm) - standard",       factor_price: 1.0, factor_time: 1.0  },
        { label: "1½ tijolo (19 cm) - structurelle",  factor_price: 1.4, factor_time: 1.35 },
      ]},
    ]
  },
  { id: "demolicao", name: "Demolição", cat: "Structure", emoji: "💥", min: 30, max: 80, daily: 20, unit: "m²", mo_pct: 0.80,
    modifiers: [
      { id: "materiau", label: "Type de mur", options: [
        { label: "Cloison legère (drywall/gesso)", factor_price: 0.5, factor_time: 0.5 },
        { label: "Tijolo (parede standard)",       factor_price: 1.0, factor_time: 1.0 },
        { label: "Béton armé (dalle/pilier)",      factor_price: 2.5, factor_time: 3.0 },
      ]},
      { id: "evac", label: "Évacuation des gravats", options: [
        { label: "Incluse au poste",       factor_price: 1.0, factor_time: 1.0 },
        { label: "Grande volumétrie (+ camion)", factor_price: 1.4, factor_time: 1.2 },
      ]},
    ]
  },
  { id: "impermeabilizacao", name: "Impermeabilização", cat: "Finitions", emoji: "💧", min: 50, max: 120, daily: 10, unit: "m²", mo_pct: 0.45,
    modifiers: [
      { id: "couches", label: "Nombre de couches", options: [
        { label: "2 couches (standard)",         factor_price: 1.0, factor_time: 1.0 },
        { label: "3 couches (garantie longue)",  factor_price: 1.35, factor_time: 1.35 },
      ]},
      { id: "zone", label: "Zone", options: [
        { label: "Laje/toiture plate",     factor_price: 1.0, factor_time: 1.0 },
        { label: "Banheiro/box douche",    factor_price: 0.9, factor_time: 1.0 },
        { label: "Piscina/reservatório",   factor_price: 1.4, factor_time: 1.5 },
      ]},
    ]
  },
  { id: "porta", name: "Porte (fournie + posée)", cat: "Structure", emoji: "🚪", min: 400, max: 1200, daily: 1, unit: "unité", mo_pct: 0.25,
    modifiers: [
      { id: "type", label: "Type", options: [
        { label: "Interne bois standard (80×210)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Externe acier renforcé",         factor_price: 1.5, factor_time: 1.3 },
        { label: "Vitrée coulissante alu",         factor_price: 2.0, factor_time: 1.5 },
        { label: "Blindée (segurança)",            factor_price: 2.8, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "janela", name: "Fenêtre (fournie + posée)", cat: "Structure", emoji: "🪟", min: 600, max: 2000, daily: 1, unit: "unité", mo_pct: 0.20,
    modifiers: [
      { id: "type", label: "Type", options: [
        { label: "Alu/verre standard (1×1 m)",     factor_price: 1.0, factor_time: 1.0 },
        { label: "Grande baie (2×1.5 m)",          factor_price: 1.6, factor_time: 1.4 },
        { label: "PVC/blindé haute performance",   factor_price: 1.9, factor_time: 1.5 },
      ]},
    ]
  },
  { id: "rodape", name: "Rodapé (plinthe)", cat: "Finitions", emoji: "📏", min: 15, max: 60, daily: 40, unit: "m linéaire", mo_pct: 0.30,
    modifiers: [
      { id: "materiau", label: "Matériau", options: [
        { label: "MDF branco 7 cm",                     factor_price: 1.0, factor_time: 1.0 },
        { label: "Poliestireno auto-adesivo",           factor_price: 0.7, factor_time: 0.5 },
        { label: "Madeira maciça / freijó",             factor_price: 2.2, factor_time: 1.3 },
        { label: "Porcelanato / mármore",               factor_price: 3.0, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "marmore_granito", name: "Mármore / granito (pierre naturelle)", cat: "Finitions", emoji: "🪨", min: 400, max: 1500, daily: 6, unit: "m²", mo_pct: 0.35,
    modifiers: [
      { id: "type", label: "Application", options: [
        { label: "Bancada cozinha/banheiro",            factor_price: 1.0, factor_time: 1.0 },
        { label: "Soleira / peitoril fenêtre",          factor_price: 0.6, factor_time: 0.7 },
        { label: "Revêtement mural (parede)",           factor_price: 1.3, factor_time: 1.4 },
        { label: "Piso (grand format)",                 factor_price: 1.4, factor_time: 1.5 },
      ]},
      { id: "materiau", label: "Pierre", options: [
        { label: "Granito standard (Verde Ubatuba)",    factor_price: 1.0, factor_time: 1.0 },
        { label: "Mármore Branco Espírito Santo",       factor_price: 1.5, factor_time: 1.0 },
        { label: "Quartzo/silestone (composite)",       factor_price: 2.2, factor_time: 0.9 },
      ]},
    ]
  },
  { id: "piso_laminado", name: "Piso laminado / vinílico", cat: "Pisos", emoji: "🪵", min: 40, max: 150, daily: 25, unit: "m²", mo_pct: 0.35,
    modifiers: [
      { id: "type", label: "Type de piso", options: [
        { label: "Laminado clique 7 mm (bois recon.)",  factor_price: 1.0, factor_time: 1.0 },
        { label: "Vinílico LVT clique 4 mm",            factor_price: 1.2, factor_time: 0.9 },
        { label: "Vinílico auto-adesivo (colle)",       factor_price: 0.9, factor_time: 1.2 },
        { label: "Deck ext. WPC / bois exotique",       factor_price: 2.5, factor_time: 1.8 },
      ]},
      { id: "manta", label: "Sous-couche", options: [
        { label: "Manta acústica 3 mm (standard)",      factor_price: 1.0, factor_time: 1.0 },
        { label: "Sans (colle directe)",                factor_price: 0.9, factor_time: 0.9 },
      ]},
    ]
  },
  { id: "ar_condicionado", name: "Ar condicionado split (préparation + pose)", cat: "Instalações", emoji: "❄️", min: 800, max: 2500, daily: 1.5, unit: "unité", mo_pct: 0.40,
    modifiers: [
      { id: "btu", label: "Capacité", options: [
        { label: "9.000 BTU (petit quarto)",            factor_price: 1.0, factor_time: 1.0 },
        { label: "12.000 BTU (quarto/sala pequena)",    factor_price: 1.1, factor_time: 1.0 },
        { label: "18.000-24.000 BTU (sala grande)",     factor_price: 1.4, factor_time: 1.2 },
        { label: "Multi-split (2-4 evaporadoras)",      factor_price: 2.5, factor_time: 2.0 },
      ]},
      { id: "instal", label: "Complexité pose", options: [
        { label: "Standard (parede adjacente)",         factor_price: 1.0, factor_time: 1.0 },
        { label: "Tuyauterie longue (>4m)",             factor_price: 1.3, factor_time: 1.4 },
        { label: "Cassette embutido (forro)",           factor_price: 1.8, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "marcenaria", name: "Marcenaria sur mesure (armários)", cat: "Finitions", emoji: "🔨", min: 700, max: 2500, daily: 2, unit: "m²", mo_pct: 0.55,
    modifiers: [
      { id: "type", label: "Type d'armoire", options: [
        { label: "Cozinha modulos base + top",          factor_price: 1.0, factor_time: 1.0 },
        { label: "Guarda-roupa quarto",                 factor_price: 0.9, factor_time: 1.0 },
        { label: "Closet planejado",                    factor_price: 1.4, factor_time: 1.4 },
        { label: "Home theater / bibliothèque",         factor_price: 1.3, factor_time: 1.3 },
      ]},
      { id: "material", label: "Matériau finition", options: [
        { label: "MDF melamínico blanc/bois",           factor_price: 1.0, factor_time: 1.0 },
        { label: "MDF laqué brillant",                  factor_price: 1.6, factor_time: 1.2 },
        { label: "MDF folheado madeira nobre",          factor_price: 2.2, factor_time: 1.3 },
      ]},
    ]
  },
  { id: "vidro_espelho", name: "Vidro / espelho / box banheiro", cat: "Finitions", emoji: "🪞", min: 150, max: 700, daily: 4, unit: "m²", mo_pct: 0.30,
    modifiers: [
      { id: "type", label: "Application", options: [
        { label: "Espelho 4 mm bisotê (banheiro)",      factor_price: 1.0, factor_time: 1.0 },
        { label: "Box banheiro 8 mm incolor",           factor_price: 1.8, factor_time: 1.4 },
        { label: "Divisória ambientes (temperado 10)",  factor_price: 2.2, factor_time: 1.6 },
        { label: "Guardacorpo terrasse (temperado 12)", factor_price: 2.8, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "forro_pvc", name: "Forro PVC (plafond léger)", cat: "Finitions", emoji: "🔲", min: 35, max: 80, daily: 25, unit: "m²", mo_pct: 0.40,
    modifiers: [
      { id: "type", label: "Type", options: [
        { label: "PVC branco standard (100 mm)",        factor_price: 1.0, factor_time: 1.0 },
        { label: "PVC imitação madeira",                factor_price: 1.4, factor_time: 1.1 },
        { label: "Isolant acústique intégré",           factor_price: 1.7, factor_time: 1.3 },
      ]},
    ]
  },
  { id: "cimento_queimado", name: "Cimento queimado", cat: "Pisos", emoji: "⬛", min: 120, max: 250, daily: 8, unit: "m²", mo_pct: 0.45,
    modifiers: [
      { id: "couches", label: "Camadas de resina", options: [
        { label: "1 camada (économico)",         factor_price: 0.85, factor_time: 0.8 },
        { label: "2 camadas (standard)",         factor_price: 1.0,  factor_time: 1.0 },
        { label: "3 camadas (premium brillant)", factor_price: 1.3,  factor_time: 1.4 },
      ]},
      { id: "prep", label: "Préparation support", options: [
        { label: "Contrapiso neuf",                     factor_price: 1.0, factor_time: 1.0 },
        { label: "Support à niveler (+ auto-nivelant)", factor_price: 1.4, factor_time: 1.5 },
      ]},
    ]
  },
  { id: "serralheria", name: "Serralheria (portão/grade/guarda-corpo)", cat: "Structure", emoji: "⚙️", min: 350, max: 1200, daily: 3, unit: "m²", mo_pct: 0.35,
    modifiers: [
      { id: "type", label: "Ouvrage", options: [
        { label: "Grade simple/janela (aço 3/8)",        factor_price: 1.0, factor_time: 1.0 },
        { label: "Portão automatique (deslizante)",      factor_price: 2.5, factor_time: 2.0 },
        { label: "Guarda-corpo escada/mezanino",         factor_price: 1.8, factor_time: 1.5 },
        { label: "Escada metálica interna (m linéaire)", factor_price: 3.2, factor_time: 2.5 },
      ]},
      { id: "acabamento", label: "Finition", options: [
        { label: "Peinture antirouille (standard)",     factor_price: 1.0, factor_time: 1.0 },
        { label: "Pintura eletrostática (poudre four)", factor_price: 1.5, factor_time: 1.2 },
        { label: "Inox / alu anodisé",                  factor_price: 2.5, factor_time: 1.3 },
      ]},
    ]
  },
  { id: "escada", name: "Escada (concreto/madeira/inox)", cat: "Structure", emoji: "🪜", min: 3500, max: 15000, daily: 0.3, unit: "unité", mo_pct: 0.40,
    modifiers: [
      { id: "type", label: "Type d'escada", options: [
        { label: "Concreto armado (fôrma + fer + concreto)", factor_price: 1.0, factor_time: 1.0 },
        { label: "Madeira maciça freijó (design)",           factor_price: 1.5, factor_time: 0.7 },
        { label: "Metalica inox (design premium)",           factor_price: 2.5, factor_time: 0.6 },
        { label: "Caracol pré-fabriquée",                    factor_price: 0.8, factor_time: 0.3 },
      ]},
      { id: "altura", label: "Hauteur à franchir", options: [
        { label: "Petite (~2 m — 8-10 marches)",             factor_price: 1.0, factor_time: 1.0 },
        { label: "Standard (2,8-3 m — 14-16 marches)",       factor_price: 1.3, factor_time: 1.3 },
        { label: "Double étage (~5-6 m)",                    factor_price: 1.9, factor_time: 1.8 },
      ]},
    ]
  },
  { id: "chamine", name: "Chaminé / exaustão (pizzeria/restaurant)", cat: "Instalações", emoji: "🔥", min: 400, max: 1500, daily: 3, unit: "m linéaire", mo_pct: 0.45,
    modifiers: [
      { id: "type", label: "Type de conduit", options: [
        { label: "Duto galvanisé Ø 200 mm (standard)",       factor_price: 1.0, factor_time: 1.0 },
        { label: "Duto inox 304 Ø 250 mm (pizzeria)",        factor_price: 1.8, factor_time: 1.2 },
        { label: "Duto inox 316 Ø 300+ mm (haute temp)",     factor_price: 2.6, factor_time: 1.4 },
      ]},
      { id: "acesso", label: "Accès/hauteur", options: [
        { label: "Interne bâtiment (<10 m)",                 factor_price: 1.0, factor_time: 1.0 },
        { label: "Fachade + travaux en hauteur (10-15 m)",   factor_price: 1.5, factor_time: 1.7 },
        { label: "Grande hauteur (>15 m)",                   factor_price: 2.2, factor_time: 2.5 },
      ]},
    ]
  },
  { id: "bancada", name: "Bancada / balcão (bar comptoir)", cat: "Structure", emoji: "🍹", min: 800, max: 3500, daily: 1.2, unit: "m linéaire", mo_pct: 0.35,
    modifiers: [
      { id: "materiau", label: "Matériau", options: [
        { label: "Tijolo + reboco (base à peindre)",    factor_price: 1.0, factor_time: 1.0 },
        { label: "Tijolo + azulejo façade",             factor_price: 1.5, factor_time: 1.5 },
        { label: "Tijolo + mármore/granito top",        factor_price: 2.3, factor_time: 1.8 },
        { label: "MDF/marcenaria pré-fabriquée",        factor_price: 3.0, factor_time: 0.6 },
      ]},
      { id: "hauteur", label: "Hauteur", options: [
        { label: "Standard (0,90-1,10 m — comptoir)",   factor_price: 1.0, factor_time: 1.0 },
        { label: "Bar haut (1,10-1,30 m)",              factor_price: 1.1, factor_time: 1.1 },
      ]},
    ]
  },
];

export const CATEGORIES = [
  { id: "Préparation",  label: "Preparo",     desc: "Demolição, decapagem, limpeza" },
  { id: "Pisos",        label: "Pisos",       desc: "Cerâmica, cimento, contrapiso" },
  { id: "Structure",    label: "Estrutura",   desc: "Alvenaria, laje, demolição" },
  { id: "Instalações",  label: "Instalações", desc: "Elétrica, hidráulica, ar" },
  { id: "Finitions",    label: "Acabamentos", desc: "Pintura, gesso, revestimento" },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find(s => s.id === id);
}

export function getServicesByCategory(cat: string): Service[] {
  return SERVICES.filter(s => s.cat === cat);
}
