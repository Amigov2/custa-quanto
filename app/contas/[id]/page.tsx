"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadChantiers, seedDemoIfEmpty } from "@/lib/storage";
import { estimateChantier, fmtBRL, midOf } from "@/lib/estimate";
import { getService } from "@/lib/sinapi";
import { PHASES, getPhaseForService, type PhaseId } from "@/lib/phases";
import {
  addPayment,
  computeChantierProgress,
  deletePayment,
  loadPayments,
  PAYMENT_KIND_LABELS,
  type Payment,
  type PaymentKind,
} from "@/lib/payments";
import { getPhotosByChantier, onPhotosChange, type PhotoRecord } from "@/lib/photo_history";
import { getFeedbackForChantier, saveFeedback, onFeedbacksChange, type PriceFeedback } from "@/lib/price_feedback";
import type { Chantier } from "@/lib/types";

export default function ContasPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [feedback, setFeedback] = useState<PriceFeedback | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  useEffect(() => {
    seedDemoIfEmpty();
    const c = loadChantiers().find(c => c.id === id) ?? null;
    setChantier(c);
    if (c) setPayments(loadPayments(id));
    setPhotos(getPhotosByChantier(id));
    setFeedback(getFeedbackForChantier(id));
    setReady(true);
    const off1 = onPhotosChange(() => setPhotos(getPhotosByChantier(id)));
    const off2 = onFeedbacksChange(() => setFeedback(getFeedbackForChantier(id)));
    return () => { off1(); off2(); };
  }, [id]);

  const chantierEst = useMemo(
    () => (chantier ? estimateChantier(chantier.posts, chantier.finish) : null),
    [chantier],
  );

  const progress = useMemo(
    () => (chantier ? computeChantierProgress(chantier, chantierEst, payments) : null),
    [chantier, chantierEst, payments],
  );

  function handleAdd(input: Omit<Payment, "id" | "date" | "chantierId">) {
    if (!chantier) return;
    addPayment({ ...input, chantierId: chantier.id });
    setPayments(loadPayments(chantier.id));
    setShowAddModal(false);
  }

  function handleDelete(pid: string) {
    if (!confirm("Excluir este pagamento ?")) return;
    deletePayment(pid);
    if (chantier) setPayments(loadPayments(chantier.id));
  }

  if (!ready) return null;

  if (!chantier) {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="text-[15px] text-[color:var(--color-muted)]">Chantier não encontrado.</p>
        <Link href="/" className="inline-block mt-4 text-[color:var(--color-accent)] text-[15px]">
          Voltar ao início
        </Link>
      </div>
    );
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
          </Link>
          <p className="text-[15px] font-semibold truncate max-w-[45%]">{chantier.name}</p>
          <div className="w-14" />
        </div>
      </div>

      <div className="max-w-md mx-auto pb-32">
        {/* Résumé grand */}
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">Contas</h1>
        </div>

        <div className="px-6 pt-4 pb-6 fade-in fade-in-1">
          <p className="text-[13px] text-[color:var(--color-muted)] mb-2">
            {progress!.nPayments} pagamento{progress!.nPayments > 1 ? "s" : ""} registrado{progress!.nPayments > 1 ? "s" : ""}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[color:var(--color-muted)] text-2xl font-medium">R$</span>
            <span className="display text-[56px] num">
              {Math.round(progress!.totalPago).toLocaleString("pt-BR")}
            </span>
          </div>
          <p className="text-[13px] text-[color:var(--color-muted)] mt-1 num">
            de {fmtBRL(progress!.totalEstimado)} estimado
          </p>

          {/* Progress bar globale */}
          <div className="mt-5">
            <div className="h-2 rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, progress!.pct * 100)}%`,
                  background: progress!.overshoot
                    ? "#ff3b30"
                    : "linear-gradient(90deg, #34c759 0%, #0071e3 100%)",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[12px] text-[color:var(--color-muted)] num">
                {Math.round(progress!.pct * 100)}% do orçamento
              </span>
              <span className={`text-[12px] font-medium num ${progress!.overshoot ? "text-[#ff3b30]" : "text-[color:var(--color-muted)]"}`}>
                {progress!.overshoot
                  ? `⚠️ +${fmtBRL(progress!.totalPago - progress!.totalEstimado)} acima`
                  : `${fmtBRL(progress!.restante)} restante`}
              </span>
            </div>

            {/* CTA finalizar : apparaît dès 60% de progression, ou badge si déjà finalisé */}
            {feedback ? (
              <div className="mt-4 rounded-xl bg-[#34c759]/10 px-3 py-2 flex items-center gap-2">
                <span>🎯</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#34c759]">
                    Chantier finalizado — {fmtBRL(feedback.totalPaid)} pago
                  </p>
                  <p className="text-[10px] text-[color:var(--color-muted)]">
                    Sua correção calibra as estimativas futuras
                  </p>
                </div>
              </div>
            ) : progress!.pct >= 0.6 ? (
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="w-full mt-4 rounded-xl bg-[color:var(--color-accent)] text-white py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2"
              >
                🎯 Finalizar chantier — quanto pagou vraiment ?
              </button>
            ) : null}
          </div>
        </div>

        {/* Breakdown par phase */}
        {progress!.byPhase.length > 0 && (
          <div className="px-6 mb-8 fade-in fade-in-2">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
              Por fase
            </p>
            <div className="card-outlined p-4 space-y-4">
              {progress!.byPhase.map(ph => (
                <div key={ph.phaseId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ph.emoji}</span>
                      <span className="text-[14px] font-medium">{ph.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[13px] font-semibold num">{fmtBRL(ph.pago)}</span>
                      <span className="text-[11px] text-[color:var(--color-muted)] num ml-1">
                        / {fmtBRL(ph.estimado)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ph.pct * 100)}%`,
                        background: ph.overshoot ? "#ff3b30" : ph.color,
                      }}
                    />
                  </div>
                  {ph.overshoot && (
                    <p className="text-[11px] text-[#ff3b30] mt-1 num">
                      +{fmtBRL(ph.pago - ph.estimado)} acima do previsto
                    </p>
                  )}
                </div>
              ))}
              {progress!.unassigned > 0 && (
                <div className="pt-3 border-t border-[color:var(--color-line)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[color:var(--color-muted)]">Sem fase</span>
                    <span className="text-[12px] num">{fmtBRL(progress!.unassigned)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline photos du chantier */}
        <div className="px-6 mb-6 fade-in fade-in-3">
          <div className="flex items-center justify-between mb-3 px-2">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">
              Fotos
            </p>
            {photos.length > 0 && (
              <span className="text-[11px] text-[color:var(--color-muted)] num">{photos.length}</span>
            )}
          </div>
          {photos.length === 0 ? (
            <Link
              href={`/foto?chantierId=${id}`}
              className="card-outlined p-6 text-center block hover:border-[color:var(--color-accent)] transition"
            >
              <div className="w-12 h-12 rounded-full bg-[color:var(--color-accent-soft)] mx-auto mb-2 flex items-center justify-center text-xl">
                📸
              </div>
              <p className="text-[13px] font-medium mb-0.5">Adicionar primeira foto</p>
              <p className="text-[11px] text-[color:var(--color-muted)]">
                Documenta o avanço do chantier · La progression du chantier
              </p>
            </Link>
          ) : (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 pb-1">
              {photos.map(p => {
                const date = new Date(p.dateISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                const nExchanges = Math.ceil((p.chatHistory?.length ?? 0) / 2);
                return (
                  <div key={p.id} className="shrink-0 w-28">
                    <div className="relative rounded-2xl overflow-hidden border border-[color:var(--color-line)] aspect-square bg-[color:var(--color-bg-2)]">
                      <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                      {nExchanges > 0 && (
                        <span className="absolute top-1.5 right-1.5 bg-[color:var(--color-accent)] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow">
                          💬 {nExchanges}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-medium mt-1.5 truncate">{p.label || "Foto"}</p>
                    <p className="text-[10px] text-[color:var(--color-muted)] num">{date}</p>
                  </div>
                );
              })}
              <Link
                href={`/foto?chantierId=${id}`}
                className="shrink-0 w-28 aspect-square rounded-2xl border-2 border-dashed border-[color:var(--color-line)] flex items-center justify-center text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] transition"
              >
                <span className="text-2xl">+</span>
              </Link>
            </div>
          )}
        </div>

        {/* Liste chronologique */}
        <div className="px-6 mb-8 fade-in fade-in-3">
          <div className="flex items-center justify-between mb-3 px-2">
            <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">
              Registros
            </p>
            {payments.length > 0 && (
              <span className="text-[11px] text-[color:var(--color-muted)] num">{payments.length}</span>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="card-outlined p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[color:var(--color-bg-2)] mx-auto mb-3 flex items-center justify-center text-2xl">
                💰
              </div>
              <p className="text-[14px] text-[color:var(--color-muted)] max-w-[220px] mx-auto">
                Nenhum pagamento registrado ainda. Comece pelo botão abaixo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map(p => {
                const kind = PAYMENT_KIND_LABELS[p.kind];
                const svc = p.serviceId ? getService(p.serviceId) : null;
                const phase = p.phaseId ? PHASES.find(ph => ph.id === p.phaseId) : null;
                const date = new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                return (
                  <div key={p.id} className="card-outlined p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: kind.color + "18" }}
                      >
                        <span className="text-lg leading-none">{kind.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[14px] font-semibold truncate">{kind.label}</p>
                          <p className="text-[14px] font-bold num shrink-0">{fmtBRL(p.valor)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {phase && (
                            <span
                              className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
                              style={{ background: phase.color + "20", color: phase.color }}
                            >
                              {phase.emoji} {phase.short}
                            </span>
                          )}
                          {svc && (
                            <span className="text-[10px] text-[color:var(--color-muted)] truncate">
                              {svc.emoji} {svc.name}
                            </span>
                          )}
                          <span className="text-[10px] text-[color:var(--color-muted)] ml-auto num">{date}</span>
                        </div>
                        {p.note && (
                          <p className="text-[12px] text-[color:var(--color-muted)] mt-1 line-clamp-2">{p.note}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="w-full text-[11px] text-[color:var(--color-muted)] hover:text-[#ff3b30] transition mt-2 pt-2 border-t border-[color:var(--color-line)]"
                    >
                      Excluir
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 mt-2 text-center">
          <Link
            href={`/estimate?edit=${chantier.id}`}
            className="text-[12px] text-[color:var(--color-accent)]"
          >
            Ver detalhes do chantier →
          </Link>
        </div>
      </div>

      <div className="sticky-bottom">
        <div className="sticky-bottom-inner">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full btn-primary rounded-2xl py-4 text-[17px] flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Registrar pagamento
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddPaymentModal
          chantier={chantier}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {showFinalizeModal && chantier && progress && (
        <FinalizeChantierModal
          chantierId={chantier.id}
          totalEstimated={progress.totalEstimado}
          totalPaidSoFar={progress.totalPago}
          serviceIds={chantier.posts.map(p => p.serviceId)}
          onClose={() => setShowFinalizeModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal Finalizar chantier : feedback prix payé pour calibrer l'IA
// ============================================================
function FinalizeChantierModal({
  chantierId, totalEstimated, totalPaidSoFar, serviceIds, onClose,
}: {
  chantierId: string;
  totalEstimated: number;
  totalPaidSoFar: number;
  serviceIds: string[];
  onClose: () => void;
}) {
  const [totalPaid, setTotalPaid] = useState<string>(String(Math.round(totalPaidSoFar)));
  const [notes, setNotes] = useState<string>("");

  function confirm() {
    const paid = parseFloat(totalPaid.replace(/[^\d.-]/g, ""));
    if (!(paid > 0)) return;
    saveFeedback({
      chantierId,
      totalEstimated: Math.round(totalEstimated),
      totalPaid: Math.round(paid),
      serviceIds,
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  const paidNum = parseFloat(totalPaid.replace(/[^\d.-]/g, "")) || 0;
  const delta = paidNum - totalEstimated;
  const deltaPct = totalEstimated > 0 ? (delta / totalEstimated) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center px-6 pb-6 sm:pb-0">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[color:var(--color-accent-soft)] flex items-center justify-center mb-3 text-xl">
            🎯
          </div>
          <p className="text-[17px] font-semibold">Finalizar chantier</p>
          <p className="text-[12px] text-[color:var(--color-muted)] mt-1 leading-snug px-4">
            Sua correção calibra os preços Rio para os próximos chantiers.<br/>
            <span className="italic">La correction calibre les prix futurs</span>
          </p>
        </div>

        <div className="px-5 pb-3">
          <label className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-1.5 block px-1">
            Quanto pagou no total ?
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)] text-[15px] font-medium">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={totalPaid}
              onChange={e => setTotalPaid(e.target.value)}
              className="w-full bg-[color:var(--color-bg-2)] rounded-xl pl-12 pr-4 py-3 text-[17px] font-semibold num outline-none focus:bg-white focus:border focus:border-[color:var(--color-line-2)] transition"
              autoFocus
            />
          </div>
          {paidNum > 0 && (
            <p className={`text-[11px] mt-1.5 px-1 num ${Math.abs(deltaPct) < 5 ? "text-[color:var(--color-muted)]" : deltaPct > 0 ? "text-[#ff9500]" : "text-[#34c759]"}`}>
              vs estimado {fmtBRL(totalEstimated)} · {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="px-5 pb-5">
          <label className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-1.5 block px-1">
            Notas <span className="normal-case tracking-normal text-[color:var(--color-muted)]">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Ex: material Coral barato promoção · mão-de-obra Valternir + equipe"
            lang={typeof document !== "undefined" ? document.documentElement.lang || "pt-BR" : "pt-BR"}
            inputMode="text"
            className="w-full bg-[color:var(--color-bg-2)] rounded-xl px-4 py-2.5 text-[13px] outline-none resize-none placeholder:text-[color:var(--color-muted)] focus:bg-white focus:border focus:border-[color:var(--color-line-2)] transition"
          />
        </div>

        <div className="border-t border-[color:var(--color-line)] grid grid-cols-2">
          <button onClick={onClose} className="py-3.5 text-[15px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition border-r border-[color:var(--color-line)]">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!(paidNum > 0)}
            className="py-3.5 text-[15px] font-semibold text-[color:var(--color-accent)] disabled:opacity-40 hover:bg-[color:var(--color-bg-2)] transition"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPaymentModal({
  chantier,
  onClose,
  onAdd,
}: {
  chantier: Chantier;
  onClose: () => void;
  onAdd: (input: Omit<Payment, "id" | "date" | "chantierId">) => void;
}) {
  const [valorStr, setValorStr] = useState("");
  const [kind, setKind] = useState<PaymentKind>("mo");
  const [phaseId, setPhaseId] = useState<PhaseId | "">("");
  const [note, setNote] = useState("");

  // Phases actives = phases présentes dans le chantier (basé sur les serviceIds)
  const activePhases = useMemo(() => {
    const set = new Set<PhaseId>();
    chantier.posts.forEach(p => set.add(getPhaseForService(p.serviceId).id));
    return PHASES.filter(ph => set.has(ph.id));
  }, [chantier]);

  const valor = parseFloat(valorStr.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const canSave = valor > 0;

  function handleSave() {
    if (!canSave) return;
    onAdd({
      valor,
      kind,
      phaseId: phaseId || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[color:var(--color-bg)] rounded-t-3xl sm:rounded-3xl p-6 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="text-[15px] text-[color:var(--color-muted)]">
            Cancelar
          </button>
          <p className="text-[15px] font-semibold">Novo pagamento</p>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`text-[15px] font-semibold ${canSave ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)] opacity-40"}`}
          >
            Salvar
          </button>
        </div>

        {/* Valor grand */}
        <div className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2">
            Valor
          </p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-[color:var(--color-muted)] text-2xl font-medium">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={valorStr}
              onChange={e => setValorStr(e.target.value)}
              placeholder="0"
              autoFocus
              className="display text-[48px] num bg-transparent outline-none text-center w-[60%] placeholder:text-[color:var(--color-line)]"
            />
          </div>
        </div>

        {/* Tipo */}
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
            Tipo
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PAYMENT_KIND_LABELS) as PaymentKind[]).map(k => {
              const info = PAYMENT_KIND_LABELS[k];
              const active = kind === k;
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-2xl py-3 px-2 border transition ${
                    active
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/8"
                      : "border-[color:var(--color-line)]"
                  }`}
                >
                  <div className="text-xl mb-1">{info.emoji}</div>
                  <div className={`text-[12px] font-medium ${active ? "text-[color:var(--color-accent)]" : ""}`}>
                    {info.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fase */}
        {activePhases.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
              Fase <span className="text-[color:var(--color-muted)] normal-case">(opcional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPhaseId("")}
                className={`text-[12px] rounded-full px-3 py-1.5 border transition ${
                  phaseId === ""
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/8 text-[color:var(--color-accent)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-muted)]"
                }`}
              >
                —
              </button>
              {activePhases.map(ph => {
                const active = phaseId === ph.id;
                return (
                  <button
                    key={ph.id}
                    onClick={() => setPhaseId(ph.id)}
                    className={`text-[12px] rounded-full px-3 py-1.5 border transition flex items-center gap-1 ${
                      active
                        ? "text-white"
                        : "border-[color:var(--color-line)]"
                    }`}
                    style={
                      active
                        ? { background: ph.color, borderColor: ph.color }
                        : {}
                    }
                  >
                    <span>{ph.emoji}</span>
                    <span>{ph.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nota */}
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
            Nota <span className="text-[color:var(--color-muted)] normal-case">(opcional)</span>
          </p>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex: Valternir — sinal alvenaria"
            className="w-full rounded-xl border border-[color:var(--color-line)] bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </div>
      </div>
    </div>
  );
}
