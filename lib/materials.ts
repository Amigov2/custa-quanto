// Catalogue matériel réel BR — marques disponibles à Rio (LPK, Obramax, Leroy Merlin).
// Prix moyens observés 2025-2026, à recalibrer depuis prices_observed.js (jade-board) en 1.4.

export type Finish = "economico" | "padrao" | "premium";

export type MaterialLine = {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
};

type MaterialBuilder = (surface: number, finish: Finish) => MaterialLine[];

const line = (name: string, qty: number, unit: string, unitPrice: number): MaterialLine => ({
  name, qty, unit, unitPrice, total: qty * unitPrice,
});

export const MATERIALS: Record<string, MaterialBuilder> = {
  pintura_int: (surface, finish) => {
    const totalL = Math.ceil((surface / 12) * 2 * 10) / 10;
    const cans = Math.ceil(totalL / 3.6);
    const priceCan = finish === "premium" ? 189 : finish === "padrao" ? 132 : 89;
    const brand = finish === "premium" ? "Suvinil Toque de Seda 3.6L" : finish === "padrao" ? "Coral Rende Muito 3.6L" : "Metalatex Econômica 3.6L";
    return [
      line(brand, cans, "lata", priceCan),
      line("Massa corrida PVA Coral 25kg", Math.ceil(surface / 30), "saco", 55),
      line("Selador acrílico Suvinil 3.6L", 1, "lata", 78),
      line("Rolo de lã 23cm + bandeja", 2, "kit", 32),
      line("Fita crepe 48mm × 50m", 3, "rolo", 18),
      line("Lixa nº 100 + espátula", 1, "kit", 28),
      line("Lona plástica 4×5m", 1, "un", 22),
    ];
  },

  piso_ceramico: (surface, finish) => {
    const priceM2 = finish === "premium" ? 89 : finish === "padrao" ? 52 : 34;
    const brand = finish === "premium" ? "Porcelanato Portobello Bianco 90×90" : finish === "padrao" ? "Porcelanato Delta Concreto 60×60" : "Cerâmica Elizabeth 45×45";
    return [
      line(brand, Math.ceil(surface * 1.1), "m²", priceM2),
      line("Argamassa AC-III Quartzolit 20kg", Math.ceil(surface / 5), "saco", 38),
      line("Rejunte Portokoll flexível 5kg", Math.ceil(surface / 12), "saco", 42),
      line("Espaçadores 2mm (500un)", Math.ceil(surface / 20), "pct", 24),
      line("Desempenadeira dentada + esponja", 1, "kit", 68),
    ];
  },

  prep_superficie: (surface) => [
    line("Massa corrida Coral 18L", Math.ceil(surface / 25), "balde", 145),
    line("Lixa d'água nº 220 (10un)", 1, "pct", 32),
    line("Espátula 6\" aço", 2, "un", 22),
  ],

  decapage: (surface) => [
    line("Removedor de tinta 900ml", Math.ceil(surface / 8), "lata", 45),
    line("Espátula raspadora larga", 2, "un", 28),
    line("Máscara + luvas", 1, "kit", 35),
  ],

  contrapiso: (surface) => [
    line("Cimento Nassau 50kg", Math.ceil(surface / 4), "saco", 42),
    line("Areia média (m³)", Math.ceil(surface / 20), "m³", 180),
    line("Brita 1 (saco 20kg)", Math.ceil(surface / 8), "saco", 22),
  ],

  revestimento: (surface, finish) => {
    const priceM2 = finish === "premium" ? 95 : finish === "padrao" ? 58 : 38;
    const brand = finish === "premium" ? "Portobello Metropolitan 60×120" : finish === "padrao" ? "Delta Subway Branco 10×20" : "Cerâmica Incepa 20×20";
    return [
      line(brand, Math.ceil(surface * 1.1), "m²", priceM2),
      line("Argamassa AC-II Quartzolit 20kg", Math.ceil(surface / 5), "saco", 34),
      line("Rejunte Portokoll flexível 2kg", Math.ceil(surface / 15), "saco", 28),
      line("Espaçadores 3mm (500un)", 1, "pct", 24),
    ];
  },
};

export function getMaterials(serviceId: string, surface: number, finish: Finish): MaterialLine[] | null {
  const fn = MATERIALS[serviceId];
  return fn ? fn(surface, finish) : null;
}
