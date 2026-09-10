import { NextRequest, NextResponse } from "next/server";
import { analyzePhoto } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Foto muito grande (máx 8 MB)." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Formato não suportado : ${file.type}` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // Anthropic n'accepte pas heic/heif — convertir en jpeg côté client si besoin
    const mediaType = file.type === "image/heic" || file.type === "image/heif" ? "image/jpeg" : file.type;

    const rawScope = form.get("scope");
    const scope = typeof rawScope === "string" ? rawScope.slice(0, 500) : undefined;

    const rawLearnings = form.get("learnings");
    const learnings = typeof rawLearnings === "string" ? rawLearnings.slice(0, 2000) : undefined;

    const analysis = await analyzePhoto(base64, mediaType, scope, learnings);
    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("analyze-photo error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
