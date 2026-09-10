"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { decodeChantier, type SharePayload } from "@/lib/share_encoding";
import { estimateChantier, fmtBRL, midOf } from "@/lib/estimate";
import { getService } from "@/lib/sinapi";
import { PHASES, getPhaseForService, type PhaseId } from "@/lib/phases";

// Route publique — pas de nav ni de sticky bottom. Un vrai devis "à envoyer".
// Toutes les données arrivent via URL (base64url) : ni compte utilisateur, ni backend requis.
export default function SharePage() {
  const params = useParams<{ data: string }>();
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = decodeChantier(params.data);
    if (!p) setNotFound(true);
    else setPayload(p);
  }, [params.data]);

  const est = useMemo(
    () => (payload ? estimateChantier(payload.c.posts, payload.c.finish) : null),
    [payload],
  );

  const phaseBreakdown = useMemo(() => {
    if (!est) return [];
    const map: Record<PhaseId, { days: number; total: number; count: number }> = {
      preparo: { days: 0, total: 0, count: 0 },
      estrutura: { days: 0, total: 0, count: 0 },
      instalacoes: { days: 0, total: 0, count: 0 },
      acabamento: { days: 0, total: 0, count: 0 },
      final: { days: 0, total: 0, count: 0 },
    };
    est.estimates.forEach(e => {
      const ph = getPhaseForService(e.svc.id);
      if (ph) {
        map[ph.id].days += e.days;
        map[ph.id].total += midOf(e.total);
        map[ph.id].count += 1;
      }
    });
    return PHASES.filter(p => map[p.id].count > 0).map(p => ({ ...p, ...map[p.id] }));
  }, [est]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-[22px] font-bold mb-2">Link inválido</h1>
          <p className="text-[14px] text-[color:var(--color-muted)] mb-6">
            Este link parece corrompido ou incompleto.
          </p>
          <Link href="/" className="btn-primary rounded-2xl px-6 py-3 text-[15px] font-semibold inline-block">
            Ir para Custa Quanto
          </Link>
        </div>
      </div>
    );
  }

  if (!payload || !est) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[color:var(--color-muted)] text-[13px]">Carregando…</div>
      </div>
    );
  }

  const { c, photo } = payload;
  const totalMid = midOf(c.total);
  const generatedAt = payload.meta?.generatedAt ? new Date(payload.meta.generatedAt) : new Date();
  const docNumber = c.id.replace(/^ch_/, "").slice(-8).toUpperCase();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function shareWA() {
    const nPosts = c.posts.length;
    const text = [
      `📋 *${c.name}*`,
      `${nPosts} serviço${nPosts > 1 ? "s" : ""} · R$ ${Math.round(totalMid).toLocaleString("pt-BR")}`,
      ``,
      `Ver detalhes : ${window.location.href}`,
      ``,
      `_Feito com Custa Quanto — estimador RJ_`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Toolbar — cachée à l'impression */}
      <div className="no-print sticky top-0 z-40 nav-blur border-b border-[color:var(--color-line)]">
        <div className="px-6 py-3 flex items-center gap-2">
          <p className="text-[13px] font-semibold flex-1">Orçamento #{docNumber}</p>
          <button
            onClick={copyLink}
            className="text-[12px] font-medium text-[color:var(--color-accent)] px-3 py-1.5 rounded-full hover:bg-[color:var(--color-accent-soft)]"
          >
            {copied ? "✓ Copiado" : "🔗 Copiar"}
          </button>
          <button
            onClick={shareWA}
            className="text-[12px] font-medium text-white px-3 py-1.5 rounded-full bg-[#25D366]"
          >
            💬 WhatsApp
          </button>
          <button
            onClick={() => window.print()}
            className="text-[12px] font-medium text-[color:var(--color-ink)] px-3 py-1.5 rounded-full bg-[color:var(--color-bg-2)]"
          >
            🖨 PDF
          </button>
        </div>
      </div>

      <div className="px-8 pt-8 pb-6">
        {/* En-tête doc — visible en PDF */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-accent)] font-bold">
              Custa Quanto
            </p>
            <p className="text-[10px] text-[color:var(--color-muted)]">Estimador reforma · SINAPI RJ 2025</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[color:var(--color-muted)] uppercase tracking-wide">Orçamento</p>
            <p className="text-[15px] font-bold num">#{docNumber}</p>
            <p className="text-[10px] text-[color:var(--color-muted)] num mt-0.5">
              {generatedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Titre chantier + photo */}
        <div className="mb-6">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">{c.name}</h1>
          {photo && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-[color:var(--color-line)]">
              <img src={photo} alt="" className="w-full h-auto max-h-[380px] object-cover" />
            </div>
          )}
        </div>

        {/* Chiffres clés — grosse card */}
        <div className="card-outlined p-6 mb-6">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-2">
            Total estimado
          </p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[color:var(--color-muted)] text-2xl font-medium">R$</span>
            <span className="display text-[48px] leading-none">{Math.round(totalMid).toLocaleString("pt-BR")}</span>
          </div>
          <p className="text-[12px] text-[color:var(--color-muted)] num">
            Faixa : {fmtBRL(c.total[0])} — {fmtBRL(c.total[1])}
          </p>
          <div className="flex gap-6 mt-4 pt-4 border-t border-[color:var(--color-line)]">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Duração</p>
              <p className="text-[18px] font-bold num">{Math.round(est.days)} dias</p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Serviços</p>
              <p className="text-[18px] font-bold num">{est.estimates.length}</p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Acabamento</p>
              <p className="text-[18px] font-bold capitalize">{c.finish}</p>
            </div>
          </div>
        </div>

        {/* Cronograma par fase */}
        {phaseBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-3">
              Cronograma
            </p>
            <div className="card-outlined p-5">
              <div className="flex h-2 rounded-full overflow-hidden mb-4">
                {phaseBreakdown.map(p => (
                  <div
                    key={p.id}
                    style={{
                      width: `${(p.days / est.days) * 100}%`,
                      background: p.color,
                    }}
                    title={`${p.label} · ${Math.round(p.days)}d`}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {phaseBreakdown.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className="text-[13px] flex-1">
                      {p.emoji} {p.label}
                      <span className="text-[color:var(--color-muted)] text-[11px] ml-1.5">
                        · {p.count} serviço{p.count > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="text-[13px] font-medium num">{Math.round(p.days)}d</span>
                    <span className="text-[13px] font-bold num w-24 text-right">{fmtBRL(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Détail par poste */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-3">
            Detalhes por serviço
          </p>
          <div className="card-outlined divide-y divide-[color:var(--color-line)]">
            {est.estimates.map(e => {
              const svc = getService(e.svc.id);
              if (!svc) return null;
              return (
                <div key={e.svc.id} className="p-4 flex items-start gap-3">
                  <span className="text-2xl leading-none pt-0.5">{svc.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold leading-tight">{svc.name}</p>
                    <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
                      {e.post.surface} {svc.unit} · {e.days} dia{e.days > 1 ? "s" : ""} · {svc.cat}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold num">{fmtBRL(midOf(e.total))}</p>
                    <p className="text-[10px] text-[color:var(--color-muted)] num">
                      {fmtBRL(e.total[0])}–{fmtBRL(e.total[1])}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Base de calcul */}
        <div className="card-outlined p-4 mb-6 bg-[color:var(--color-bg-2)]/40">
          <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)] font-semibold mb-1">
            Base do cálculo
          </p>
          <ul className="text-[11px] text-[color:var(--color-ink-2)] space-y-1 leading-relaxed">
            <li>• Tabela SINAPI RJ 2025 + 246 notas fiscais reais Rio Centro</li>
            <li>• Mão-de-obra em diária padrão (1 oficial + 1 ajudante)</li>
            <li>• Contingência de 10% aplicada</li>
            <li>• Acabamento {c.finish} — valores podem variar ±15%</li>
          </ul>
        </div>

        {/* Footer + CTA */}
        <div className="text-center pt-6 border-t border-[color:var(--color-line)]">
          <p className="text-[11px] text-[color:var(--color-muted)] mb-3 leading-relaxed">
            Este documento é uma estimativa baseada em fotos e referências públicas.
            <br />
            Peça sempre um orçamento presencial ao seu empreiteiro antes de contratar.
          </p>
          <Link
            href="/"
            className="no-print inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--color-accent)]"
          >
            Crie o seu com Custa Quanto →
          </Link>
        </div>
      </div>
    </div>
  );
}
