"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMacro, getMacroFr } from "@/lib/macros";
import type { PhotoAnalysis } from "@/lib/vision";
import { analysisContext, chantierMemoryContext, type ChatMessage } from "@/lib/chat";
import { loadChantiers } from "@/lib/storage";
import { deductCredit, getCredits, hasCredits } from "@/lib/credits";
import { generateWhatsAppSummary, shareWithSystem, whatsAppShareUrl } from "@/lib/share";
import { savePhoto, getDrafts, getPhoto, getPhotosByChantier, deletePhoto, appendChatMessages, onPhotosChange, type PhotoRecord } from "@/lib/photo_history";
import { compressImage, makeThumbnail, PLACEHOLDER_THUMB } from "@/lib/image_processing";
import BeforeAfterSlider from "@/app/components/BeforeAfterSlider";
import type { AfterStyle } from "@/lib/gemini_image";
import { getCurrentLang, bcp47Of, onLangChange, type LangCode } from "@/lib/ui_lang";
import { useT } from "@/lib/i18n";
import { saveLearning, summarizeLearnings, countLearnings } from "@/lib/learnings";
import { summarizePreferences, countPreferenceSignals } from "@/lib/preferences";
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

// Traitement d image (compression, vignette, placeholder) extrait dans lib/image_processing
// pour partage avec la home (input hybride).

// useSearchParams doit être dans un enfant de Suspense pour le prerendering Next 16.
export default function FotoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[13px] text-[color:var(--color-muted)]">Carregando…</div>}>
      <FotoPageInner />
    </Suspense>
  );
}

function FotoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetChantierId = searchParams.get("chantierId");
  const openPhotoId = searchParams.get("openPhoto");
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
  const [userScope, setUserScope] = useState<string>("");
  const [fotoUiLang, setFotoUiLang] = useState<LangCode>("pt");
  const tr = useT();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<{ src: string; style: AfterStyle; mode: "gemini" | "demo" } | null>(null);
  const [afterLoading, setAfterLoading] = useState<AfterStyle | null>(null);
  const [afterError, setAfterError] = useState<string>("");
  const [drafts, setDrafts] = useState<PhotoRecord[]>([]);
  const [overrideAmbiente, setOverrideAmbiente] = useState<PhotoAnalysis["ambiente"] | null>(null);
  const [ambientePickerOpen, setAmbientePickerOpen] = useState<boolean>(false);
  const [learningsCount, setLearningsCount] = useState<number>(0);

  // Nettoie l'ancienne clé "cq_last_photo_analysis" (avant migration vers cq_photos).
  // Puis charge les brouillons (photos analysées mais non rattachées à un chantier)
  // et écoute les changements pour les rafraîchir en temps réel.
  useEffect(() => {
    localStorage.removeItem("cq_last_photo_analysis");
    setDrafts(getDrafts());
    setLearningsCount(countLearnings());
    setFotoUiLang(getCurrentLang());
    // Si openPhoto=X est présent en URL, on ouvre directement cette photo en step=result.
    // Utilisé par la home après une analyse hybride (photo depuis input home).
    if (openPhotoId) {
      const rec = getPhoto(openPhotoId);
      if (rec) openDraft(rec);
    }
    const offP = onPhotosChange(() => {
      setDrafts(getDrafts());
      setLearningsCount(countLearnings());
    });
    const offL = onLangChange(setFotoUiLang);
    return () => { offP(); offL(); };
    // openPhotoId est intentionnellement omis — on ne rouvre que lors du mount initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDraft(rec: PhotoRecord) {
    setPhotoId(rec.id);
    setAnalysis(rec.analysis);
    setUserScope(rec.userScope);
    setPreviewUrl(rec.thumbnail);
    setFile(null);
    const conf = rec.analysis.tamanho_confianca;
    setEditedM2(conf === "alta" ? rec.analysis.tamanho_estimado_m2 : 0);
    setConfirmedM2(false);
    setStep("result");
  }

  function removeDraft(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Excluir este rascunho?")) return;
    deletePhoto(id);
  }

  // Génère une preview "après reforma" via Google Gemini (ou fallback Unsplash en mode démo).
  // Utilise la photo courante (file ou previewUrl si restauré depuis brouillon).
  async function generateAfter(style: AfterStyle) {
    setAfterError("");
    setAfterLoading(style);
    try {
      let source: File | null = file;
      // Si la photo vient d un brouillon restauré, on n a pas de File — on refetch la thumbnail.
      if (!source && previewUrl) {
        try {
          const resp = await fetch(previewUrl);
          const blob = await resp.blob();
          source = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
        } catch {
          throw new Error("Foto original não disponível para gerar depois.");
        }
      }
      if (!source) throw new Error("Sem foto para gerar depois.");

      const form = new FormData();
      form.append("photo", source);
      form.append("style", style);
      if (analysis?.ambiente) form.append("ambiente", analysis.ambiente);

      const res = await fetch("/api/generate-after", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar depois.");
      setAfterImage({ src: data.imageDataUrl, style, mode: data.mode });
    } catch (e) {
      setAfterError(e instanceof Error ? e.message : String(e));
    } finally {
      setAfterLoading(null);
    }
  }

  function pickFile() {
    inputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setAnalysis(null);
    try {
      const compressed = await compressImage(f);
      setFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setStep("preview");
    } catch {
      setError("Formato não suportado. Escolha JPEG ou PNG. / Format non pris en charge, choisis JPEG ou PNG.");
      setStep("error");
    }
  }

  async function analyze() {
    if (!file) return;
    if (!hasCredits()) {
      setError("Sem créditos. Recarregue para continuar. / Plus de crédits. Recharge pour continuer.");
      setStep("error");
      return;
    }
    setStep("analyzing");
    setError("");
    try {
      const form = new FormData();
      form.append("photo", file);
      if (userScope.trim()) form.append("scope", userScope.trim());
      // Injecte les apprentissages accumulés (corrections passées) + préférences détectées.
      // On les concatène pour envoyer un seul champ "context" plus digeste à l'API.
      const learnings = summarizeLearnings();
      const preferences = summarizePreferences();
      const combined = [learnings, preferences].filter(Boolean).join("");
      if (combined) form.append("learnings", combined);
      const res = await fetch("/api/analyze-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao analisar.");
      deductCredit();
      setAnalysis(data.analysis);
      // Si confiance basse, on n'affiche PAS le chiffre par défaut — l'user doit mesurer.
      const conf = data.analysis.tamanho_confianca;
      setEditedM2(conf === "alta" ? data.analysis.tamanho_estimado_m2 : 0);
      setConfirmedM2(false);
      // Sauve l'analyse dans l'historique. La vignette est optionnelle : si sa génération
      // échoue (Safari ancien, format exotique), on tombe sur un placeholder — l'analyse
      // et le scope sont l'essentiel et doivent être persistés dans tous les cas.
      let thumbnail = PLACEHOLDER_THUMB;
      try {
        thumbnail = await makeThumbnail(file);
      } catch (thumbErr) {
        console.warn("Thumbnail generation failed, using placeholder:", thumbErr);
      }
      try {
        const saved = savePhoto({
          chantierId: targetChantierId,
          thumbnail,
          analysis: data.analysis,
          userScope: userScope.trim(),
        });
        setPhotoId(saved.id);
        // Learning : le scope textuel exprime ce qui compte pour l'user. On log
        // pour identifier des mots-clés récurrents (marques favorites, styles, contraintes).
        if (userScope.trim().length > 5) {
          saveLearning({
            type: "scope",
            context: { ambienteDetected: data.analysis.ambiente },
            correction: { scopeText: userScope.trim() },
          });
        }
      } catch (saveErr) {
        console.error("Photo save failed:", saveErr);
      }
      setStep("result");
      if (targetChantierId) {
        // Léger délai pour que l'user voie brièvement le résultat avant redirect.
        setTimeout(() => router.push(`/contas/${targetChantierId}`), 800);
      }
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
    setUserScope("");
    setPhotoId(null);
    setAfterImage(null);
    setAfterError("");
    setAfterLoading(null);
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
    const params = new URLSearchParams({ macroId, qty: String(editedM2) });
    if (photoId) params.set("fromPhoto", photoId);
    router.push(`/estimate?${params.toString()}`);
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
        {targetChantierId && (
          <div className="px-6 pt-4">
            <div className="rounded-2xl bg-[color:var(--color-accent-soft)] border border-[color:var(--color-accent)]/20 px-4 py-2.5 flex items-center gap-2">
              <span className="text-lg">📎</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[color:var(--color-accent)]">Foto para o chantier existente</p>
                <p className="text-[11px] text-[color:var(--color-ink-2)]">Sera ajoutée à la timeline du chantier</p>
              </div>
            </div>
          </div>
        )}
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">{tr("foto.analyze")}</h1>
          <p className="text-[13px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5">{tr("foto.analyzeSub")}</p>
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
              <p className="text-[15px] font-medium mb-1">{tr("foto.takePhoto")}</p>
              <p className="text-[12px] text-[color:var(--color-ink-2)] opacity-95 mb-4">{tr("foto.takePhotoSub")}</p>
              <p className="text-[13px] text-[color:var(--color-muted)] max-w-[280px] mx-auto mb-6 leading-relaxed">
                {tr("foto.aiHelp")}
              </p>
              <span className="btn-primary rounded-2xl px-6 py-3 text-[15px] font-semibold inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {tr("foto.openCamera")}
              </span>
            </label>

            <label htmlFor={INPUT_ID} className="mt-3 rounded-2xl border border-[color:var(--color-line)] py-3 text-[14px] font-medium text-[color:var(--color-accent)] flex items-center justify-center gap-2 cursor-pointer hover:bg-[color:var(--color-bg-2)] transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {tr("foto.chooseGallery")}
            </label>
            <p className="text-[11px] text-[color:var(--color-muted)] text-center mt-4 leading-snug">
              {tr("foto.lightingTip")}
            </p>

            {(learningsCount >= 3 || countPreferenceSignals() >= 3) && (
              <Link
                href="/aprendizados"
                className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[color:var(--color-accent)] hover:opacity-80 transition"
              >
                <span>🧠</span>
                <span>
                  A IA aprendeu com você
                  {learningsCount > 0 ? ` · ${learningsCount} correções` : ""}
                  {countPreferenceSignals() > 0 ? ` · ${countPreferenceSignals()} preferências` : ""}
                </span>
                <span className="text-[color:var(--color-muted)]">→</span>
              </Link>
            )}

            {drafts.length > 0 && !targetChantierId && (
              <div className="mt-8">
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
                  {tr("foto.drafts")} <span className="text-[10px] normal-case tracking-normal opacity-70">· {tr("foto.draftsSub")} ({drafts.length})</span>
                </p>
                <div className="space-y-2">
                  {drafts.map(rec => {
                    const ambienteKey = rec.analysis.ambiente;
                    const amb = AMBIENTE_LABEL[ambienteKey];
                    const date = new Date(rec.dateISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                    const nItens = rec.analysis.itens_detectados?.length ?? 0;
                    const nMessages = rec.chatHistory?.length ?? 0;
                    return (
                      <button
                        key={rec.id}
                        onClick={() => openDraft(rec)}
                        className="w-full flex items-center gap-3 p-2 rounded-2xl border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] transition text-left"
                      >
                        <div className="relative shrink-0">
                          <img
                            src={rec.thumbnail}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover bg-[color:var(--color-bg-2)]"
                          />
                          {nMessages > 0 && (
                            <span className="absolute -bottom-1 -right-1 bg-[color:var(--color-accent)] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                              💬 {Math.ceil(nMessages / 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">
                            {amb.emoji} {amb.pt} · {rec.analysis.tamanho_estimado_m2} m²
                          </p>
                          <p className="text-[11px] text-[color:var(--color-muted)] truncate">
                            {rec.userScope ? `“${rec.userScope}”` : `${nItens} itens detectados`} · {date}
                          </p>
                        </div>
                        <span
                          onClick={e => removeDraft(e, rec.id)}
                          className="text-[11px] text-[color:var(--color-muted)] px-2 py-1 hover:text-[#ff3b30]"
                          role="button"
                          aria-label="Excluir rascunho"
                        >
                          ✕
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && previewUrl && (
          <div className="px-6 pt-4 fade-in">
            <div className="rounded-2xl overflow-hidden mb-4 border border-[color:var(--color-line)]">
              <img src={previewUrl} alt="Preview" className="w-full h-auto" />
            </div>
            <label className="block mb-4">
              <span className="block text-[13px] font-medium mb-1.5">
                Escopo ou pergunta
                <span className="text-[color:var(--color-muted)] font-normal"> · Scope ou question</span>
              </span>
              <textarea
                value={userScope}
                onChange={e => setUserScope(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Ex: só pintar as paredes. Ou: quanto tempo leva para 1 pessoa? Ou os dois."
                lang={bcp47Of(fotoUiLang)}
                inputMode="text"
                className="w-full rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-2)] px-4 py-3 text-[14px] resize-none focus:outline-none focus:border-[color:var(--color-accent)]"
              />
              <span className="block text-[11px] text-[color:var(--color-muted)] mt-1">
                {userScope.length}/500 · a IA respeita seu escopo E responde suas perguntas
              </span>
            </label>
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

            {/* Confirmation de sauvegarde — visible uniquement en mode brouillon (pas en mode chantierId qui redirige) */}
            {photoId && !targetChantierId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#34c759]/10 text-[#34c759] text-[12px] font-medium">
                <span>✓</span>
                <span>{tr("foto.savedDraft")}</span>
                <button
                  type="button"
                  onClick={reset}
                  className="ml-auto text-[color:var(--color-accent)] text-[11px] font-semibold"
                >
                  {tr("foto.analyzeAnother")}
                </button>
              </div>
            )}

            {/* Alerte structurelle : détectée si les observações contiennent "engenheiro" ou "CREA"
                ou "estrutural" — l'IA suit la règle du prompt et flag ces cas. */}
            {(() => {
              const allObs = [...(analysis.observacoes || []), ...(analysis.observacoes_fr || [])];
              const isStructural = allObs.some(o => /engenheiro|CREA|estrutural|contenção|contention|porteur|porteur|hydrostatic|hidrostátic/i.test(o));
              if (!isStructural) return null;
              return (
                <div className="card-outlined p-4 border-2 border-[#ff9500] bg-[#fff8ee]">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] uppercase tracking-wide text-[#ff9500] font-bold mb-1">
                        Obra estrutural detectada
                      </p>
                      <p className="text-[13px] leading-relaxed">
                        A IA identificou uma obra que envolve cargas ou pressões críticas (muro de contenção, laje, muro portante...).
                        Consulte um <b>engenheiro estrutural CREA</b> antes de qualquer intervenção. Um laudo custa ~R$ 2.000-4.000 e evita colapsos.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ✨ Ver depois — génération IA d une preview après reforma (3 styles).
                Sans clé GOOGLE_API_KEY côté serveur → mode démo (inspiration Unsplash). */}
            {previewUrl && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-2 px-2">
                  ✨ Ver depois
                  <span className="block normal-case tracking-normal text-[11px] font-normal text-[color:var(--color-muted)]">
                    Preview IA · Voir après reforma
                  </span>
                </p>

                {afterImage ? (
                  <div className="card-outlined overflow-hidden">
                    <BeforeAfterSlider
                      beforeSrc={previewUrl}
                      afterSrc={afterImage.src}
                      aspectRatio={4 / 3}
                    />
                    <div className="p-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-[color:var(--color-accent)] uppercase tracking-wide">
                        {afterImage.style}
                      </span>
                      {afterImage.mode === "demo" && (
                        <span className="text-[10px] text-[#ff9500] font-medium">
                          Modo demo · inspiração genérica
                        </span>
                      )}
                      <button
                        onClick={() => setAfterImage(null)}
                        className="ml-auto text-[11px] font-medium text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)]"
                      >
                        Trocar estilo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card-outlined p-4">
                    <p className="text-[12px] text-[color:var(--color-muted)] mb-3">
                      Escolha um estilo — a IA gera uma preview do resultado após reforma :
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["moderno", "rustico", "escandinavo"] as AfterStyle[]).map(s => {
                        const label = s === "moderno" ? "Moderno" : s === "rustico" ? "Rústico" : "Escandinavo";
                        const emoji = s === "moderno" ? "🖤" : s === "rustico" ? "🪵" : "🤍";
                        const busy = afterLoading === s;
                        const disabled = afterLoading !== null;
                        return (
                          <button
                            key={s}
                            onClick={() => generateAfter(s)}
                            disabled={disabled}
                            className="flex flex-col items-center gap-1 py-3 rounded-xl border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] transition text-[12px] font-medium disabled:opacity-40"
                          >
                            {busy ? (
                              <span className="inline-block w-4 h-4 border-2 border-[color:var(--color-accent)]/30 border-t-[color:var(--color-accent)] rounded-full animate-spin" />
                            ) : (
                              <span className="text-lg">{emoji}</span>
                            )}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {afterLoading && (
                      <p className="text-[11px] text-[color:var(--color-muted)] mt-3 text-center">
                        Gerando ({afterLoading})… ~15-30s
                      </p>
                    )}
                    {afterError && (
                      <p className="text-[11px] text-[#ff3b30] mt-2">{afterError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Réponse à la question du user dans SA langue (nouveau schema { text, lang })
                avec fallback sur l'ancien { pt, fr } pour les analyses pré-2026-09. */}
            {(() => {
              const r = analysis.resposta_ao_usuario;
              if (!r) return null;
              const mainText = r.text || r.pt;
              const legacyFr = !r.text ? r.fr : undefined;
              if (!mainText) return null;
              return (
                <div className="card-outlined p-4 border-[color:var(--color-accent)]">
                  <div className="flex items-start gap-3">
                    <span className="accordion-icon bg-[color:var(--color-accent-soft)]">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-1">
                        Resposta {r.lang ? <span className="ml-1 font-normal normal-case tracking-normal text-[10px] text-[color:var(--color-muted)]">({r.lang})</span> : null}
                      </p>
                      <p className="text-[13px] leading-relaxed">{mainText}</p>
                      {legacyFr && (
                        <p className="text-[12px] text-[color:var(--color-ink-2)] italic leading-relaxed mt-1">{legacyFr}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Ambiente — cliquable pour override si l'IA se trompe */}
            {(() => {
              const currentAmb = overrideAmbiente ?? analysis.ambiente;
              const label = AMBIENTE_LABEL[currentAmb];
              return (
                <div className="card-outlined">
                  <button
                    type="button"
                    onClick={() => setAmbientePickerOpen(v => !v)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    <span className="text-3xl">{label.emoji}</span>
                    <div className="flex-1">
                      <p className="text-[16px] font-semibold leading-tight">{label.pt}</p>
                      <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight">{label.fr}</p>
                    </div>
                    <span className="text-[11px] text-[color:var(--color-accent)] font-medium">
                      {ambientePickerOpen ? "Fechar" : (overrideAmbiente ? "Alterado ✓" : "Não é isso?")}
                    </span>
                  </button>
                  {ambientePickerOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-[color:var(--color-line)]">
                      <p className="text-[11px] text-[color:var(--color-muted)] mb-2 mt-2">
                        Escolha o tipo correto · Choisis le bon type
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(AMBIENTE_LABEL) as PhotoAnalysis["ambiente"][]).map(key => {
                          const opt = AMBIENTE_LABEL[key];
                          const active = key === currentAmb;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                // Learning : si l'user override, on log la correction pour calibrer les futures analyses.
                                if (key !== analysis.ambiente) {
                                  saveLearning({
                                    type: "ambiente",
                                    context: { ambienteDetected: analysis.ambiente },
                                    correction: { ambienteCorrected: key },
                                  });
                                }
                                setOverrideAmbiente(key === analysis.ambiente ? null : key);
                                setAmbientePickerOpen(false);
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                                active
                                  ? "bg-[color:var(--color-accent)] text-white"
                                  : "bg-[color:var(--color-bg-2)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-line)]"
                              }`}
                            >
                              <span>{opt.emoji}</span>
                              <span className="truncate">{opt.pt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Métrage — bloc distinct avec garde-fou strict */}
            <div className={`card-outlined p-4 ${confirmedM2 ? "border-[#34c759]" : "border-[color:var(--color-accent)]"}`}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">
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
                  onClick={() => {
                    // Learning : si le m² confirmé diffère significativement (>15%) de l'estimation IA,
                    // on log pour ajuster les futures estimations dans le même sens.
                    const detected = analysis.tamanho_estimado_m2;
                    if (detected > 0 && Math.abs(editedM2 - detected) / detected > 0.15) {
                      saveLearning({
                        type: "m2_delta",
                        context: { m2Detected: detected, ambienteDetected: analysis.ambiente },
                        correction: { m2Corrected: editedM2 },
                      });
                    }
                    setConfirmedM2(true);
                  }}
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
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-2">
                  {tr("foto.itens")}
                  <span className="block normal-case tracking-normal text-[11px] opacity-95 font-normal text-[color:var(--color-ink-2)]">{tr("foto.itensSub")}</span>
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

            {/* Produtos recomendados — accordéon fermé par défaut (long) */}
            {analysis.produtos_recomendados.length > 0 && (
              <details className="accordion">
                <summary>
                  <span className="accordion-icon bg-[#fff4e6]">🧴</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-semibold leading-tight">{tr("foto.produtos")}</span>
                    <span className="block text-[11px] text-[color:var(--color-muted)]">{analysis.produtos_recomendados.length} · {tr("foto.produtosSub")}</span>
                  </span>
                </summary>
                <div className="accordion-body space-y-2 pt-3">
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
              </details>
            )}

            {/* Passo a passo — accordéon fermé par défaut */}
            {analysis.passo_a_passo.length > 0 && (
              <details className="accordion">
                <summary>
                  <span className="accordion-icon bg-[#e8f2ff]">📋</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-semibold leading-tight">{tr("foto.passos")}</span>
                    <span className="block text-[11px] text-[color:var(--color-muted)]">{analysis.passo_a_passo.length} · {tr("foto.passosSub")}</span>
                  </span>
                </summary>
                <div className="accordion-body pt-3">
                <div className="space-y-3">
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
              </details>
            )}

            {/* Macros sugeridas — DÉSACTIVÉES tant que m² non confirmé */}
            {analysis.macros_sugeridas.length > 0 && (
              <div>
                <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-2">
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

            {/* Observações — accordéon fermé */}
            {analysis.observacoes.length > 0 && (
              <details className="accordion">
                <summary>
                  <span className="accordion-icon bg-[#fff9db]">💡</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-semibold leading-tight">{tr("foto.observacoes")}</span>
                    <span className="block text-[11px] text-[color:var(--color-muted)]">{analysis.observacoes.length} · {tr("foto.observacoesSub")}</span>
                  </span>
                </summary>
                <div className="accordion-body pt-3">
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
              </details>
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
          photoId={photoId}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function ChatModal({ analysis, photoId, onClose }: { analysis: PhotoAnalysis; photoId: string | null; onClose: () => void }) {
  // Reprise auto : si photoId fourni, on charge l'historique persisté au mount.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!photoId) return [];
    if (typeof window === "undefined") return [];
    try {
      const list = JSON.parse(localStorage.getItem("cq_photos") || "[]") as PhotoRecord[];
      return list.find(p => p.id === photoId)?.chatHistory || [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Langue UI courante pour orienter le clavier + dictée iOS sur le textarea.
  const [uiLang, setUiLang] = useState<LangCode>("pt");
  useEffect(() => {
    setUiLang(getCurrentLang());
    return onLangChange(setUiLang);
  }, []);

  // Contexte enrichi cross-photo : si la photo est rattachée à un chantier avec
  // d'autres photos, on injecte tout l'historique du chantier (fotos + conversas).
  // Sinon fallback sur l'ancien contexte simple (analyse courante seule).
  const { context, memoryStats } = useMemo(() => {
    // Préférences du user (détectées passivement depuis chats, scopes, feedbacks).
    const prefsSummary = summarizePreferences();
    const currentPhoto = photoId ? getPhoto(photoId) : undefined;
    if (!currentPhoto || !currentPhoto.chantierId) {
      return { context: analysisContext(analysis) + prefsSummary, memoryStats: null };
    }
    const chantier = loadChantiers().find(c => c.id === currentPhoto.chantierId);
    const chantierPhotos = getPhotosByChantier(currentPhoto.chantierId);
    const otherPhotos = chantierPhotos.filter(p => p.id !== currentPhoto.id);
    if (otherPhotos.length === 0) {
      return { context: analysisContext(analysis) + prefsSummary, memoryStats: null };
    }
    const nExchanges = chantierPhotos.reduce((s, p) => s + Math.ceil((p.chatHistory?.length ?? 0) / 2), 0);
    return {
      context: chantierMemoryContext(chantier?.name || "Chantier", currentPhoto, otherPhotos) + prefsSummary,
      memoryStats: { nPhotos: chantierPhotos.length, nExchanges },
    };
  }, [analysis, photoId]);

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
    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory: ChatMessage[] = [...messages, userMsg];
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
      const assistantMsg: ChatMessage = { role: "assistant", content: data.reply };
      setMessages([...newHistory, assistantMsg]);
      // Persiste la paire (user + assistant) sur la photo pour reprise ultérieure.
      if (photoId) appendChatMessages(photoId, [userMsg, assistantMsg]);
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
        {memoryStats && (
          <div className="max-w-md mx-auto px-6 pb-2">
            <div className="flex items-center gap-2 rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-accent)]">
              <span>🧠</span>
              <span>Memória do chantier ativa · {memoryStats.nPhotos} foto{memoryStats.nPhotos > 1 ? "s" : ""} · {memoryStats.nExchanges} conversa{memoryStats.nExchanges > 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
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
            lang={bcp47Of(uiLang)}
            inputMode="text"
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
