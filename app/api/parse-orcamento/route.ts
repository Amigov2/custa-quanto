import { NextRequest, NextResponse } from "next/server";
import { parseOrcamento } from "@/lib/parse_orcamento";

export const runtime = "nodejs";
export const maxDuration = 45; // parsing d un devis peut prendre 20-30s

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB pour PDF
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 15 MB)." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Formato não suportado : ${file.type}` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // Anthropic n accepte pas heic/heif — le client doit convertir avant, on force jpeg mime.
    let mediaType = file.type;
    if (mediaType === "image/heic" || mediaType === "image/heif") mediaType = "image/jpeg";

    const rawServices = form.get("expectedServices");
    const expectedServices = typeof rawServices === "string" ? rawServices : "[]";

    const isPdf = mediaType === "application/pdf";
    const parsed = await parseOrcamento(base64, mediaType, expectedServices, isPdf);
    return NextResponse.json({ parsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("parse-orcamento error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
