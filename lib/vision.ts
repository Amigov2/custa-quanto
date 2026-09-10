// Analyse d'une photo de pièce via Claude Haiku vision.
// Retourne un JSON structuré : ambiente, taille estimée, itens à faire, macros suggérées.

import { MACRO_FR } from "./macros";
import { searchSinapi, type SinapiCategoria } from "./sinapi_insumos";

export type PhotoAnalysisItem = {
  tipo: string;
  tipo_fr: string;
  descricao: string;
  descricao_fr: string;
  gravidade: "leve" | "medio" | "grave";
};

export type PhotoAnalysisMacro = {
  macro_id: string;
  motivo: string;
  motivo_fr: string;
};

export type SinapiMatch = {
  codigo: string;
  descricao: string;
  und: string;
  preco: number;
};

export type PhotoAnalysisProduct = {
  nome: string;                    // ex: "Manta líquida impermeabilizante"
  nome_fr: string;                 // ex: "Membrane liquide d'étanchéité"
  marcas_br: string[];             // ex: ["Sika Membrana 105", "Vedacit Vedapren", "Denver Impermeabilizante"]
  quantidade_por_m2: string;       // ex: "~1.5 kg/m²" ou "1 lata 18L cobre 20 m²"
  quantidade_por_m2_fr: string;    // ex: "~1,5 kg/m²" (peut être identique)
  unidade_comercial: string;       // ex: "balde 18kg", "lata 18L", "saco 20kg", "rolo 10m²"
  unidade_comercial_fr: string;    // ex: "seau 18 kg", "boîte 18 L", "sac 20 kg", "rouleau 10 m²"
  rendimento_m2_por_unidade: number; // ex: 12 (1 balde cobre 12 m²)
  margem_recomendada_pct: number;  // ex: 10 pour peinture, 15 pour azulejo/piso (découpes)
  uso: string;                     // ex: "Áreas úmidas, laje, terraço"
  uso_fr: string;                  // ex: "Zones humides, dalle, terrasse"
  sinapi_matches?: SinapiMatch[];  // enrichi côté serveur après retour Claude
};

export type PhotoAnalysisStep = {
  passo: number;
  titulo: string;                  // ex: "Preparação da superfície"
  titulo_fr: string;               // ex: "Préparation de la surface"
  descricao: string;               // ex: "Limpar com jato d'água..."
  descricao_fr: string;            // ex: "Nettoyer au jet d'eau..."
};

export type PhotoAnalysis = {
  ambiente: "cozinha" | "banheiro" | "sala" | "quarto" | "escritorio" | "fachada" | "area_externa" | "outro";
  tamanho_estimado_m2: number;
  tamanho_min_m2?: number;
  tamanho_max_m2?: number;
  tamanho_confianca: "baixa" | "media" | "alta";
  itens_detectados: PhotoAnalysisItem[];
  macros_sugeridas: PhotoAnalysisMacro[];
  produtos_recomendados: PhotoAnalysisProduct[];
  passo_a_passo: PhotoAnalysisStep[];
  observacoes: string[];
  observacoes_fr: string[];
  resposta_ao_usuario?: { pt: string; fr: string };  // rempli si le user posait une question dans son scope
};

const AVAILABLE_MACRO_IDS = Object.keys(MACRO_FR);

const SYSTEM_PROMPT = `Você é um especialista em reformas residenciais no Brasil (Rio de Janeiro).
Analise a foto de um cômodo ou fachada e responda APENAS com JSON válido (sem markdown, sem \`\`\`).

CADA CAMPO TEXTUAL DEVE SER FORNECIDO EM PORTUGUÊS-BR E EM FRANCÊS. O usuário fala francês nativamente e português como segunda língua — a versão FR aparece em pequeno cinza abaixo da PT-BR.

Estrutura obrigatória :
{
  "ambiente": "cozinha" | "banheiro" | "sala" | "quarto" | "escritorio" | "fachada" | "area_externa" | "outro",
  "tamanho_estimado_m2": number,
  "tamanho_min_m2": number,
  "tamanho_max_m2": number,
  "tamanho_confianca": "baixa" | "media" | "alta",
  "itens_detectados": [
    { "tipo": string, "tipo_fr": string, "descricao": string, "descricao_fr": string, "gravidade": "leve" | "medio" | "grave" }
  ],
  "macros_sugeridas": [
    { "macro_id": string, "motivo": string, "motivo_fr": string }
  ],
  "produtos_recomendados": [
    {
      "nome": string,
      "nome_fr": string,
      "marcas_br": [string, string],
      "quantidade_por_m2": string,
      "quantidade_por_m2_fr": string,
      "unidade_comercial": string,
      "unidade_comercial_fr": string,
      "rendimento_m2_por_unidade": number,
      "margem_recomendada_pct": number,
      "uso": string,
      "uso_fr": string
    }
  ],
  "passo_a_passo": [
    { "passo": number, "titulo": string, "titulo_fr": string, "descricao": string, "descricao_fr": string }
  ],
  "observacoes": [string],
  "observacoes_fr": [string],
  "resposta_ao_usuario": { "pt": string, "fr": string } // OPCIONAL — apenas se o usuário fez uma pergunta
}

REGRA CRÍTICA sobre tamanho :
- Nunca é possível saber o tamanho preciso de uma foto sem uma régua ou referência dimensional clara. Sempre use "baixa" ou "media" na confiança — nunca "alta" a menos que haja uma referência métrica visível (porta padrão ~2.1m, azulejo padrão, régua na foto).
- Sempre forneça tamanho_min_m2 e tamanho_max_m2 (fourchette realista baseada no que você vê). O tamanho_estimado_m2 é a média.
- Prefira subestimar : é mais seguro que superestimar.

produtos_recomendados :
- Cite 1-3 produtos concretos para o principal serviço detectado.
- Para cada produto :
  * nome : genérico (ex "Manta líquida asfáltica", "Tinta acrílica premium")
  * marcas_br : 2 marcas brasileiras conhecidas
  * quantidade_por_m2 : dose típica em texto ("~1,5 kg/m²", "~150 ml/m²")
  * unidade_comercial : como é vendido nas lojas ("balde 18 kg", "lata 18 L", "saco 20 kg", "rolo 10 m²")
  * rendimento_m2_por_unidade : quantos m² cobre UMA unidade comercial (número)
  * margem_recomendada_pct : sobra recomendada em % (10 para tinta, 15 para piso/azulejo devido recortes)
  * uso : contexto de aplicação
- Exemplos de marcas BR : impermeabilização (Sika, Vedacit, Denver, Bianco), tinta (Suvinil, Coral, Sherwin-Williams, Renner), argamassa (Quartzolit, Votomassa), cerâmica (Portobello, Eliane, Cecrisa).

passo_a_passo :
- Descreva concretamente como aplicar o produto principal (4-6 passos numerados).
- Cada passo : título curto + descrição prática (o que fazer + com que ferramenta + tempo de espera se relevante).

itens_detectados :
- Tudo que precisa ser feito. Exemplos: "pintura descascando", "azulejo antigo", "piso rachado", "infiltração no teto".

macros_sugeridas :
- Escolha entre os IDs abaixo. Ordene do mais prioritário ao menos.

IDs de macro disponíveis :
${AVAILABLE_MACRO_IDS.join(", ")}

observacoes :
- Sempre inclua uma advertência sobre a necessidade de medir com trena/metro para ter o tamanho preciso.`;

export async function analyzePhoto(imageBase64: string, mediaType: string, scope?: string, learnings?: string): Promise<PhotoAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada. Adicione em .env.local.");
  }

  // Si l'utilisateur décrit un scope précis, on force Claude à s'y limiter.
  // Sans scope → comportement historique (analyse complète).
  const userText = scope && scope.trim()
    ? `Analise esta foto e retorne o JSON conforme a estrutura definida.

TEXTO DO USUÁRIO (pode ser um escopo, uma pergunta, ou ambos) :
"${scope.trim()}"

Regras :

1) Se o texto DESCREVE um escopo de trabalho (ex: "só pintar as paredes", "trocar o piso") :
   - itens_detectados : liste APENAS o que o usuário quer fazer (ignore tudo o resto na foto).
   - macros_sugeridas : só macros que correspondem ao escopo (ex: se só pintar, NÃO sugira "reforma completa").
   - produtos_recomendados : apenas para os serviços descritos.
   - passo_a_passo : só para os trabalhos descritos.
   - Se o escopo pede algo que não é visível na foto, mencione em observações.

2) Se o texto CONTÉM UMA PERGUNTA (ex: "quanto tempo leva pra uma pessoa?", "posso fazer sozinho?", "qual é o melhor material?") :
   - PREENCHA OBRIGATORIAMENTE o campo "resposta_ao_usuario" com { "pt": "...", "fr": "..." }.
   - Responda concretamente à pergunta em 2-4 frases, com base na foto e no seu conhecimento do mercado BR.
   - Se a pergunta menciona "uma pessoa" ou "sozinho", estime o tempo/dificuldade para 1 trabalhador com ferramentas standard.

3) Se o texto for AMBOS (escopo + pergunta), aplique as duas regras.

4) Se não há pergunta clara, NÃO preencha "resposta_ao_usuario" (deixe undefined).`
    : "Analise esta foto e retorne o JSON conforme a estrutura definida.";

  // Injecte les apprentissages accumulés du user (corrections passées) si présents.
  // Ce texte a été résumé côté client à partir des LearningRecord bruts.
  const userTextWithLearnings = learnings && learnings.trim()
    ? userText + learnings
    : userText;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: userTextWithLearnings,
            },
          ],
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

  // Le modèle peut sometimes wrapper le JSON ; on strip markdown puis extrait entre premier { et dernier }
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  const jsonStr = first >= 0 && last > first ? clean.slice(first, last + 1) : clean;
  let parsed: PhotoAnalysis;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    void e;
    throw new Error(`JSON inválido do modelo (${jsonStr.length} chars): ${jsonStr.slice(0, 200)}...${jsonStr.slice(-100)}`);
  }

  // Filtrer les macro_ids inconnus (sécurité — modèle pourrait hallucinater un id)
  parsed.macros_sugeridas = (parsed.macros_sugeridas || []).filter(m =>
    AVAILABLE_MACRO_IDS.includes(m.macro_id),
  );

  // Defaults sécurisés au cas où le modèle omet des champs
  parsed.produtos_recomendados = parsed.produtos_recomendados || [];
  parsed.passo_a_passo = parsed.passo_a_passo || [];
  parsed.observacoes = parsed.observacoes || [];
  parsed.observacoes_fr = parsed.observacoes_fr || [];

  // Enrichir avec les prix SINAPI officiels (média nacional 2021) + defaults sécurisés
  parsed.produtos_recomendados = parsed.produtos_recomendados.map(prod => {
    const categoria = guessCategoria(prod.nome, prod.uso);
    const query = [prod.nome, ...(prod.marcas_br || [])].join(" ");
    const matches = searchSinapi(query, 3, categoria);
    return {
      ...prod,
      unidade_comercial: prod.unidade_comercial || "unidade",
      rendimento_m2_por_unidade: Number(prod.rendimento_m2_por_unidade) || 1,
      margem_recomendada_pct: Number(prod.margem_recomendada_pct) || 10,
      sinapi_matches: matches.map(m => ({
        codigo: m.codigo,
        descricao: m.descricao,
        und: m.und,
        preco: m.preco,
      })),
    };
  });

  return parsed;
}

// Devine la catégorie SINAPI depuis le nom / uso pour restreindre la recherche.
function guessCategoria(nome: string, uso: string): SinapiCategoria | undefined {
  const t = (nome + " " + uso).toLowerCase();
  if (/tinta|verniz|esmalte|latex|acríl|massa corrida|selador|primer/.test(t)) return "tinta";
  if (/imperm|manta|veda|silicone/.test(t)) return "imperm";
  if (/porcelanato|cerâmic|azulejo|granito|mármore|laminado|vinílic|revestimento|piso/.test(t)) return "revestimento";
  if (/argamassa|cola|rejunte|cimento|cal |gesso/.test(t)) return "argamassa";
  if (/porta|fechadura|janela|vidro|box|batente/.test(t)) return "esquadria";
  if (/torneira|chuveiro|vaso|louça|pia|bancada|cuba|tubo|conexão|joelho/.test(t)) return "hidraulica";
  if (/cabo|fio|conduít|eletrodut|tomada|interruptor|disjuntor|lâmpada|led|luminár/.test(t)) return "eletrica";
  if (/parafuso|prego|arame|bucha|grampo|lixa/.test(t)) return "ferragem";
  if (/mdf|compensado|painel|forro|drywall/.test(t)) return "madeira";
  if (/tijolo|bloco|rodapé|soleira/.test(t)) return "alvenaria";
  return undefined;
}
