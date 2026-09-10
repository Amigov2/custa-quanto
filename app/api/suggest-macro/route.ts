import { NextRequest, NextResponse } from "next/server";
import { suggestMacro } from "@/lib/suggest_macro";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.slice(0, 500) : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
    }
    const suggestion = await suggestMacro(text);
    return NextResponse.json({ suggestion });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("suggest-macro error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
