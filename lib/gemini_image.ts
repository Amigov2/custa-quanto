// Génération d une image  après reforma  via Google Gemini 2.5 Flash Image (aka Nano Banana).
// Prend la photo actuelle + un style et retourne une image transformée qui garde la structure.
//
// Sans GOOGLE_API_KEY, on tombe sur un mode démo qui retourne une inspiration Unsplash
// selon le style. C est visuellement moins bluffant (image générique pas la vraie pièce)
// mais permet de valider l UX du slider avant/après.

export type AfterStyle = "moderno" | "rustico" | "escandinavo" | "industrial" | "classico";

const STYLE_PROMPTS: Record<AfterStyle, string> = {
  moderno: "modern minimalist Brazilian renovation, clean lines, matte black fixtures, soft neutral tones, integrated LED lighting, polished porcelain floor, white walls, Portobello style",
  rustico: "rustic Brazilian country style renovation, exposed brick, warm wood beams, terracotta tones, natural stone accents, cozy warm lighting",
  escandinavo: "Scandinavian style renovation, light wood floors, white walls, minimal furniture, natural daylight, muted pastel accents, Ikea-inspired",
  industrial: "industrial loft renovation, exposed concrete, black metal frames, Edison bulbs, raw materials, urban minimalist",
  classico: "classic elegant Brazilian renovation, crown moldings, marble details, warm neutral palette, luxury finishes, timeless design",
};

// Inspiration fallback (mode démo sans clé API). URLs Unsplash choisies pour matcher le style.
// TODO(V2) : héberger nos propres inspirations pour meilleure cohérence.
const DEMO_INSPIRATION: Record<AfterStyle, { cozinha: string; banheiro: string; sala: string; quarto: string; default: string }> = {
  moderno: {
    cozinha: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80",
    banheiro: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80",
    sala: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80",
    quarto: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
    default: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80",
  },
  rustico: {
    cozinha: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    banheiro: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80",
    sala: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80",
    quarto: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
    default: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80",
  },
  escandinavo: {
    cozinha: "https://images.unsplash.com/photo-1556909195-e17d94aad13a?w=1200&q=80",
    banheiro: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=80",
    sala: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
    quarto: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
    default: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80",
  },
  industrial: {
    cozinha: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    banheiro: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80",
    sala: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    quarto: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1200&q=80",
    default: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  },
  classico: {
    cozinha: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80",
    banheiro: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80",
    sala: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80",
    quarto: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
    default: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80",
  },
};

export type GenerateAfterResult = {
  imageDataUrl: string;       // data:image/... base64
  mode: "gemini" | "demo";    // pour indiquer au user si c est la vraie IA ou la démo
  style: AfterStyle;
  ambiente?: string;
};

// Point d entrée principal — utilise Gemini si clé présente, sinon fallback démo.
export async function generateAfterImage(
  imageBase64: string,
  mediaType: string,
  style: AfterStyle,
  ambiente?: string,
): Promise<GenerateAfterResult> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    // Mode démo — retourne une inspiration Unsplash.
    const map = DEMO_INSPIRATION[style];
    const key = (ambiente && ambiente in map ? ambiente : "default") as keyof typeof map;
    const url = map[key];
    // On charge l URL et on retourne en base64 pour cohérence de l API.
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao carregar inspiração demo.");
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      imageDataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`,
      mode: "demo",
      style,
      ambiente,
    };
  }

  // Mode réel — Google Gemini 2.5 Flash Image editing.
  const prompt = `Take this photo and transform it into an ${STYLE_PROMPTS[style]}.
Keep the same structure and layout of the room — walls, floor, ceiling positions must stay identical.
Only change the finishes : materials, colors, furniture, decoration, lighting.
The result must look like a realistic professional interior design photo of the same room after renovation.`;

  // Modèle : gemini-2.5-flash-image (Nano Banana stable). Alternatives disponibles :
  // gemini-3.1-flash-image (Nano Banana 2, plus récent) ou gemini-3-pro-image (Pro).
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["Text", "Image"],
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  // L API renvoie inlineData en camelCase (pas snake_case comme dans la doc).
  type ImgPart = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
  const imgPart: ImgPart | undefined = parts.find((p: ImgPart) => p.inlineData?.data || p.inline_data?.data);
  const dataBase64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  const mt = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || "image/png";
  if (!dataBase64) throw new Error("Gemini n a pas retourné d image.");
  return {
    imageDataUrl: `data:${mt};base64,${dataBase64}`,
    mode: "gemini",
    style,
    ambiente,
  };
}
