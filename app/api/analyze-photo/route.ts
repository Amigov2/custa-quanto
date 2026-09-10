import { NextRequest, NextResponse } from "next/server";
import { analyzePhoto, type ImageInput } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 45; // multi-photos peut prendre plus de temps

const MAX_SIZE_PER_FILE = 8 * 1024 * 1024; // 8 MB par photo
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;   // 30 MB total tous fichiers
const MAX_FILES = 10;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Récupère les photos : soit clé "photo" (compat 1 fichier), soit "photos" (array).
    // getAll("photos") retourne tous les fichiers si le client a envoyé plusieurs.
    const raw = form.getAll("photos");
    const single = form.get("photo");
    const files: File[] = [];
    for (const item of raw) {
      if (item instanceof File) files.push(item);
    }
    if (single instanceof File && files.length === 0) {
      files.push(single);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Máximo ${MAX_FILES} fotos por análise.` }, { status: 400 });
    }

    let totalSize = 0;
    for (const f of files) {
      if (f.size > MAX_SIZE_PER_FILE) {
        return NextResponse.json({ error: `Foto "${f.name}" muito grande (máx 8 MB por foto).` }, { status: 400 });
      }
      if (!ALLOWED.has(f.type)) {
        return NextResponse.json({ error: `Formato não suportado : ${f.type}` }, { status: 400 });
      }
      totalSize += f.size;
    }
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: "Tamanho total dos arquivos excede 20 MB." }, { status: 400 });
    }

    // Convert chaque fichier en base64 + normalise mediaType (Anthropic ne supporte pas HEIC).
    const images: ImageInput[] = await Promise.all(
      files.map(async f => {
        const buf = Buffer.from(await f.arrayBuffer());
        const base64 = buf.toString("base64");
        const mt = f.type === "image/heic" || f.type === "image/heif" ? "image/jpeg" : f.type;
        return { base64, mediaType: mt };
      }),
    );

    const rawScope = form.get("scope");
    const scope = typeof rawScope === "string" ? rawScope.slice(0, 500) : undefined;

    const rawLearnings = form.get("learnings");
    const learnings = typeof rawLearnings === "string" ? rawLearnings.slice(0, 2000) : undefined;

    const analysis = await analyzePhoto(images, undefined, scope, learnings);
    return NextResponse.json({ analysis, nPhotos: files.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("analyze-photo error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
