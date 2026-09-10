// Parse un devis reçu (PDF ou photo) via Claude Vision.
// Reçoit la liste des services attendus (du chantier référence) pour permettre
// à Claude de matcher chaque ligne du devis à un serviceId Custa Quanto.
//
// Retourne : { totalRecebido, postsRecebido, linhas } consommable par
// compareWithOrcamento pour le rapport visuel.

export type ExpectedService = {
  serviceId: string;
  name: string;
  category: string;
};

export type ParsedLinha = {
  descricao_original: string;
  descricao_normalizada: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  servico_matched: string | null;  // serviceId Custa Quanto ou null si pas de match
  confianca_match: "alta" | "media" | "baixa" | null;
};

export type ParsedOrcamento = {
  totalRecebido: number;
  linhas: ParsedLinha[];
  postsRecebido: Record<string, number>;  // {serviceId: valor} pour compareWithOrcamento
  linhas_nao_matchadas: number;           // combien de lignes n ont pas trouvé de service
  moeda_detectada: string;                // "R$" attendu, autre = flag
};

const SYSTEM_PROMPT = `Você é um especialista em orçamentos de reforma no Brasil.
Sua tarefa : extrair de um orçamento de empreiteiro (foto ou PDF) todas as linhas
de serviço/material com seus preços, e associar cada linha a um dos serviços
esperados (fornecidos pelo usuário).

Retorne APENAS JSON válido (sem markdown, sem \`\`\`). Estrutura :

{
  "totalRecebido": number,
  "moeda_detectada": string,   // "R$", "USD", etc.
  "linhas": [
    {
      "descricao_original": string,       // texto exato como no orçamento
      "descricao_normalizada": string,    // versão limpa em PT-BR
      "quantidade": number,
      "unidade": string,                  // "m²", "m", "un", "ponto", etc.
      "preco_unitario": number,
      "preco_total": number,
      "servico_matched": string | null,   // ID de serviço fornecido, ou null
      "confianca_match": "alta" | "media" | "baixa" | null
    }
  ]
}

Regras :
- totalRecebido : se o orçamento mostra explicitamente um total, use-o. Se não, some as linhas.
- Ignore linhas de "impostos", "taxa administrativa", "BDI" separadas (elas serão consideradas no total).
- Se a moeda não for R$, retorne "moeda_detectada" apropriado e alerte via campo.
- servico_matched : match apenas se descrição da linha corresponde claramente a um dos serviços fornecidos (por nome ou natureza). Não force o match.
- confianca_match : "alta" se descrição corresponde exatamente, "media" se aproximado, "baixa" se ambíguo, null se sem match.
- Se o orçamento estiver muito confuso ou ilegível, retorne uma linha vazia { linhas: [] } com totalRecebido: 0.`;

export async function parseOrcamento(
  base64: string,
  mediaType: string,
  expectedServicesJson: string,
  isPdf: boolean,
): Promise<ParsedOrcamento> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const userText = `Aqui está a lista de serviços esperados neste chantier (use estes IDs para o match) :
${expectedServicesJson}

Analise este orçamento e retorne o JSON conforme a estrutura definida.`;

  const contentItem = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      }
    : {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [contentItem, { type: "text", text: userText }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Resposta vazia do modelo.");

  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  const jsonStr = first >= 0 && last > first ? clean.slice(first, last + 1) : clean;

  let parsed: Partial<ParsedOrcamento> & { linhas?: ParsedLinha[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`JSON inválido do modelo (${jsonStr.length} chars).`);
  }

  const linhas: ParsedLinha[] = Array.isArray(parsed.linhas) ? parsed.linhas : [];

  // Agrège les lignes matchées par serviceId pour compareWithOrcamento.
  const postsRecebido: Record<string, number> = {};
  let naoMatchadas = 0;
  linhas.forEach(l => {
    if (l.servico_matched && (l.confianca_match === "alta" || l.confianca_match === "media")) {
      postsRecebido[l.servico_matched] = (postsRecebido[l.servico_matched] || 0) + (Number(l.preco_total) || 0);
    } else {
      naoMatchadas++;
    }
  });

  return {
    totalRecebido: Number(parsed.totalRecebido) || 0,
    linhas,
    postsRecebido,
    linhas_nao_matchadas: naoMatchadas,
    moeda_detectada: parsed.moeda_detectada || "R$",
  };
}
