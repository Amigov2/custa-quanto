// Génération d'un récap partageable sur WhatsApp depuis l'analyse photo.
// Format optimisé WA : bold *, italic _, listes emoji. Cap 2000 chars pour rester dans les limites URL.

import type { PhotoAnalysis } from "./vision";

const AMBIENTE_EMOJI: Record<PhotoAnalysis["ambiente"], string> = {
  cozinha: "🍳", banheiro: "🚽", sala: "🛋️", quarto: "🛏️",
  escritorio: "💼", fachada: "🏠", area_externa: "🌳", outro: "📐",
};

const AMBIENTE_LABEL: Record<PhotoAnalysis["ambiente"], string> = {
  cozinha: "Cozinha", banheiro: "Banheiro", sala: "Sala", quarto: "Quarto",
  escritorio: "Escritório", fachada: "Fachada", area_externa: "Área externa", outro: "Ambiente",
};

export function generateWhatsAppSummary(analysis: PhotoAnalysis, m2: number): string {
  const parts: string[] = [];
  const emoji = AMBIENTE_EMOJI[analysis.ambiente];
  const label = AMBIENTE_LABEL[analysis.ambiente];

  parts.push(`${emoji} *${label}${m2 > 0 ? ` — ${m2} m²` : ""}*`);
  parts.push("");

  // Itens críticos détectés (top 3 gravidade grave/medio)
  const criticos = analysis.itens_detectados
    .filter(i => i.gravidade === "grave" || i.gravidade === "medio")
    .slice(0, 3);
  if (criticos.length > 0) {
    parts.push("⚠️ *Detectado:*");
    criticos.forEach(i => parts.push(`• ${i.tipo}`));
    parts.push("");
  }

  // Passo a passo (top 5)
  if (analysis.passo_a_passo.length > 0) {
    parts.push("📋 *O que fazer:*");
    analysis.passo_a_passo.slice(0, 5).forEach(s => {
      parts.push(`${s.passo}. ${s.titulo}`);
    });
    parts.push("");
  }

  // Shopping list avec quantités calculées + prix estimé
  if (analysis.produtos_recomendados.length > 0 && m2 > 0) {
    parts.push("🛒 *Comprar:*");
    let totalMaterial = 0;
    analysis.produtos_recomendados.forEach(prod => {
      const rend = prod.rendimento_m2_por_unidade || 1;
      const margem = (prod.margem_recomendada_pct || 10) / 100;
      const qtd = Math.ceil((m2 * (1 + margem)) / rend);
      const avg = prod.sinapi_matches?.length
        ? prod.sinapi_matches.reduce((s, m) => s + m.preco, 0) / prod.sinapi_matches.length
        : 0;
      const preco = Math.round(avg * m2);
      totalMaterial += preco;
      const marcas = prod.marcas_br.slice(0, 2).join(" / ");
      const precoStr = preco > 0 ? ` ≈ R$ ${preco.toLocaleString("pt-BR")}` : "";
      parts.push(`• ${qtd}× ${prod.unidade_comercial} — ${prod.nome}${marcas ? ` (${marcas})` : ""}${precoStr}`);
    });
    if (totalMaterial > 0) {
      parts.push(`━━━━━━━━━━`);
      parts.push(`💰 *Total materiais: R$ ${totalMaterial.toLocaleString("pt-BR")}*`);
      parts.push(`_(base SINAPI — comparar com Obramax/LPK)_`);
    }
    parts.push("");
  }

  // Warnings importantes (max 2)
  if (analysis.observacoes.length > 0) {
    parts.push("💡 *Observações:*");
    analysis.observacoes.slice(0, 2).forEach(o => parts.push(`• ${o}`));
    parts.push("");
  }

  parts.push(`📱 _Analisado com Custa Quanto_`);

  let text = parts.join("\n");

  // Cap à 2000 chars pour WhatsApp URL safety
  if (text.length > 2000) {
    text = text.slice(0, 1990) + "…";
  }

  return text;
}

export function whatsAppShareUrl(text: string): string {
  // wa.me marche mobile + desktop, WhatsApp Web ouvre automatiquement.
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Partage natif via Web Share API (iOS/Android). Inclut la photo si passée + supportée par l'OS.
// Retourne true si le partage a été déclenché, false si fallback nécessaire.
export async function shareWithSystem(text: string, photo?: File | null): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;

  // Avec fichier + texte : la sheet iOS/Android propose WhatsApp, iMessage, Email, etc.
  if (photo && typeof navigator.canShare === "function") {
    try {
      const payload: ShareData = { text, files: [photo] };
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
        return true;
      }
    } catch (e) {
      void e;
      // fallthrough → tentative sans fichier
    }
  }

  // Fallback : texte seul (partage OS natif)
  try {
    await navigator.share({ text });
    return true;
  } catch (e) {
    void e;
    return false;
  }
}
