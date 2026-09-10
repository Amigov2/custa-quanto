"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CreditsBadge from "@/app/components/CreditsBadge";
import { deleteChantier, loadChantiers, seedDemoIfEmpty } from "@/lib/storage";
import { getService } from "@/lib/sinapi";
import { fmtBRL, midOf } from "@/lib/estimate";
import { loadAllPayments, type Payment } from "@/lib/payments";
import { loadPhotos, onPhotosChange, type PhotoRecord } from "@/lib/photo_history";
import type { Chantier } from "@/lib/types";

export default function HomePage() {
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDemoIfEmpty();
    setChantiers(loadChantiers());
    setPayments(loadAllPayments());
    setPhotos(loadPhotos());
    setReady(true);
    return onPhotosChange(() => setPhotos(loadPhotos()));
  }, []);

  const paymentsByChantier = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.chantierId] = (acc[p.chantierId] || 0) + p.valor;
    return acc;
  }, {});

  // Groupe les photos par chantier + garde la plus récente comme vignette de card.
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

  return (
    <div>
      <div className="nav-blur sticky top-0 z-40 max-w-md mx-auto">
        <div className="px-6 py-3 flex items-center justify-between">
          <p className="text-[15px] font-semibold">Custa Quanto</p>
          <CreditsBadge compact />
        </div>
      </div>

      <div className="max-w-md mx-auto pb-32">
        <div className="px-6 pt-6 pb-2 fade-in">
          <h1 className="large-title">Início</h1>
        </div>

        <div className="px-6 pt-6 pb-8 fade-in fade-in-1">
          <p className="text-[13px] text-[color:var(--color-muted)] mb-2">Total dos seus chantiers</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[color:var(--color-muted)] text-2xl font-medium">R$</span>
            <span className="display text-[56px]">{ready ? Math.round(totalMid).toLocaleString("pt-BR") : "—"}</span>
          </div>
          <p className="text-[13px] text-[color:var(--color-muted)] mt-1">
            {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""} salvo{chantiers.length > 1 ? "s" : ""}
          </p>
        </div>

        {chantiers.length > 0 ? (
          <div className="px-6 mb-8 fade-in fade-in-2">
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
        ) : ready ? (
          <div className="px-6 py-16 text-center fade-in fade-in-2">
            <div className="w-16 h-16 rounded-full bg-[color:var(--color-bg-2)] mx-auto mb-4 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth={1.8}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <p className="text-[color:var(--color-muted)] text-[15px] max-w-[240px] mx-auto">
              Comece pelo botão abaixo. Escolha um cômodo ou um serviço.
            </p>
          </div>
        ) : null}

        <div className="px-6 mt-4 text-center space-y-2">
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

      <div className="sticky-bottom">
        <div className="sticky-bottom-inner">
          <div className="flex gap-2">
            <Link
              href="/foto"
              className="flex-1 rounded-2xl py-4 text-[15px] font-semibold flex items-center justify-center gap-2 border border-[color:var(--color-line)] bg-[color:var(--color-bg-2)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Foto
            </Link>
            <Link
              href="/estimate"
              className="flex-[2] btn-primary rounded-2xl py-4 text-[15px] font-semibold flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Novo chantier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
