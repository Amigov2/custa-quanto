// Chat conversationnel avec Claude Haiku vision.
// Utilisé après l'analyse initiale d'une photo pour approfondir : le user pose des questions,
// Claude conserve le contexte (résumé de l'analyse + historique).

import type { PhotoAnalysis } from "./vision";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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
