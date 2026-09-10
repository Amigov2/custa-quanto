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

const SYSTEM_PROMPT = `You are a Brazilian renovation estimator assistant.
The user types freely what they want to do (any language : French, Portuguese, Spanish, English, Chinese, etc.).
Your task : pick the closest macro from our list and suggest a realistic quantity.

Return ONLY valid JSON (no markdown, no \`\`\`). Structure :

{
  "macroId": string,       // exact ID from the macros list
  "qty": number,           // quantity in m², m, units... (per macro unit)
  "reasoning": string,     // 1 short sentence, IN THE USER'S LANGUAGE
  "confianca": "alta" | "media" | "baixa"
}

Rules :
- ALWAYS pick a macro from the provided list. Never invent an id.
- If the text is very vague ("I want a renovation"), pick reforma_apto_completo with confianca "media".
- If the text mentions a room (kitchen/bathroom/living room/bedroom), prioritize the matching macro.
- If the text mentions a specific task (paint/change floor/install outlet), prioritize serviços rápidos.
- qty : base on macro defaultQty if user doesn't mention size. If they do ("30 m²", "small room"), adjust.
- Small rooms ≈ 12 m², medium ≈ 20 m², large ≈ 30 m². Medium kitchen ≈ 15 m². Medium bathroom ≈ 5 m².
- reasoning : ONE short sentence, WRITTEN IN THE SAME LANGUAGE as the user's text. If user typed French → reasoning in French. If Portuguese → Portuguese. If Chinese → Chinese. Etc.`;

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
