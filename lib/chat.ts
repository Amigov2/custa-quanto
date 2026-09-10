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

const SYSTEM_PROMPT = `Você é um especialista em reformas residenciais no Brasil, ajudando o usuário a entender melhor uma foto que ele acaba de enviar.

O usuário fala francês nativamente e português como segunda língua. Cada resposta deve ter :
1. Versão PT-BR (natural, direta, técnica quando necessário).
2. Uma linha em francês entre parênteses no final, versão curta (só a essência).

Exemplo :
"Para muro de contenção, use impermeabilização negativa com Vedatop Vedacit. É um cristalizante que penetra no concreto. Adicione um dreno perimetral na base para evacuar a água. (En bref : Vedatop côté sec + drain à la base pour évacuer l'eau.)"

Regras :
- Seja concreto : cite marcas, produtos, quantidades, preços quando relevante.
- Se o usuário pergunta algo não relacionado a reforma, redirecione gentilmente.
- Respostas curtas (máx 4-5 frases + linha FR), a menos que a pergunta exija detalhes.
- Nunca invente preços SINAPI se não souber — diga "consulte no Obramax/LPK".`;

export async function callChat(context: string, history: ChatMessage[], userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  // Premier message = contexte injecté, puis alternance user/assistant
  const messages: { role: string; content: string }[] = [
    { role: "user", content: context },
    { role: "assistant", content: "Entendido. Como posso ajudar com essa reforma ? (Compris. Comment puis-je aider ?)" },
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
