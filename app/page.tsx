"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CreditsBadge from "@/app/components/CreditsBadge";
import LangSelector from "@/app/components/LangSelector";
import { getCurrentLang, bcp47Of, onLangChange, type LangCode } from "@/lib/ui_lang";
import { deleteChantier, loadChantiers, seedDemoIfEmpty } from "@/lib/storage";
import { getService } from "@/lib/sinapi";
import { fmtBRL, midOf } from "@/lib/estimate";
import { loadAllPayments, type Payment } from "@/lib/payments";
import { loadPhotos, onPhotosChange, savePhoto, type PhotoRecord } from "@/lib/photo_history";
import { compressImage, makeThumbnail, PLACEHOLDER_THUMB } from "@/lib/image_processing";
import { deductCredit, hasCredits } from "@/lib/credits";
import { summarizeLearnings, countLearnings } from "@/lib/learnings";
import { summarizePreferences, countPreferenceSignals } from "@/lib/preferences";
import type { PhotoAnalysis } from "@/lib/vision";
import type { Chantier } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [ready, setReady] = useState(false);

  // Input hybride — 5 max par analyse (au delà, timeout Vercel 60s dépassé sur Vision).
  // L user peut ajouter d autres photos APRÈS création du chantier via /contas timeline.
  const MAX_PHOTOS = 5;
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compteurs des apprentissages (calculés au mount, réactualisés au refresh)
  const [nLearnings, setNLearnings] = useState(0);
  const [nPreferences, setNPreferences] = useState(0);

  // Langue UI (contrôle le clavier iOS via lang="fr-FR" sur textarea + <html>)
  const [uiLang, setUiLang] = useState<LangCode>("pt");

  useEffect(() => {
    seedDemoIfEmpty();
    setChantiers(loadChantiers());
    setPayments(loadAllPayments());
    setPhotos(loadPhotos());
    setNLearnings(countLearnings());
    setNPreferences(countPreferenceSignals());
    setUiLang(getCurrentLang());
    setReady(true);
    const offP = onPhotosChange(() => {
      setPhotos(loadPhotos());
      setNLearnings(countLearnings());
      setNPreferences(countPreferenceSignals());
    });
    const offL = onLangChange(setUiLang);
    return () => { offP(); offL(); };
  }, []);

  const paymentsByChantier = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.chantierId] = (acc[p.chantierId] || 0) + p.valor;
    return acc;
  }, {});

  const photosByChantier = photos.reduce<Record<string, PhotoRecord[]>>((acc, p) => {
    if (!p.chantierId) return acc;
    (acc[p.chantierId] ||= []).push(p);
    return acc;
  }, {});

  const totalMid = chantiers.reduce((s, c) => s + midOf(c.total), 0);

  function handleDelete(id: string) {
    if (!confirm("Excluir?")) return;
    deleteChantier(id);
    setChantiers(loadChantiers());
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setError("");
    const remaining = MAX_PHOTOS - files.length;
    if (remaining <= 0) {
      setError(`Máximo ${MAX_PHOTOS} fotos por análise. Depois de criar o chantier, você pode adicionar outras fotos na timeline.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const dropped = Math.max(0, selected.length - remaining);
    const toAdd = selected.slice(0, remaining);

    // Budget Vercel body 4.5MB — on adapte la compression au nombre total de photos
    // qu on aura après cet ajout pour éviter un status 413 côté serveur.
    // 1-2 photos : qualité max. 3-5 : intermédiaire. 6+ : compact garanti sous 200 KB.
    const newTotal = files.length + toAdd.length;
    const maxDim = newTotal <= 2 ? 2000 : newTotal <= 5 ? 1500 : 1024;
    const quality = newTotal <= 2 ? 0.85 : newTotal <= 5 ? 0.8 : 0.7;

    // Compression + création de preview URL par photo. On tolère qu une photo échoue
    // (ex : HEIC ancien iOS non décodable) sans planter tout le lot.
    const compressed: File[] = [];
    const urls: string[] = [];
    let failedCount = 0;
    for (const f of toAdd) {
      try {
        const c = await compressImage(f, maxDim, quality);
        const url = URL.createObjectURL(c);
        compressed.push(c);
        urls.push(url);
      } catch (err) {
        console.warn("Falha ao processar foto:", f.name, err);
        failedCount++;
      }
    }

    if (compressed.length > 0) {
      setFiles(prev => [...prev, ...compressed]);
      setPreviewUrls(prev => [...prev, ...urls]);
    }

    // Messages selon les cas — priorité aux échecs, puis au trop-plein.
    if (failedCount > 0 && compressed.length === 0) {
      setError(`Não consegui ler ${failedCount === 1 ? "essa foto" : "essas fotos"}. Tente formato JPEG ou PNG.`);
    } else if (failedCount > 0) {
      setError(`${failedCount} foto${failedCount > 1 ? "s" : ""} não pôde ser lida (formato desconhecido).`);
    } else if (dropped > 0) {
      setError(`Você selecionou ${selected.length} fotos, mas o máximo é ${MAX_PHOTOS} por análise. ${dropped} foram ignoradas — adicione elas depois na timeline do chantier.`);
    }

    // Reset l input pour permettre de re-sélectionner la même photo si retirée puis re-choisie.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function submit() {
    const t = text.trim();
    if (!t && files.length === 0) return;
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      if (files.length > 0) {
        // Mode photo(s) : upload multi + Vision + savePhoto de la première → /foto?openPhoto=X
        if (!hasCredits()) {
          setError("Sem créditos. Recarregue para continuar.");
          setSubmitting(false);
          return;
        }
        // Safety : si le total des photos actuelles dépasse ~3.5MB, on recompresse
        // pour tenir dans le budget Vercel 4.5MB (base64 grossit de 33%).
        // Cas d usage : l user a ajouté photos une par une, les premières sont en 2000px.
        const totalSize = files.reduce((s, f) => s + f.size, 0);
        const BUDGET = 3.2 * 1024 * 1024; // 3.2 MB laisse marge pour scope + learnings
        let filesToSend = files;
        if (totalSize > BUDGET && files.length >= 2) {
          try {
            const targetDim = files.length <= 5 ? 1200 : 900;
            filesToSend = await Promise.all(files.map(f => compressImage(f, targetDim, 0.7)));
          } catch {
            // Fallback : on tente d envoyer tel quel, le serveur renverra 413 si trop gros.
          }
        }
        const form = new FormData();
        filesToSend.forEach(f => form.append("photos", f));
        if (t) form.append("scope", t);
        const learnings = summarizeLearnings();
        const prefs = summarizePreferences();
        const combined = [learnings, prefs].filter(Boolean).join("");
        if (combined) form.append("learnings", combined);
        let res: Response;
        try {
          res = await fetch("/api/analyze-photo", { method: "POST", body: form });
        } catch {
          throw new Error("Falha de conexão ao servidor. Verifique sua internet.");
        }
        let data: { error?: string; analysis?: PhotoAnalysis; nPhotos?: number };
        try {
          data = await res.json();
        } catch {
          throw new Error(`Servidor respondeu inesperadamente (status ${res.status}). Tente com menos fotos.`);
        }
        if (!res.ok) throw new Error(data.error || `Erro ao analisar (status ${res.status}).`);
        if (!data.analysis) throw new Error("Resposta do servidor sem análise.");
        deductCredit();
        // Vignette générée depuis la première photo (représentative du chantier).
        let thumb = PLACEHOLDER_THUMB;
        try { thumb = await makeThumbnail(files[0]); } catch {}
        const saved = savePhoto({
          chantierId: null,
          thumbnail: thumb,
          analysis: data.analysis,
          userScope: t,
        });
        router.push(`/foto?openPhoto=${saved.id}`);
      } else {
        // Mode texte seul : /api/suggest-macro → /estimate?macroId=X&qty=Y
        const res = await fetch("/api/suggest-macro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao sugerir macro.");
        const s = data.suggestion;
        router.push(`/estimate?macroId=${s.macroId}&qty=${s.qty}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="nav-blur sticky top-0 z-40 max-w-md mx-auto">
        <div className="px-6 py-3 flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold flex-1 truncate">Custa Quanto</p>
          <LangSelector />
          <CreditsBadge compact />
        </div>
      </div>

      <div className="max-w-md mx-auto pb-16">
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">Início</h1>
        </div>

        {ready && chantiers.length > 0 && (
          <div className="px-6 pt-4 pb-6 fade-in fade-in-1">
            <p className="text-[12px] text-[color:var(--color-muted)]">Total dos seus chantiers</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[color:var(--color-muted)] text-xl font-medium">R$</span>
              <span className="display text-[40px]">{Math.round(totalMid).toLocaleString("pt-BR")}</span>
              <span className="text-[12px] text-[color:var(--color-muted)] ml-2">
                {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Input hybride — le point d entrée principal de l app */}
        <div className="px-6 pt-2 pb-6 fade-in fade-in-2">
          <div className="card-outlined p-4">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-2">
              Nova reforma
              <span className="ml-2 normal-case tracking-normal font-normal text-[color:var(--color-muted)]">· Nouveau chantier</span>
            </p>

            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Ex: quero pintar minha cozinha de 15 m². Ou tire uma foto e deixe a IA analisar."
              lang={bcp47Of(uiLang)}
              inputMode="text"
              className="w-full bg-[color:var(--color-bg-2)] rounded-2xl px-4 py-3 text-[14px] outline-none resize-none placeholder:text-[color:var(--color-muted)] focus:bg-white focus:border focus:border-[color:var(--color-line-2)] transition"
              disabled={submitting}
            />

            {previewUrls.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-20 h-20 rounded-xl object-cover border border-[color:var(--color-line)]"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center"
                      aria-label={`Retirar foto ${idx + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onFileChange}
              className="sr-only"
              id="hybrid-photo"
              disabled={submitting || files.length >= MAX_PHOTOS}
            />

            <div className="flex gap-2 mt-3">
              <label
                htmlFor="hybrid-photo"
                className={`shrink-0 rounded-2xl border border-[color:var(--color-line)] h-12 px-3 flex items-center justify-center gap-1.5 cursor-pointer transition ${submitting || files.length >= MAX_PHOTOS ? "opacity-50 pointer-events-none" : "hover:border-[color:var(--color-accent)]"}`}
                aria-label="Adicionar foto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {files.length > 0 && (
                  <span className="text-[12px] font-medium num">{files.length}/{MAX_PHOTOS}</span>
                )}
              </label>

              <button
                onClick={submit}
                disabled={submitting || (!text.trim() && files.length === 0)}
                className="flex-1 btn-primary rounded-2xl py-3 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Analisando…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analisar
                  </>
                )}
              </button>
            </div>

            {/* Indicateur d'apprentissage : montre pendant l'analyse ce que l'IA prend en compte */}
            {submitting && (nLearnings > 0 || nPreferences > 0) && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[color:var(--color-accent-soft)] px-3 py-2 text-[11px] text-[color:var(--color-accent)]">
                <span>🧠</span>
                <span className="flex-1">
                  Aplicando
                  {nLearnings > 0 && ` ${nLearnings} correção${nLearnings > 1 ? "s" : ""}`}
                  {nLearnings > 0 && nPreferences > 0 && " +"}
                  {nPreferences > 0 && ` ${nPreferences} preferência${nPreferences > 1 ? "s" : ""}`} aprendidas
                </span>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-[#ff3b30] mt-2">{error}</p>
            )}
            <p className="text-[10px] text-[color:var(--color-muted)] mt-2 leading-snug">
              Digite, tire uma foto (ou várias), ou os dois. A IA decide o resto.
            </p>
          </div>
        </div>

        {chantiers.length > 0 && (
          <div className="px-6 mb-8 fade-in fade-in-3">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
              Salvos
            </p>
            <div className="space-y-3">
              {chantiers
                .slice()
                .reverse()
                .map(c => {
                  const mid = midOf(c.total);
                  const date = new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                  const nPosts = c.posts.length;
                  const emojis = c.posts
                    .map(p => getService(p.serviceId)?.emoji)
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(" ");
                  const pago = paymentsByChantier[c.id] || 0;
                  const pct = mid > 0 ? pago / mid : 0;
                  const overshoot = pago > mid;
                  const cPhotos = photosByChantier[c.id] || [];
                  const lastPhoto = cPhotos[cPhotos.length - 1];
                  return (
                    <div key={c.id} className="card-outlined p-4">
                      <div className="flex items-start gap-3">
                        {lastPhoto ? (
                          <div className="relative shrink-0">
                            <img
                              src={lastPhoto.thumbnail}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover"
                            />
                            {cPhotos.length > 1 && (
                              <span className="absolute -top-1 -right-1 bg-[color:var(--color-accent)] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {cPhotos.length}
                              </span>
                            )}
                          </div>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-semibold truncate">{c.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-base">{emojis}</span>
                            <span className="text-[12px] text-[color:var(--color-muted)]">
                              {nPosts} serviço{nPosts > 1 ? "s" : ""} · {date}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[17px] font-bold num">{fmtBRL(mid)}</p>
                          <p className="text-[10px] text-[color:var(--color-muted)] num">
                            {fmtBRL(c.total[0])}–{fmtBRL(c.total[1])}
                          </p>
                        </div>
                      </div>

                      {pago > 0 && (
                        <div className="mt-3">
                          <div className="h-1.5 rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, pct * 100)}%`,
                                background: overshoot
                                  ? "#ff3b30"
                                  : "linear-gradient(90deg, #34c759 0%, #0071e3 100%)",
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px] text-[color:var(--color-muted)] num">
                              {fmtBRL(pago)} pago · {Math.round(pct * 100)}%
                            </span>
                            <span className={`text-[11px] num ${overshoot ? "text-[#ff3b30] font-medium" : "text-[color:var(--color-muted)]"}`}>
                              {overshoot
                                ? `+${fmtBRL(pago - mid)}`
                                : `${fmtBRL(mid - pago)} restante`}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[color:var(--color-line)]">
                        <Link
                          href={`/estimate?edit=${c.id}`}
                          className="flex-1 text-[13px] font-medium text-[color:var(--color-accent)] py-1.5 text-center"
                        >
                          Detalhes
                        </Link>
                        <Link
                          href={`/contas/${c.id}`}
                          className="flex-1 text-[13px] font-medium text-[color:var(--color-accent)] py-1.5 text-center border-l border-[color:var(--color-line)]"
                        >
                          Contas
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-[13px] text-[color:var(--color-muted)] py-1.5 px-3 border-l border-[color:var(--color-line)]"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="px-6 mt-4 text-center space-y-2">
          <Link
            href="/estimate"
            className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition"
          >
            Ou escolher manualmente cômodo/serviço →
          </Link>
          <p className="text-[11px] text-[color:var(--color-muted)]">
            Baseado em SINAPI RJ 2025 · 246 notas fiscais reais Rio Centro
          </p>
          <Link
            href="/aprendizados"
            className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-accent)] hover:opacity-80 transition"
          >
            🧠 O que a IA aprendeu com você →
          </Link>
        </div>
      </div>
    </div>
  );
}
