import { NextRequest, NextResponse } from "next/server";
import { generateAfterImage, type AfterStyle } from "@/lib/gemini_image";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_STYLES = new Set<AfterStyle>(["moderno", "rustico", "escandinavo", "industrial", "classico"]);
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB image d entrée
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    const rawStyle = form.get("style");
    const rawAmbiente = form.get("ambiente");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Foto muito grande (máx 4 MB)." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Formato não suportado : ${file.type}` }, { status: 400 });
    }
    if (typeof rawStyle !== "string" || !VALID_STYLES.has(rawStyle as AfterStyle)) {
      return NextResponse.json({ error: "Style inválido." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const mediaType = file.type === "image/heic" || file.type === "image/heif" ? "image/jpeg" : file.type;
    const ambiente = typeof rawAmbiente === "string" ? rawAmbiente : undefined;

    const result = await generateAfterImage(base64, mediaType, rawStyle as AfterStyle, ambiente);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-after error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
