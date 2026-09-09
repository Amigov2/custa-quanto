"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMacro, getMacroFr } from "@/lib/macros";
import type { PhotoAnalysis } from "@/lib/vision";
import { analysisContext, type ChatMessage } from "@/lib/chat";
import { deductCredit, getCredits, hasCredits } from "@/lib/credits";
import { generateWhatsAppSummary, shareWithSystem, whatsAppShareUrl } from "@/lib/share";
import CreditsBadge from "@/app/components/CreditsBadge";

type Step = "idle" | "preview" | "analyzing" | "result" | "error";

const AMBIENTE_LABEL: Record<PhotoAnalysis["ambiente"], { pt: string; fr: string; emoji: string }> = {
  cozinha:      { pt: "Cozinha",      fr: "Cuisine",         emoji: "🍳" },
  banheiro:     { pt: "Banheiro",     fr: "Salle de bain",   emoji: "🚽" },
  sala:         { pt: "Sala",         fr: "Salon",           emoji: "🛋️" },
  quarto:       { pt: "Quarto",       fr: "Chambre",         emoji: "🛏️" },
  escritorio:   { pt: "Escritório",   fr: "Bureau",          emoji: "💼" },
  fachada:      { pt: "Fachada",      fr: "Façade",          emoji: "🏠" },
  area_externa: { pt: "Área externa", fr: "Extérieur",       emoji: "🌳" },
  outro:        { pt: "Ambiente",     fr: "Espace",          emoji: "📐" },
};

const GRAVIDADE_COLOR: Record<PhotoAnalysis["itens_detectados"][0]["gravidade"], string> = {
  leve:  "#34c759",
  medio: "#ff9500",
  grave: "#ff3b30",
};

const CONFIANCA_LABEL: Record<PhotoAnalysis["tamanho_confianca"], string> = {
  baixa: "estimativa vaga",
  media: "estimativa razoável",
  alta:  "estimativa boa",
};

export default function FotoPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const INPUT_ID = "cq-photo-input";
  const CAMERA_ID = "cq-photo-camera";
  const [step, setStep] = useState<Step>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [error, setError] = useState<string>("");
  const [editedM2, setEditedM2] = useState<number>(0);
  const [confirmedM2, setConfirmedM2] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  // Restore dernière analyse depuis localStorage au mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cq_last_photo_analysis");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.analysis) {
          setAnalysis(saved.analysis);
          setEditedM2(saved.editedM2 || 0);
          setConfirmedM2(saved.confirmedM2 || false);
          setStep("result");
        }
      }
    } catch {}
  }, []);

  // Save chaque fois que l'analyse ou l'état m² change
  useEffect(() => {
    if (analysis) {
      localStorage.setItem("cq_last_photo_analysis", JSON.stringify({
        analysis, editedM2, confirmedM2, savedAt: Date.now(),
      }));
    }
  }, [analysis, editedM2, confirmedM2]);

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("preview");
    setError("");
    setAnalysis(null);
  }

  async function analyze() {
    if (!file) return;
    setStep("analyzing");
    setError("");
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/analyze-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao analisar.");
      setAnalysis(data.analysis);
      // Si confiance basse, on n'affiche PAS le chiffre par défaut — l'user doit mesurer.
      const conf = data.analysis.tamanho_confianca;
      setEditedM2(conf === "alta" ? data.analysis.tamanho_estimado_m2 : 0);
      setConfirmedM2(false);
      setStep("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setPreviewUrl(null);
    setFile(null);
    setAnalysis(null);
    setError("");
    setEditedM2(0);
    setConfirmedM2(false);
    localStorage.removeItem("cq_last_photo_analysis");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleShare() {
    if (!analysis) return;
    const text = generateWhatsAppSummary(analysis, editedM2);
    const shared = await shareWithSystem(text, file);
    if (!shared) {
      // Fallback : ouvrir wa.me dans un nouvel onglet
      window.open(whatsAppShareUrl(text), "_blank");
    }
  }

  async function handleCopy() {
    if (!analysis) return;
    const text = generateWhatsAppSummary(analysis, editedM2);
    try {
      await navigator.clipboard.writeText(text);
      // Petit feedback visuel via state ?
      alert("Copiado ! Cole no WhatsApp ou onde quiser.");
    } catch {
      alert("Erro ao copiar. Selecione o texto manualmente.");
    }
  }

  function goToEstimate(macroId: string) {
    router.push(`/estimate?macroId=${macroId}&qty=${editedM2}`);
  }

  return (
    <div>
      <div className="nav-blur sticky top-0 z-40 max-w-md mx-auto">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-[color:var(--color-accent)] text-[15px] flex items-center gap-0.5 -ml-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Início
            <span className="text-[11px] opacity-90 text-[color:var(--color-ink-2)] ml-0.5">· accueil</span>
          </Link>
          <p className="text-[15px] font-semibold">Foto</p>
          <CreditsBadge compact />
        </div>
      </div>

      <div className="max-w-md mx-auto pb-32">
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">Analisar foto</h1>
          <p className="text-[13px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5">Analyser une photo</p>
        </div>

        <input
          ref={inputRef}
          id={INPUT_ID}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="sr-only"
        />
        {/* Input séparé avec capture=environment → iOS ouvre direct la caméra arrière */}
        <input
          id={CAMERA_ID}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          className="sr-only"
        />

        {step === "idle" && (
          <div className="px-6 pt-6 fade-in fade-in-1">
            <label htmlFor={CAMERA_ID} className="card-outlined p-8 text-center block cursor-pointer hover:border-[color:var(--color-accent)] transition">
              <div className="w-20 h-20 rounded-full bg-[color:var(--color-accent)]/10 mx-auto mb-4 flex items-center justify-center text-4xl">
                📸
              </div>
              <p className="text-[15px] font-medium mb-1">Tire uma foto do cômodo</p>
              <p className="text-[12px] text-[color:var(--color-ink-2)] opacity-95 mb-4">Prends une photo de la pièce</p>
              <p className="text-[13px] text-[color:var(--color-muted)] max-w-[280px] mx-auto mb-6 leading-relaxed">
                A IA detecta o que precisa ser feito e sugere o metrage aproximado. Você valida antes de calcular.
              </p>
              <span className="btn-primary rounded-2xl px-6 py-3 text-[15px] font-semibold inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Abrir câmera
              </span>
            </label>

            <label htmlFor={INPUT_ID} className="mt-3 rounded-2xl border border-[color:var(--color-line)] py-3 text-[14px] font-medium text-[color:var(--color-accent)] flex items-center justify-center gap-2 cursor-pointer hover:bg-[color:var(--color-bg-2)] transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Ou escolher da galeria
              <span className="text-[11px] opacity-90 text-[color:var(--color-ink-2)] ml-1">· depuis la galerie</span>
            </label>
            <p className="text-[11px] text-[color:var(--color-muted)] text-center mt-4 leading-snug">
              💡 Tire com boa iluminação, mostrando o máximo do cômodo. Inclua uma porta ou móvel se possível — ajuda para estimar tamanho.
            </p>
          </div>
        )}

        {step === "preview" && previewUrl && (
          <div className="px-6 pt-4 fade-in">
            <div className="rounded-2xl overflow-hidden mb-4 border border-[color:var(--color-line)]">
              <img src={previewUrl} alt="Preview" className="w-full h-auto" />
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 py-3 text-[14px] font-medium text-[color:var(--color-muted)] rounded-2xl border border-[color:var(--color-line)]">
                Trocar
              </button>
              <button onClick={analyze} className="flex-[2] btn-primary rounded-2xl py-3 text-[15px] font-semibold flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Analisar
              </button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="px-6 pt-16 text-center fade-in">
            <div className="inline-block w-12 h-12 border-4 border-[color:var(--color-line)] border-t-[color:var(--color-accent)] rounded-full animate-spin mb-4" />
            <p className="text-[15px] font-medium">Analisando a foto...</p>
            <p className="text-[12px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5">Analyse en cours...</p>
            <p className="text-[12px] text-[color:var(--color-muted)] mt-3">~5 segundos</p>
          </div>
        )}

        {step === "error" && (
          <div className="px-6 pt-6 fade-in">
            <div className="card-outlined p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#ff3b30]/10 mx-auto mb-3 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <p className="text-[14px] font-medium mb-2">Erro na análise</p>
              <p className="text-[12px] text-[color:var(--color-muted)] mb-4 break-words">{error}</p>
              <button onClick={reset} className="text-[color:var(--color-accent)] text-[13px] font-medium">
                Tentar de novo
              </button>
            </div>
          </div>
        )}

        {step === "result" && analysis && (
          <div className="px-6 pt-4 fade-in space-y-5">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-[color:var(--color-line)]">
                <img src={previewUrl} alt="Foto analisada" className="w-full h-auto" />
              </div>
            )}

            {/* Ambiente */}
            <div className="card-outlined p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{AMBIENTE_LABEL[analysis.ambiente].emoji}</span>
                <div className="flex-1">
                  <p className="text-[16px] font-semibold leading-tight">{AMBIENTE_LABEL[analysis.ambiente].pt}</p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight">{AMBIENTE_LABEL[analysis.ambiente].fr}</p>
                </div>
              </div>
            </div>

            {/* Métrage — bloc distinct avec garde-fou strict */}
            <div className={`card-outlined p-4 ${confirmedM2 ? "border-[#34c759]" : "border-[color:var(--color-accent)]"}`}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-muted)] font-medium">
                  Tamanho real
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Surface réelle · à mesurer</span>
                </p>
                <span className="text-[10px] text-[color:var(--color-muted)] italic">
                  IA: {CONFIANCA_LABEL[analysis.tamanho_confianca]}
                </span>
              </div>

              <label htmlFor="m2-input" className="block mb-2 cursor-text">
                <span className="text-[10px] uppercase tracking-wide font-bold text-[color:var(--color-accent)] mb-1.5 flex items-center gap-1">
                  ✏️ Toque para digitar o valor real
                  <span className="opacity-95 text-[color:var(--color-ink-2)] normal-case tracking-normal font-normal">· tape la vraie valeur</span>
                </span>
                <div className="rounded-2xl border-2 border-[color:var(--color-accent)] bg-white dark:bg-[color:var(--color-bg-2)] p-4 flex items-baseline gap-2 shadow-sm">
                  <input
                    id="m2-input"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={9999}
                    value={editedM2 || ""}
                    placeholder={
                      analysis.tamanho_min_m2 && analysis.tamanho_max_m2
                        ? `${analysis.tamanho_min_m2}–${analysis.tamanho_max_m2}`
                        : "digite aqui"
                    }
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      setEditedM2(Math.max(0, parseInt(e.target.value) || 0));
                      setConfirmedM2(false);
                    }}
                    className="display text-[40px] num bg-transparent outline-none flex-1 w-full min-w-0 placeholder:text-[color:var(--color-line)]"
                  />
                  <span className="text-[color:var(--color-muted)] text-[18px] font-medium">m²</span>
                </div>
              </label>

              {analysis.tamanho_min_m2 && analysis.tamanho_max_m2 && analysis.tamanho_confianca !== "alta" && (
                <p className="text-[11px] text-[color:var(--color-muted)] leading-snug mb-2">
                  A IA acha que fica entre <b>{analysis.tamanho_min_m2}</b> e <b>{analysis.tamanho_max_m2}</b> m², mas foto sozinha não é precisa.
                  <span className="block opacity-95 text-[color:var(--color-ink-2)] mt-0.5">L'IA estime entre {analysis.tamanho_min_m2} et {analysis.tamanho_max_m2} m², mais la photo ne suffit pas.</span>
                </p>
              )}

              {editedM2 > 0 && !confirmedM2 ? (
                <button
                  onClick={() => setConfirmedM2(true)}
                  className="w-full btn-primary rounded-xl py-2.5 text-[13px] font-semibold"
                >
                  ✓ Confirmar {editedM2} m² (medido com trena)
                </button>
              ) : editedM2 > 0 && confirmedM2 ? (
                <div className="w-full rounded-xl bg-[#34c759]/10 py-2.5 px-3 flex items-center gap-2">
                  <span className="text-[#34c759]">✓</span>
                  <span className="text-[13px] font-semibold text-[#34c759]">{editedM2} m² confirmado</span>
                  <button onClick={() => setConfirmedM2(false)} className="ml-auto text-[11px] text-[color:var(--color-muted)]">Editar</button>
                </div>
              ) : (
                <p className="text-[11px] text-[color:var(--color-muted)] italic leading-snug bg-[color:var(--color-accent)]/5 rounded-lg px-3 py-2">
                  📏 Meça com trena antes de continuar — a precisão do orçamento depende disso.
                  <span className="block opacity-95 text-[color:var(--color-ink-2)] mt-0.5">Mesure au mètre avant de continuer.</span>
                </p>
              )}
            </div>

            {/* Itens detectados */}
            {analysis.itens_detectados.length > 0 && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-muted)] font-medium mb-2 px-2">
                  O que precisa ser feito
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Ce qu'il faut faire</span>
                </p>
                <div className="card-outlined p-4 space-y-2.5">
                  {analysis.itens_detectados.map((it, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: GRAVIDADE_COLOR[it.gravidade] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-tight">{it.tipo}</p>
                        {it.tipo_fr && (
                          <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight">{it.tipo_fr}</p>
                        )}
                        <p className="text-[12px] text-[color:var(--color-muted)] leading-snug mt-0.5">{it.descricao}</p>
                        {it.descricao_fr && (
                          <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-90 leading-snug italic">{it.descricao_fr}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Produtos recomendados */}
            {analysis.produtos_recomendados.length > 0 && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-muted)] font-medium mb-2 px-2">
                  Produtos recomendados
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Produits recommandés</span>
                </p>
                <div className="space-y-2">
                  {analysis.produtos_recomendados.map((prod, i) => {
                    const superficie = confirmedM2 ? editedM2 : 0;
                    const rend = prod.rendimento_m2_por_unidade || 1;
                    const margem = (prod.margem_recomendada_pct || 10) / 100;
                    const qtd = superficie > 0 ? Math.ceil((superficie * (1 + margem)) / rend) : 0;
                    const cobreM2 = qtd * rend;
                    // Prix estimé : moyenne SINAPI matches × surface (grossière estimation)
                    const sinapiAvg = prod.sinapi_matches?.length
                      ? prod.sinapi_matches.reduce((s, m) => s + m.preco, 0) / prod.sinapi_matches.length
                      : 0;
                    const precoTotal = superficie > 0 ? Math.round(sinapiAvg * superficie) : 0;
                    const searchQuery = encodeURIComponent(`${prod.nome} ${prod.marcas_br[0] || ""}`.trim());

                    return (
                      <div key={i} className="card-outlined p-4">
                        <div className="flex items-start gap-2.5 mb-3">
                          <span className="text-xl leading-none pt-0.5">🧴</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold leading-tight">{prod.nome}</p>
                            {prod.nome_fr && (
                              <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight">{prod.nome_fr}</p>
                            )}
                            <p className="text-[11px] text-[color:var(--color-muted)] mt-1">
                              {prod.marcas_br.join(" · ")}
                            </p>
                          </div>
                        </div>

                        {superficie > 0 ? (
                          <div className="rounded-xl bg-[color:var(--color-accent)]/8 p-3 mb-2">
                            <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-accent)] font-bold mb-1.5">
                              🛒 Para {superficie} m² compre
                            </p>
                            <div className="flex items-baseline gap-2">
                              <span className="display text-[24px] num text-[color:var(--color-accent)]">{qtd}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-[13px] font-medium block leading-tight">{prod.unidade_comercial}</span>
                                {prod.unidade_comercial_fr && (
                                  <span className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 block leading-tight">{prod.unidade_comercial_fr}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-[color:var(--color-muted)] mt-1 leading-snug">
                              Cobre ~{cobreM2} m² · margem de {prod.margem_recomendada_pct}% para recortes
                              <span className="block opacity-95 text-[color:var(--color-ink-2)]">Couvre ~{cobreM2} m² · marge de {prod.margem_recomendada_pct}% pour les découpes</span>
                            </p>
                            {precoTotal > 0 && (
                              <p className="text-[12px] font-semibold mt-2 pt-2 border-t border-[color:var(--color-line)]">
                                ≈ R$ {precoTotal.toLocaleString("pt-BR")} <span className="text-[10px] font-normal text-[color:var(--color-muted)]">total (base SINAPI)</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-[color:var(--color-bg-2)] p-3 mb-2 text-center">
                            <p className="text-[11px] text-[color:var(--color-muted)] italic">
                              📏 Confirme o tamanho acima para ver a quantidade e o preço total.
                            </p>
                          </div>
                        )}

                        <p className="text-[11px] text-[color:var(--color-muted)] leading-snug mb-2">
                          Dose : {prod.quantidade_por_m2}
                          {prod.uso && <span className="block italic mt-0.5">{prod.uso}</span>}
                        </p>

                        <div className="flex gap-1.5">
                          <a
                            href={`https://www.obramax.com.br/search?q=${searchQuery}`}
                            target="_blank"
                            rel="noopener"
                            className="flex-1 text-[11px] font-medium text-[color:var(--color-accent)] py-1.5 text-center rounded-lg border border-[color:var(--color-line)]"
                          >
                            🏪 Obramax
                          </a>
                          <a
                            href={`https://lista.mercadolivre.com.br/${searchQuery}`}
                            target="_blank"
                            rel="noopener"
                            className="flex-1 text-[11px] font-medium text-[color:var(--color-accent)] py-1.5 text-center rounded-lg border border-[color:var(--color-line)]"
                          >
                            🛒 ML
                          </a>
                        </div>

                        {prod.sinapi_matches && prod.sinapi_matches.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[10px] text-[color:var(--color-muted)] cursor-pointer">
                              Ver referências SINAPI ({prod.sinapi_matches.length})
                            </summary>
                            <div className="mt-1.5 space-y-1">
                              {prod.sinapi_matches.map(m => (
                                <div key={m.codigo} className="flex items-start justify-between gap-2 text-[10px] leading-snug text-[color:var(--color-muted)]">
                                  <div className="flex-1 min-w-0">
                                    <span className="num opacity-60 mr-1">#{m.codigo}</span>
                                    <span>{m.descricao.length > 55 ? m.descricao.slice(0, 55) + "…" : m.descricao}</span>
                                  </div>
                                  <span className="num font-medium shrink-0">R$ {m.preco.toFixed(2).replace(".", ",")}/{m.und.toLowerCase()}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Passo a passo */}
            {analysis.passo_a_passo.length > 0 && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-muted)] font-medium mb-2 px-2">
                  Como aplicar
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Comment appliquer</span>
                </p>
                <div className="card-outlined p-4 space-y-3">
                  {analysis.passo_a_passo.map(step => (
                    <div key={step.passo} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] text-[11px] font-bold flex items-center justify-center shrink-0 num">
                        {step.passo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold leading-tight">{step.titulo}</p>
                        {step.titulo_fr && (
                          <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight">{step.titulo_fr}</p>
                        )}
                        <p className="text-[12px] text-[color:var(--color-muted)] leading-relaxed mt-1">{step.descricao}</p>
                        {step.descricao_fr && (
                          <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-90 leading-relaxed italic mt-0.5">{step.descricao_fr}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Macros sugeridas — DÉSACTIVÉES tant que m² non confirmé */}
            {analysis.macros_sugeridas.length > 0 && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-muted)] font-medium mb-2 px-2">
                  Criar orçamento
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Créer un devis</span>
                </p>
                {!confirmedM2 && (
                  <p className="text-[11px] text-[color:var(--color-muted)] italic mb-2 px-2">
                    📏 Confirme o tamanho acima para continuar.
                  </p>
                )}
                <div className="space-y-2">
                  {analysis.macros_sugeridas.map((sug, i) => {
                    const macro = getMacro(sug.macro_id);
                    const macroFr = getMacroFr(sug.macro_id);
                    if (!macro) return null;
                    const disabled = !confirmedM2;
                    return (
                      <button
                        key={i}
                        onClick={() => goToEstimate(macro.id)}
                        disabled={disabled}
                        className={`w-full card-outlined p-4 text-left transition ${
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[color:var(--color-accent)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl leading-none">{macro.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] font-semibold leading-tight">{macro.name}</p>
                              {i === 0 && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] shrink-0">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            {macroFr?.name && (
                              <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5 leading-tight">{macroFr.name}</p>
                            )}
                            <p className="text-[12px] text-[color:var(--color-muted)] mt-1.5 leading-snug">{sug.motivo}</p>
                            {sug.motivo_fr && (
                              <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-90 leading-snug italic mt-0.5">{sug.motivo_fr}</p>
                            )}
                          </div>
                          <svg className="text-[color:var(--color-muted)] shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observações */}
            {analysis.observacoes.length > 0 && (
              <div className="rounded-xl bg-[color:var(--color-bg-2)] p-3">
                <p className="text-[11px] text-[color:var(--color-muted)] uppercase tracking-wide font-medium mb-1.5">💡 Observações</p>
                <ul className="space-y-2">
                  {analysis.observacoes.map((o, i) => (
                    <li key={i} className="text-[12px] text-[color:var(--color-muted)] leading-relaxed">
                      • {o}
                      {analysis.observacoes_fr?.[i] && (
                        <span className="block text-[11px] opacity-95 text-[color:var(--color-ink-2)] italic ml-2 mt-0.5">{analysis.observacoes_fr[i]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Partage WhatsApp */}
            {confirmedM2 && (
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="flex-[2] rounded-2xl py-3 text-[14px] font-semibold flex items-center justify-center gap-2 bg-[#25d366] text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Compartilhar no WhatsApp
                </button>
                <button
                  onClick={handleCopy}
                  className="rounded-2xl py-3 px-4 text-[13px] font-medium border border-[color:var(--color-line)] flex items-center gap-1.5"
                  aria-label="Copiar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copiar
                </button>
              </div>
            )}

            <button
              onClick={() => setChatOpen(true)}
              className="w-full btn-primary rounded-2xl py-3.5 text-[15px] font-semibold flex flex-col items-center justify-center gap-0.5"
            >
              <span className="flex items-center gap-2">
                💬 Perguntar à IA sobre esta foto
              </span>
              <span className="text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Poser une question à l'IA</span>
            </button>

            <button onClick={reset} className="w-full text-[12px] text-[color:var(--color-muted)] py-2">
              Analisar outra foto
            </button>
          </div>
        )}
      </div>

      {chatOpen && analysis && (
        <ChatModal
          analysis={analysis}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function ChatModal({ analysis, onClose }: { analysis: PhotoAnalysis; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => analysisContext(analysis), [analysis]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (!hasCredits()) {
      setErr("Sem créditos. Recarregue para continuar a conversar.");
      return;
    }

    setErr("");
    const newHistory: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    deductCredit();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, history: messages, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na resposta.");
      setMessages([...newHistory, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[color:var(--color-bg)]">
      <div className="nav-blur border-b border-[color:var(--color-line)]">
        <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between">
          <button onClick={onClose} className="text-[color:var(--color-accent)] text-[15px] flex items-center gap-0.5 -ml-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar
            <span className="text-[11px] opacity-90 text-[color:var(--color-ink-2)] ml-0.5">· retour</span>
          </button>
          <p className="text-[15px] font-semibold">💬 Chat IA</p>
          <CreditsBadge compact />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto max-w-md w-full mx-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-[color:var(--color-accent)]/10 mx-auto mb-3 flex items-center justify-center text-2xl">
              💬
            </div>
            <p className="text-[14px] font-medium">Pergunte o que quiser sobre esta foto</p>
            <p className="text-[12px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5">Demande ce que tu veux sur cette photo</p>
            <div className="mt-4 space-y-1.5 text-left">
              {[
                "Atrás do muro tem terra, isso muda algo ?",
                "Qual imperm é melhor pra minha situação ?",
                "Quanto tempo demora esse serviço ?",
                "Quais ferramentas preciso alugar ?",
              ].map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setInput(sug)}
                  className="w-full text-left text-[12px] rounded-xl border border-[color:var(--color-line)] px-3 py-2 hover:border-[color:var(--color-accent)] transition"
                >
                  💡 {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-[color:var(--color-accent)] text-white rounded-br-md"
                : "bg-[color:var(--color-bg-2)] rounded-bl-md"
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[color:var(--color-bg-2)] rounded-2xl rounded-bl-md px-3.5 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-muted)] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-muted)] animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-muted)] animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        {err && (
          <div className="rounded-xl bg-[#ff3b30]/10 text-[#ff3b30] px-3 py-2 text-[12px]">{err}</div>
        )}
      </div>

      <div className="border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite sua pergunta…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-[color:var(--color-line)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-accent)] transition max-h-32"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="btn-primary rounded-full w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-30"
            aria-label="Enviar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[color:var(--color-muted)] text-center mt-1.5">
          1 crédito por pergunta · restam <span className="num">{getCredits()}</span>
        </p>
      </div>
    </div>
  );
}
