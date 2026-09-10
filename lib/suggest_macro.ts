// Reçoit un texte libre du user ("quero pintar minha cozinha", "trocar piso da sala moderno")
// et retourne la macro Custa Quanto la plus proche + une quantité par défaut réaliste.
// Utilise Claude Haiku pour la classification, sans image.

import { MACROS } from "./macros";

export type MacroSuggestion = {
  macroId: string;
  macroName: string;
  qty: number;
  qtyUnit: string;
  reasoning: string;      // court, pour indicateur UI si besoin
  confianca: "alta" | "media" | "baixa";
};

const AVAILABLE_MACROS = MACROS.map(m => ({
  id: m.id,
  name: m.name,
  description: m.description || "",
  unit: m.unit,
  defaultQty: m.defaultQty,
}));

const SYSTEM_PROMPT = `Você é um assistente de estimador de reformas no Brasil.
O usuário digita livremente o que quer fazer (em português ou francês).
Sua tarefa : escolher a macro mais próxima da nossa lista e sugerir uma quantidade realista.

Retorne APENAS JSON válido (sem markdown, sem \`\`\`). Estrutura :

{
  "macroId": string,       // ID exato da lista de macros
  "qty": number,           // quantidade em metros², metros, unidades... (ver unidade da macro)
  "reasoning": string,     // 1 frase em pt-br : por que essa macro
  "confianca": "alta" | "media" | "baixa"
}

Regras :
- Escolha SEMPRE uma macro da lista fornecida. Nunca invente um id.
- Se o texto é muito vago ("quero uma reforma"), escolha reforma_apto_completo com confiança "media".
- Se o texto menciona uma pièce (cozinha/banheiro/sala/quarto), priorize a macro correspondente.
- Se o texto menciona uma tarefa ponctuelle (pintar/trocar piso/instalar tomada), priorize serviços rápidos.
- qty : baseie na defaultQty da macro se o user não menciona tamanho. Se ele menciona ("30 m²", "sala pequena"), ajuste.
- Salas pequenas ≈ 12 m², médias ≈ 20 m², grandes ≈ 30 m². Cozinha média ≈ 15 m². Banheiro médio ≈ 5 m².
- reasoning : 1 frase courte, en PT-BR.`;

export async function suggestMacro(text: string): Promise<MacroSuggestion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const macrosList = AVAILABLE_MACROS.map(m =>
    `- ${m.id} : ${m.name} (unit: ${m.unit}, default: ${m.defaultQty})`,
  ).join("\n");

  const userText = `Lista de macros disponíveis :

${macrosList}

Texto do usuário :
"${text.trim()}"

Escolha a macro mais próxima e retorne o JSON.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text;
  if (!raw) throw new Error("Resposta vazia do modelo.");

  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  const jsonStr = first >= 0 && last > first ? clean.slice(first, last + 1) : clean;

  let parsed: { macroId?: string; qty?: number; reasoning?: string; confianca?: MacroSuggestion["confianca"] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("JSON inválido do modelo.");
  }

  // Vérifie que la macro existe, fallback sur reforma_apto_completo sinon.
  const macro = MACROS.find(m => m.id === parsed.macroId) ?? MACROS.find(m => m.id === "reforma_apto_completo") ?? MACROS[0];
  const qty = typeof parsed.qty === "number" && parsed.qty > 0 ? parsed.qty : macro.defaultQty;

  return {
    macroId: macro.id,
    macroName: macro.name,
    qty: Math.round(qty),
    qtyUnit: macro.unit,
    reasoning: parsed.reasoning ?? "",
    confianca: parsed.confianca ?? "media",
  };
}
