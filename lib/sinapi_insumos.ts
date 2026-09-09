// SINAPI — base d'insumos importée depuis okelvynsantana/sinapi-spreadsheet-to-json (~2021).
// À rafraîchir avec dernier SINAPI Caixa (média nacional actuellement, RJ dans phase 3).

import raw from "../data/sinapi_insumos.json";

export type SinapiCategoria =
  | "tinta"
  | "imperm"
  | "revestimento"
  | "argamassa"
  | "esquadria"
  | "hidraulica"
  | "eletrica"
  | "ferragem"
  | "madeira"
  | "alvenaria"
  | "outro";

export type SinapiInsumo = {
  codigo: string;
  descricao: string;
  und: string;
  preco: number;
  categoria: SinapiCategoria;
};

export const SINAPI_INSUMOS = raw as SinapiInsumo[];

export const SINAPI_INDEX: Map<string, SinapiInsumo> = new Map(
  SINAPI_INSUMOS.map(i => [i.codigo, i]),
);

const STOP = new Set(["de", "da", "do", "para", "com", "em", "e", "a", "o", "as", "os", "por"]);

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokens(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
}

// Recherche keyword dans la description SINAPI. Retourne les meilleurs matchs (par overlap).
// Optionnel : filtrer par catégorie pour éviter les faux positifs cross-catégorie.
export function searchSinapi(query: string, limit = 3, categoria?: SinapiCategoria): SinapiInsumo[] {
  const words = tokens(query);
  if (!words.length) return [];

  const scored = SINAPI_INSUMOS
    .filter(i => !categoria || i.categoria === categoria)
    .map(i => {
      const desc = normalize(i.descricao);
      const score = words.reduce((s, w) => s + (desc.includes(w) ? 1 : 0), 0);
      return { insumo: i, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      a.insumo.descricao.length - b.insumo.descricao.length,
    );

  return scored.slice(0, limit).map(x => x.insumo);
}
