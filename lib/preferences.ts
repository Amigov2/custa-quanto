// Boucle apprentissage : préférences user extraites depuis toutes les sources existantes.
// Contrairement aux learnings (corrections explicites) et feedbacks (prix payé), les
// préférences sont dérivées passivement : mots-clés récurrents dans les chats, scopes,
// notes de feedback, patterns dans les chantiers créés.
//
// Injectées dans les prompts Vision + Chat pour personnaliser les suggestions.

import { loadPhotos } from "./photo_history";
import { loadFeedbacks } from "./price_feedback";

// Marques BR connues qu'on cherche dans les textes. Priorité aux marques les plus courantes.
const KNOWN_BRANDS = [
  // Peinture
  "Coral", "Suvinil", "Sherwin-Williams", "Renner", "Eucatex", "Lukscolor",
  // Impermeabilisation / adhésifs
  "Sika", "Vedacit", "Denver", "Quartzolit", "Votomassa", "Bianco",
  // Céramique / revêtement
  "Portobello", "Eliane", "Cecrisa", "Ceusa", "Incefra",
  // Hydraulique
  "Tigre", "Amanco", "Krona", "Deca", "Docol", "Roca",
  // Électrique
  "Pial", "Iriel", "Ilumi", "Cobrecom", "Sil", "Prysmian",
  // Menuiserie / vidro
  "Sasazaki", "Blindex", "Guarnieri",
];

// Styles/gammes courants
const STYLE_KEYWORDS = [
  "moderno", "modern", "rústico", "rustique", "escandinavo", "scandinave",
  "industrial", "industriel", "minimalista", "minimaliste", "clean",
  "vintage", "retro", "boho", "boêmio", "provençal", "provencal",
  "premium", "luxo", "luxe", "sofisticado",
  "econômico", "econômica", "barato", "simples", "low cost",
];

const BUDGET_KEYWORDS = [
  "barato", "econômico", "econômica", "low cost", "apertado", "orçamento apertado",
  "premium", "luxo", "luxe", "sem limite", "sem economia",
];

type PreferenceSummary = {
  favoriteBrands: string[];    // top 5 marques mentionnées
  styleHints: string[];        // styles mentionnés
  budgetHint: "econômico" | "medio" | "premium" | null;
  recurrentAmbientes: { ambiente: string; count: number }[];  // top 3
  avgPaidBRL: number | null;   // moyenne des chantiers finalisés
  totalSignal: number;         // nombre de sources qui ont contribué
};

// Analyse toutes les sources locales et extrait les préférences.
export function computePreferences(): PreferenceSummary {
  const photos = loadPhotos();
  const feedbacks = loadFeedbacks();

  // 1. Rassemble tous les textes libres (scopes + chats + notes feedbacks).
  const texts: string[] = [];
  photos.forEach(p => {
    if (p.userScope) texts.push(p.userScope);
    if (p.chatHistory) p.chatHistory.forEach(m => texts.push(m.content));
  });
  feedbacks.forEach(f => {
    if (f.notes) texts.push(f.notes);
  });
  const bigText = texts.join(" ").toLowerCase();

  // 2. Marques mentionnées (par fréquence).
  const brandCounts: Record<string, number> = {};
  KNOWN_BRANDS.forEach(brand => {
    const re = new RegExp(`\\b${brand.toLowerCase().replace(/[-]/g, "\\-")}\\b`, "gi");
    const matches = bigText.match(re);
    if (matches && matches.length > 0) brandCounts[brand] = matches.length;
  });
  const favoriteBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([b]) => b);

  // 3. Styles mentionnés.
  const styleHints: string[] = [];
  STYLE_KEYWORDS.forEach(kw => {
    if (bigText.includes(kw) && !styleHints.includes(kw)) styleHints.push(kw);
  });

  // 4. Signal budget (mots-clés + niveau moyen des acabamentos éventuellement).
  let budgetHint: PreferenceSummary["budgetHint"] = null;
  const econSignals = ["barato", "econômico", "econômica", "low cost", "apertado"].filter(k => bigText.includes(k)).length;
  const premSignals = ["premium", "luxo", "luxe", "sofisticado", "sem limite"].filter(k => bigText.includes(k)).length;
  if (premSignals > econSignals && premSignals > 0) budgetHint = "premium";
  else if (econSignals > premSignals && econSignals > 0) budgetHint = "econômico";
  else if (econSignals > 0 || premSignals > 0) budgetHint = "medio";

  // 5. Ambientes récurrents (parmi les analyses photos).
  const ambCounts: Record<string, number> = {};
  photos.forEach(p => {
    const a = p.analysis.ambiente;
    ambCounts[a] = (ambCounts[a] || 0) + 1;
  });
  const recurrentAmbientes = Object.entries(ambCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ambiente, count]) => ({ ambiente, count }));

  // 6. Budget moyen (moyenne des chantiers finalisés).
  const avgPaidBRL = feedbacks.length > 0
    ? Math.round(feedbacks.reduce((s, f) => s + f.totalPaid, 0) / feedbacks.length)
    : null;

  const totalSignal =
    favoriteBrands.length + styleHints.length +
    (budgetHint ? 1 : 0) + recurrentAmbientes.length +
    (avgPaidBRL ? 1 : 0);

  return { favoriteBrands, styleHints, budgetHint, recurrentAmbientes, avgPaidBRL, totalSignal };
}

// Résumé natural language pour injection dans les prompts Vision + Chat.
// Retourne "" si trop peu de signal (< 3 sources).
export function summarizePreferences(): string {
  const p = computePreferences();
  if (p.totalSignal < 3) return "";

  const lines: string[] = [];
  if (p.favoriteBrands.length > 0) {
    lines.push(`- Marcas favoritas : ${p.favoriteBrands.join(", ")}. Priorize essas marcas quando sugerir produtos.`);
  }
  if (p.styleHints.length > 0) {
    lines.push(`- Estilos mencionados : ${p.styleHints.slice(0, 3).join(", ")}. Alinhe as sugestões nesse sentido.`);
  }
  if (p.budgetHint) {
    const budgetMap = {
      "econômico": "orçamento apertado — favoreça soluções baratas e evite premium",
      "medio": "orçamento médio — proponha soluções padrão",
      "premium": "orçamento premium — priorize qualidade sobre preço",
    };
    lines.push(`- Perfil de orçamento : ${budgetMap[p.budgetHint]}.`);
  }
  if (p.recurrentAmbientes.length >= 2) {
    const list = p.recurrentAmbientes.map(a => `${a.ambiente} (${a.count}×)`).join(", ");
    lines.push(`- Ambientes trabalhados recentemente : ${list}.`);
  }
  if (p.avgPaidBRL && p.avgPaidBRL > 0) {
    lines.push(`- Faixa de gasto habitual : ~R$ ${p.avgPaidBRL.toLocaleString("pt-BR")} por chantier (média dos finalizados).`);
  }

  if (lines.length === 0) return "";
  return `\n\nPREFERÊNCIAS DO USUÁRIO (aplique quando relevante) :\n${lines.join("\n")}\n`;
}

// Compteur pour affichage UI (badge "N préférences détectées").
export function countPreferenceSignals(): number {
  return computePreferences().totalSignal;
}
