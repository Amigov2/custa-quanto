"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadLearnings,
  deleteLearning,
  clearAllLearnings,
  onLearningsChange,
  type LearningRecord,
} from "@/lib/learnings";
import {
  loadFeedbacks,
  deleteFeedback,
  onFeedbacksChange,
  type PriceFeedback,
} from "@/lib/price_feedback";
import { computePreferences } from "@/lib/preferences";
import { loadChantiers } from "@/lib/storage";
import { fmtBRL } from "@/lib/estimate";

const AMBIENTE_EMOJI: Record<string, string> = {
  cozinha: "🍳", banheiro: "🚽", sala: "🛋️", quarto: "🛏️",
  escritorio: "💼", fachada: "🏠", area_externa: "🌳", outro: "📐",
};

const LEARNING_TYPE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  ambiente: { label: "Correção de ambiente", icon: "🏷️", color: "#0071e3" },
  m2_delta: { label: "Correção de m²", icon: "📏", color: "#ff9500" },
  scope: { label: "Escopo digitado", icon: "✏️", color: "#34c759" },
};

export default function AprendizadosPage() {
  const [learnings, setLearnings] = useState<LearningRecord[]>([]);
  const [feedbacks, setFeedbacks] = useState<PriceFeedback[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLearnings(loadLearnings());
    setFeedbacks(loadFeedbacks());
    setReady(true);
    const off1 = onLearningsChange(() => setLearnings(loadLearnings()));
    const off2 = onFeedbacksChange(() => setFeedbacks(loadFeedbacks()));
    return () => { off1(); off2(); };
  }, []);

  const prefs = ready ? computePreferences() : null;
  const chantiers = ready ? loadChantiers() : [];
  const chantierNameById = Object.fromEntries(chantiers.map(c => [c.id, c.name]));

  const sortedLearnings = [...learnings].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const sortedFeedbacks = [...feedbacks].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  const totalSignal = learnings.length + feedbacks.length + (prefs?.totalSignal ?? 0);

  function handleClearAll() {
    if (!confirm("Apagar TODAS as correções aprendidas ? Os feedbacks de preços não serão afetados.")) return;
    clearAllLearnings();
  }

  function handleDeleteLearning(id: string) {
    if (!confirm("Apagar esta correção ?")) return;
    deleteLearning(id);
  }

  function handleDeleteFeedback(id: string) {
    if (!confirm("Apagar este feedback de preço ? Os preços futuros voltarão a ser calibrados apenas com base Rio Centro.")) return;
    deleteFeedback(id);
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
          <p className="text-[15px] font-semibold">🧠 Aprendizados</p>
          <div className="w-14" />
        </div>
      </div>

      <div className="max-w-md mx-auto pb-16">
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">O que a IA aprendeu</h1>
          <p className="text-[13px] text-[color:var(--color-ink-2)] opacity-95 mt-0.5">Ce que l&apos;IA a appris de toi</p>
          {ready && totalSignal >= 3 && (
            <p className="text-[11px] text-[color:var(--color-accent)] mt-2 font-medium">
              {totalSignal} sinais coletados · influenciam as futuras análises
            </p>
          )}
        </div>

        {ready && totalSignal === 0 && (
          <div className="px-6 pt-8 fade-in fade-in-1">
            <div className="card-outlined p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[color:var(--color-bg-2)] mx-auto mb-3 flex items-center justify-center text-2xl">
                📚
              </div>
              <p className="text-[14px] font-medium mb-1.5">Nada aprendido ainda</p>
              <p className="text-[12px] text-[color:var(--color-muted)] leading-relaxed max-w-[280px] mx-auto">
                Comece a corrigir análises, digitar escopos ou finalizar chantiers.
                A IA vai aprender com suas ações.
              </p>
            </div>
          </div>
        )}

        {/* Section Correções (learnings) */}
        {ready && sortedLearnings.length > 0 && (
          <div className="px-6 pt-6 fade-in fade-in-1">
            <div className="flex items-center justify-between mb-3 px-2">
              <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">
                Correções
              </p>
              <button
                onClick={handleClearAll}
                className="text-[11px] text-[color:var(--color-muted)] hover:text-[#ff3b30] px-2 py-1"
              >
                Limpar tudo
              </button>
            </div>
            <div className="space-y-2">
              {sortedLearnings.map(l => {
                const meta = LEARNING_TYPE_LABEL[l.type];
                const date = new Date(l.dateISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                let desc = "";
                if (l.type === "ambiente") {
                  const from = AMBIENTE_EMOJI[l.context.ambienteDetected || ""] || "";
                  const to = AMBIENTE_EMOJI[l.correction.ambienteCorrected || ""] || "";
                  desc = `${from} ${l.context.ambienteDetected} → ${to} ${l.correction.ambienteCorrected}`;
                } else if (l.type === "m2_delta") {
                  desc = `${l.context.m2Detected} m² → ${l.correction.m2Corrected} m²`;
                } else if (l.type === "scope") {
                  desc = `"${l.correction.scopeText}"`;
                }
                return (
                  <div key={l.id} className="card-outlined p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
                        style={{ background: meta.color + "18" }}
                      >
                        {meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: meta.color }}>
                          {meta.label}
                        </p>
                        <p className="text-[13px] mt-0.5 break-words">{desc}</p>
                        <p className="text-[10px] text-[color:var(--color-muted)] num mt-0.5">{date}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteLearning(l.id)}
                        className="text-[11px] text-[color:var(--color-muted)] hover:text-[#ff3b30] px-2 py-1"
                        aria-label="Excluir"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section Chantiers finalizados (feedbacks prix) */}
        {ready && sortedFeedbacks.length > 0 && (
          <div className="px-6 pt-6 fade-in fade-in-2">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
              Chantiers finalizados
            </p>
            <div className="space-y-2">
              {sortedFeedbacks.map(f => {
                const date = new Date(f.dateISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                const delta = f.totalPaid - f.totalEstimated;
                const deltaPct = f.totalEstimated > 0 ? (delta / f.totalEstimated) * 100 : 0;
                const chantierName = chantierNameById[f.chantierId] || "Chantier";
                const isOver = delta > 0;
                const isNear = Math.abs(deltaPct) < 5;
                return (
                  <div key={f.id} className="card-outlined p-3">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-[#34c759]/10 flex items-center justify-center shrink-0 text-lg">
                        💰
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{chantierName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-medium num">{fmtBRL(f.totalPaid)}</span>
                          <span className={`text-[11px] num ${isNear ? "text-[color:var(--color-muted)]" : isOver ? "text-[#ff9500]" : "text-[#34c759]"}`}>
                            vs {fmtBRL(f.totalEstimated)} · {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(0)}%
                          </span>
                        </div>
                        {f.notes && (
                          <p className="text-[11px] text-[color:var(--color-muted)] italic mt-1 break-words">{f.notes}</p>
                        )}
                        <p className="text-[10px] text-[color:var(--color-muted)] num mt-0.5">{date}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteFeedback(f.id)}
                        className="text-[11px] text-[color:var(--color-muted)] hover:text-[#ff3b30] px-2 py-1"
                        aria-label="Excluir"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section Preferências détectées passivement */}
        {ready && prefs && prefs.totalSignal >= 3 && (
          <div className="px-6 pt-6 fade-in fade-in-3">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
              Preferências detectadas
              <span className="ml-2 text-[10px] normal-case tracking-normal font-normal text-[color:var(--color-muted)]">(automatique)</span>
            </p>
            <div className="card-outlined p-4 space-y-3">
              {prefs.favoriteBrands.length > 0 && (
                <div>
                  <p className="text-[11px] text-[color:var(--color-muted)] mb-1">🏷️ Marcas favoritas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.favoriteBrands.map(b => (
                      <span key={b} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {prefs.styleHints.length > 0 && (
                <div>
                  <p className="text-[11px] text-[color:var(--color-muted)] mb-1">🎨 Estilos mencionados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.styleHints.slice(0, 6).map(s => (
                      <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[color:var(--color-ink)]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {prefs.budgetHint && (
                <div>
                  <p className="text-[11px] text-[color:var(--color-muted)] mb-1">💵 Perfil de orçamento</p>
                  <p className="text-[13px] font-medium capitalize">{prefs.budgetHint}</p>
                </div>
              )}
              {prefs.recurrentAmbientes.length > 0 && (
                <div>
                  <p className="text-[11px] text-[color:var(--color-muted)] mb-1">🏠 Ambientes trabalhados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.recurrentAmbientes.map(a => (
                      <span key={a.ambiente} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[color:var(--color-ink)]">
                        {AMBIENTE_EMOJI[a.ambiente] || ""} {a.ambiente} · {a.count}×
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {prefs.avgPaidBRL && (
                <div>
                  <p className="text-[11px] text-[color:var(--color-muted)] mb-1">💰 Faixa habitual</p>
                  <p className="text-[13px] font-medium num">~{fmtBRL(prefs.avgPaidBRL)} por chantier</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[color:var(--color-muted)] mt-2 px-2 leading-relaxed">
              Estas preferências são deduzidas dos seus chats, escopos, notas e chantiers finalizados.
              Elas não podem ser editadas diretamente — mas se você excluir correções ou feedbacks acima, elas se atualizam.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
