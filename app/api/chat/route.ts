import { NextRequest, NextResponse } from "next/server";
import { callChat, type ChatMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context, history, message } = body as {
      context?: string;
      history?: ChatMessage[];
      message?: string;
    };
    if (!context || typeof context !== "string") {
      return NextResponse.json({ error: "Contexto obrigatório." }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json({ error: "Mensagem muito longa (máx 1000 chars)." }, { status: 400 });
    }
    const reply = await callChat(context, Array.isArray(history) ? history : [], message);
    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("chat error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
