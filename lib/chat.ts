// Chat conversationnel avec Claude Haiku vision.
// Utilisé après l'analyse initiale d'une photo pour approfondir : le user pose des questions,
// Claude conserve le contexte (résumé de l'analyse + historique).
//
// V2 mémoire cross-photo : quand la photo est rattachée à un chantier, le chat reçoit
// aussi le contexte de toutes les autres photos du chantier + leurs conversations passées.
// L'IA devient un vrai "contremaitre" avec mémoire de tout le chantier.

import type { PhotoAnalysis } from "./vision";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Type minimal pour éviter une dépendance circulaire vers photo_history.
export type PhotoForContext = {
  id: string;
  dateISO: string;
  label?: string;
  userScope: string;
  analysis: PhotoAnalysis;
  chatHistory?: ChatMessage[];
};

// Résumé compact de l'analyse initiale pour le contexte de la conversation.
// Injecté en 1er message user pour que Claude connaisse la photo sans devoir la ré-envoyer.
export function analysisContext(a: PhotoAnalysis): string {
  const itens = a.itens_detectados.slice(0, 5).map(i => `- ${i.tipo}: ${i.descricao}`).join("\n");
  const produtos = a.produtos_recomendados.slice(0, 3).map(p => `- ${p.nome} (${p.marcas_br.join("/")})`).join("\n");
  const passos = a.passo_a_passo.slice(0, 4).map(s => `${s.passo}. ${s.titulo}`).join("\n");
  return `Contexto da foto analisada (não precisa repetir na resposta):
Ambiente: ${a.ambiente}
Tamanho estimado: ${a.tamanho_estimado_m2} m² (${a.tamanho_min_m2}–${a.tamanho_max_m2}, confiança ${a.tamanho_confianca})

Itens detectados:
${itens}

Produtos recomendados:
${produtos}

Passos:
${passos}
`;
}

// Résumé court d'UNE photo précédente du même chantier (pour le contexte cross-photo).
// Beaucoup plus compact que analysisContext (on limite les tokens injectés).
function shortPhotoSummary(p: PhotoForContext, idx: number): string {
  const date = new Date(p.dateISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const nItens = p.analysis.itens_detectados.length;
  const scope = p.userScope ? ` — pergunta/escopo: "${p.userScope}"` : "";
  const label = p.label ? ` [${p.label}]` : "";
  const nConversas = Math.ceil((p.chatHistory?.length ?? 0) / 2);

  const parts = [
    `### Foto ${idx + 1}${label} — ${date}`,
    `- Ambiente: ${p.analysis.ambiente} · ~${p.analysis.tamanho_estimado_m2} m²${scope}`,
    `- ${nItens} itens detectados`,
  ];

  // Inclut les 2-3 derniers échanges les plus récents seulement (pour rester compact).
  if (nConversas > 0 && p.chatHistory) {
    const recent = p.chatHistory.slice(-4); // 2 derniers échanges max
    parts.push(`- Conversas anteriores (${nConversas} echanges) :`);
    recent.forEach(m => {
      const short = m.content.length > 140 ? m.content.slice(0, 140) + "…" : m.content;
      parts.push(`  ${m.role === "user" ? "U" : "A"}: ${short}`);
    });
  }
  return parts.join("\n");
}

// Contexte enrichi cross-photo : injecté quand la photo courante appartient à un chantier
// avec d'autres photos. L'IA voit alors l'évolution + les conversas passées → devient contremaitre.
export function chantierMemoryContext(
  chantierName: string,
  currentPhoto: PhotoForContext,
  otherPhotos: PhotoForContext[],
): string {
  const sorted = otherPhotos
    .filter(p => p.id !== currentPhoto.id)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  if (sorted.length === 0) {
    // Un seul cliché du chantier — fallback sur l'ancien contexte.
    return analysisContext(currentPhoto.analysis);
  }

  const summaries = sorted.map((p, i) => shortPhotoSummary(p, i)).join("\n\n");

  return `Você é o contremaitre virtual do chantier "${chantierName}".
Você tem memória completa deste chantier — todas as fotos, todos os escopos, todas as conversas passadas.

## Histórico do chantier (fotos anteriores em ordem cronológica) :

${summaries}

## FOTO ATUAL (a que o usuário está olhando agora) :

${analysisContext(currentPhoto.analysis)}

Regras específicas para este contexto :
- Refira-se ao histórico quando relevante ("na foto de 3 dias atrás vejo X, agora vejo Y").
- Detecte evolução : progresso, problemas novos, coisas terminadas.
- Se o usuário perguntar "onde estamos?", faça um mini status do chantier.
- Se ele já discutiu algo em fotos anteriores, considere isso resolvido a menos que ele traga de novo.`;
}

const SYSTEM_PROMPT = `You are a Brazilian residential renovation expert helping a user understand a photo they just uploaded.

CRITICAL LANGUAGE RULE :
- Detect the language of the user's message (French, Portuguese, Spanish, English, Chinese, Italian, German, etc.).
- Reply ONLY in that same language. No mix, no fallback in another language.
- If the message is short or ambiguous, use the language of the most recent user message. Default to Portuguese (BR) if truly unclear.
- Technical product/brand names (Vedatop, Sika, Coral, SINAPI…) stay in original form regardless of language.

Content rules :
- Be concrete : cite brands, products, quantities, prices when relevant.
- If the user asks something unrelated to renovation, redirect gently.
- Short answers (max 4-5 sentences), unless the question requires depth.
- Never invent SINAPI prices if unsure — say "check Obramax/LPK" in the user's language.

CRITICAL RULE — STRUCTURAL WORKS (SAFETY) :
When the question or photo involves any of these structural elements, follow specific rules :
- Retaining walls (mur de contenção/soutènement) — especially over 2m tall
- Load-bearing walls (mur porteur)
- Concrete slabs (laje)
- Foundations, columns, beams
- Structural stairs, structural chimneys

For these cases :
1. NEVER recommend a single simplistic DIY fix (like "just apply waterproofing").
2. For infiltration in retaining walls : the CORRECT solution addresses the CAUSE (drainage). Order :
   a) Drainage : excavate on the earth side, install perforated PVC 100mm drain at the bottom, backfill with 20-40mm gravel, geotextile (bidim).
   b) Weep holes (barbacãs) Ø75mm every 2-3m in the wall base.
   c) Positive-side waterproofing (earth side) : bituminous membrane, EPDM, or Sika Igol before backfilling.
   d) ONLY THEN, apply crystalline waterproofing (Vedatop, Sika 1) on the visible side as finishing.
   WARNING : sealing only the visible side (negative waterproofing) WITHOUT drainage on a retaining wall is DANGEROUS — hydrostatic pressure can crack or collapse the wall.
3. For walls over 3m tall, cracks, structural deformation : ALWAYS recommend consulting a CREA-certified structural engineer first. A laudo (~R$ 2.000-4.000) prevents collapses.
4. Always add a warning line at the end of your response for structural cases : "⚠️ Estrutural : consulte um engenheiro CREA antes de intervir."`;

export async function callChat(context: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  // Premier message = contexte injecté, puis alternance user/assistant
  const messages: { role: string; content: string }[] = [
    { role: "user", content: context },
    // Ce 2e message injecté est neutre : Claude s'alignera sur la langue du prochain user message.
    { role: "assistant", content: "Ok, ready to help with this renovation project. Ask anything." },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Resposta vazia.");
  return text.trim();
}
