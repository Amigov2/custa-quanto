"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MACROS, MACRO_GROUPS, getMacro, getMacroFr, getMacrosByGroup, macroToServicePosts, type Macro } from "@/lib/macros";
import { estimateChantier, estimatePost, explainDays, fmt, fmtBRL, fmtPct, midOf, teamMultiplier, teamSpeedFactor, DEFAULT_CONFIG, type EstimateConfig } from "@/lib/estimate";
import { getService, SERVICES } from "@/lib/sinapi";
import { getMaterials, type Finish } from "@/lib/materials";
import { loadChantiers, saveChantier } from "@/lib/storage";
import { attachToChantier, getPhotosByChantier } from "@/lib/photo_history";
import { buildShareUrl } from "@/lib/share_encoding";
import type { ServicePost } from "@/lib/types";
import { PHASES, getPhaseForService, type PhaseId } from "@/lib/phases";
import { detectAlerts, compareWithOrcamento, verdictLabel, type ComparisonResult } from "@/lib/alerts";

type Step = "pick" | "quantity" | "detail";

const FINISH_LABELS: { id: Finish; label: string }[] = [
  { id: "economico", label: "Básico" },
  { id: "padrao",    label: "Padrão" },
  { id: "premium",   label: "Premium" },
];

export default function EstimatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const prefillMacroId = searchParams.get("macroId");
  const prefillQty = searchParams.get("qty");
  const fromPhotoId = searchParams.get("fromPhoto");
  const [step, setStep] = useState<Step>("pick");
  const [macroId, setMacroId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [finish, setFinish] = useState<Finish>("padrao");
  const [config, setConfig] = useState<EstimateConfig>(DEFAULT_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [chantierName, setChantierName] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  // Load chantier from storage if ?edit=id
  useEffect(() => {
    if (!editId) return;
    const chantier = loadChantiers().find(c => c.id === editId);
    if (!chantier) return;
    setPosts(chantier.posts.map(p => ({ ...p, enabled: true })));
    setFinish(chantier.finish);
    setChantierName(chantier.name);
    setStep("detail");
  }, [editId]);

  // Prefill from photo analysis : ?macroId=X&qty=Y
  useEffect(() => {
    if (editId || !prefillMacroId) return;
    const m = getMacro(prefillMacroId);
    if (!m) return;
    const q = prefillQty ? Math.max(m.minQty, Math.min(m.maxQty, parseInt(prefillQty))) : m.defaultQty;
    setMacroId(m.id);
    setQty(q);
    setPosts(macroToServicePosts(m, q));
    setStep("detail");
  }, [editId, prefillMacroId, prefillQty]);

  function togglePostExpand(idx: number) {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const macro = macroId ? getMacro(macroId) : null;

  function pickMacro(id: string) {
    const m = getMacro(id);
    if (!m) return;
    setMacroId(id);
    setQty(m.defaultQty);
    setPosts(macroToServicePosts(m, m.defaultQty));
    setStep("quantity");
  }
  function confirmQty() {
    if (!macro) return;
    setPosts(macroToServicePosts(macro, qty));
    setStep("detail");
  }

  const chantierEst = useMemo(() => estimateChantier(posts, finish, config), [posts, finish, config]);
  const totalMid = midOf(chantierEst.total);

  function togglePost(idx: number) {
    setPosts(prev => prev.map((p, i) => (i === idx ? { ...p, enabled: p.enabled === false } : p)));
  }
  function bumpSurface(idx: number, delta: number) {
    setPosts(prev => prev.map((p, i) => (i === idx ? { ...p, surface: Math.max(0.5, Math.round((p.surface + delta) * 10) / 10) } : p)));
  }
  function setPostModifier(idx: number, modId: string, optIdx: number) {
    setPosts(prev => prev.map((p, i) => (i === idx ? { ...p, modifiers: { ...p.modifiers, [modId]: optIdx } } : p)));
  }
  function removePost(idx: number) {
    setPosts(prev => prev.filter((_, i) => i !== idx));
  }
  function addService(id: string) {
    const svc = getService(id);
    if (!svc) return;
    setPosts(prev => [...prev, { serviceId: id, surface: defaultSurfaceFor(svc.unit), modifiers: {}, enabled: true }]);
    setShowAddService(false);
    setAddSearch("");
  }

  function openSave() {
    const suggested = chantierName || (macro ? macro.name : "Chantier " + new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    setChantierName(suggested);
    setShowSaveModal(true);
  }

  function confirmSave() {
    if (!chantierName.trim()) return;
    const created = saveChantier({
      name: chantierName.trim(),
      posts: posts.filter(p => p.enabled !== false).map(p => ({ serviceId: p.serviceId, surface: p.surface, modifiers: p.modifiers })),
      finish,
      total: chantierEst.total,
    });
    // Si le chantier a été initié depuis une analyse photo, rattache la photo
    // (elle passe de brouillon à photo du chantier + apparaîtra dans /contas timeline).
    if (fromPhotoId) attachToChantier(fromPhotoId, created.id);
    setShowSaveModal(false);
    router.push("/");
  }

  return (
    <div>
      <div className="nav-blur sticky top-0 z-40 max-w-md mx-auto no-print">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-[color:var(--color-accent)] text-[15px] flex items-center gap-0.5 -ml-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Início
          </Link>
          <p className="text-[15px] font-semibold">{editId ? (chantierName || "Chantier") : "Novo chantier"}</p>
          {step === "detail" ? (
            <button
              onClick={() => setShowShareModal(true)}
              className="text-[color:var(--color-accent)] hover:opacity-80 transition p-1 flex items-center gap-1"
              aria-label="Partilhar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          ) : (
            <div className="w-14" />
          )}
        </div>
        {step === "detail" && (
          <div className="px-6 pb-2 flex items-center justify-between border-t border-[color:var(--color-line)] pt-2">
            <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">
              Total live
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold num">{fmtBRL(totalMid)}</span>
              <span className="text-[10px] text-[color:var(--color-muted)] num">
                {fmtBRL(chantierEst.total[0])}–{fmtBRL(chantierEst.total[1])}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto pb-40">
        {step === "pick" && <PickMacro onPick={pickMacro} />}
        {step === "quantity" && macro && (
          <PickQuantity macro={macro} qty={qty} setQty={setQty} onNext={confirmQty} onBack={() => setStep("pick")} />
        )}
        {step === "detail" && (
          <Detail
            macro={macro}
            chantierName={chantierName}
            posts={posts}
            finish={finish}
            setFinish={setFinish}
            config={config}
            setConfig={setConfig}
            configOpen={configOpen}
            setConfigOpen={setConfigOpen}
            togglePost={togglePost}
            bumpSurface={bumpSurface}
            setPostModifier={setPostModifier}
            removePost={removePost}
            chantierEst={chantierEst}
            totalMid={totalMid}
            onBack={() => macro ? setStep("quantity") : router.push("/")}
            onAddService={() => setShowAddService(true)}
            expandedPosts={expandedPosts}
            togglePostExpand={togglePostExpand}
            isEdit={!!editId}
            onCompare={() => setShowCompareModal(true)}
            onPrint={() => window.print()}
            qty={qty}
          />
        )}
      </div>

      {step === "detail" && (
        <div className="sticky-bottom no-print">
          <div className="sticky-bottom-inner">
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <p className="text-[11px] text-[color:var(--color-muted)] uppercase tracking-wide font-medium">Total</p>
                <p className="text-[20px] font-bold num">{fmtBRL(totalMid)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[color:var(--color-muted)]">
                  {chantierEst.estimates.length} serviço{chantierEst.estimates.length > 1 ? "s" : ""} · {chantierEst.days}d
                </p>
                <p className="text-[11px] text-[color:var(--color-muted)] num">
                  {fmtBRL(chantierEst.total[0])}–{fmtBRL(chantierEst.total[1])}
                </p>
              </div>
            </div>
            <button onClick={openSave} className="w-full btn-primary rounded-2xl py-3.5 text-[15px] font-semibold">
              {editId ? "Atualizar chantier" : "Salvar chantier"}
            </button>
          </div>
        </div>
      )}

      {showAddService && (
        <AddServiceModal
          existingIds={new Set(posts.map(p => p.serviceId))}
          search={addSearch}
          setSearch={setAddSearch}
          onPick={addService}
          onClose={() => { setShowAddService(false); setAddSearch(""); }}
        />
      )}

      {showSaveModal && (
        <SaveChantierModal
          name={chantierName}
          setName={setChantierName}
          total={chantierEst.total}
          onCancel={() => setShowSaveModal(false)}
          onConfirm={confirmSave}
          isEdit={!!editId}
        />
      )}

      {showCompareModal && (
        <CompareModal
          chantierEst={chantierEst}
          onClose={() => setShowCompareModal(false)}
          onResult={r => { setComparisonResult(r); setShowCompareModal(false); }}
        />
      )}

      {comparisonResult && (
        <ComparisonResultModal
          result={comparisonResult}
          onClose={() => setComparisonResult(null)}
        />
      )}

      {showShareModal && (
        <ShareModal
          chantierName={chantierName || (macro ? macro.name : "Chantier")}
          posts={posts.filter(p => p.enabled !== false).map(p => ({ serviceId: p.serviceId, surface: p.surface, modifiers: p.modifiers }))}
          finish={finish}
          total={chantierEst.total}
          editId={editId}
          copied={shareCopied}
          setCopied={setShareCopied}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// STEP 1 — Pick macro (avec search + prix "a partir de")
// ============================================================
function PickMacro({ onPick }: { onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  // Précalcule "a partir de" pour chaque macro (defaultQty, básico, config par défaut)
  const macroPrices = useMemo(() => {
    const map: Record<string, number> = {};
    MACROS.forEach(m => {
      const posts = macroToServicePosts(m, m.defaultQty);
      const est = estimateChantier(posts, "economico", DEFAULT_CONFIG);
      map[m.id] = est.total[0];
    });
    return map;
  }, []);

  const filteredByGroup = MACRO_GROUPS.map(g => ({
    ...g,
    items: getMacrosByGroup(g.id).filter(m => {
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    }),
  })).filter(g => g.items.length > 0);

  const totalMatch = filteredByGroup.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <div className="px-6 pt-6 pb-3 fade-in">
        <h1 className="large-title">O que você quer fazer?</h1>
        <p className="text-[15px] text-[color:var(--color-muted)] mt-1">
          Escolha um pacote pronto (cômodo completo) ou um serviço específico.
        </p>
      </div>

      {/* CTA photo — raccourci vers /foto */}
      <div className="px-6 pt-2 pb-3 fade-in fade-in-1">
        <Link
          href="/foto"
          className="w-full rounded-2xl border-2 border-dashed border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/5 px-4 py-3.5 flex items-center gap-3 hover:bg-[color:var(--color-accent)]/10 transition"
        >
          <span className="w-10 h-10 rounded-full bg-[color:var(--color-accent)]/10 flex items-center justify-center text-xl shrink-0">
            📸
          </span>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[14px] font-semibold text-[color:var(--color-accent)] leading-tight">Analisar por foto</p>
            <p className="text-[11px] text-[color:var(--color-ink-2)] opacity-95 leading-tight mt-0.5">Analyser par photo · IA sugere as macros</p>
          </div>
          <svg className="text-[color:var(--color-accent)] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* Search bar */}
      <div className="px-6 pt-4 pb-3 fade-in fade-in-1">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar (cozinha, pintura, piso…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[color:var(--color-bg-2)] rounded-xl pl-10 pr-4 py-3 text-[15px] outline-none placeholder:text-[color:var(--color-muted)]"
          />
        </div>
      </div>

      {totalMatch === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-[color:var(--color-muted)] text-[14px]">Nada encontrado para "{search}".</p>
        </div>
      ) : (
        filteredByGroup.map((g, gi) => (
          <div key={g.id} className={`px-6 mb-8 fade-in fade-in-${gi + 2}`}>
            <div className="mb-3 px-2">
              <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">{g.label}</p>
              <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{g.desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.items.map(m => (
                <button
                  key={m.id}
                  onClick={() => onPick(m.id)}
                  className="card-outlined p-4 text-left flex flex-col items-start gap-2 active:scale-[0.98] transition"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="w-full">
                    <p className="text-[14px] font-semibold leading-tight">{m.name}</p>
                    <p className="text-[10px] text-[color:var(--color-muted)] mt-1 leading-tight">por {m.unit}</p>
                    <div className="mt-2 pt-2 border-t border-[color:var(--color-line)]">
                      <p className="text-[10px] text-[color:var(--color-muted)] font-medium">a partir de</p>
                      <p className="text-[13px] font-bold num text-[color:var(--color-ink)]">
                        {fmtBRL(macroPrices[m.id])}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ============================================================
// STEP 2 — Quantity
// ============================================================
function PickQuantity({
  macro, qty, setQty, onNext, onBack,
}: {
  macro: NonNullable<ReturnType<typeof getMacro>>;
  qty: number;
  setQty: (n: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const macroFr = getMacroFr(macro.id);
  return (
    <>
      <div className="px-6 pt-6 pb-4 fade-in">
        <button onClick={onBack} className="text-[color:var(--color-muted)] text-sm mb-4 flex items-center gap-1 hover:text-[color:var(--color-ink)] transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          voltar
          <span className="text-[10px] opacity-60 ml-0.5">· retour</span>
        </button>
        <div className="flex items-start gap-3 mb-2">
          <span className="text-3xl leading-none pt-0.5">{macro.emoji}</span>
          <div>
            <h1 className="text-[24px] font-bold leading-tight">{macro.name}</h1>
            {macroFr?.name && (
              <p className="text-[11px] text-[color:var(--color-muted)] opacity-70 mt-0.5 leading-tight">{macroFr.name}</p>
            )}
          </div>
        </div>
        <p className="text-[14px] text-[color:var(--color-muted)]">{macro.description}</p>
        {macroFr?.description && (
          <p className="text-[11px] text-[color:var(--color-muted)] opacity-60 mt-1 leading-snug italic">{macroFr.description}</p>
        )}
      </div>

      <div className="px-6 mb-8 fade-in fade-in-1">
        <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
          Qual o tamanho?
          <span className="block normal-case tracking-normal text-[10px] opacity-70 font-normal">Quelle taille ?</span>
        </p>
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[color:var(--color-ink)] leading-tight">Meça a área e ajuste</p>
              <p className="text-[11px] text-[color:var(--color-muted)] opacity-70 mt-0.5">Mesure la surface et ajuste</p>
            </div>
            <QtyInput
              value={qty}
              onChange={setQty}
              min={macro.minQty}
              max={macro.maxQty}
              unit={macro.unit.split(" ")[0]}
            />
          </div>
          <input type="range" min={macro.minQty} max={macro.maxQty} value={qty} onChange={e => setQty(parseInt(e.target.value))} className="w-full" />
          <div className="flex justify-between text-[11px] text-[color:var(--color-muted)] mt-2 num">
            <span>{macro.minQty}</span>
            <span>{Math.round((macro.minQty + macro.maxQty) / 2)}</span>
            <span>{macro.maxQty}</span>
          </div>
          <p className="text-[11px] text-[color:var(--color-muted)] mt-4 leading-relaxed">
            Padrão sugerido: <b>{macro.defaultQty} {macro.unit}</b>. Meça com uma trena para mais precisão.
            <span className="block opacity-70 mt-0.5">Standard suggéré. Mesure au mètre ruban pour plus de précision.</span>
          </p>
        </div>
      </div>

      <div className="px-6">
        <button onClick={onNext} className="w-full btn-primary rounded-2xl py-4 text-[16px] font-semibold flex flex-col items-center justify-center gap-0.5">
          <span className="flex items-center gap-2">
            Ver detalhamento
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
          <span className="text-[10px] opacity-70 font-normal">Voir le détail</span>
        </button>
      </div>
    </>
  );
}

// ============================================================
// STEP 3 — Detail
// ============================================================
function Detail({
  macro, chantierName, posts, finish, setFinish, config, setConfig, configOpen, setConfigOpen,
  togglePost, bumpSurface, setPostModifier, removePost, chantierEst, totalMid, onBack, onAddService,
  expandedPosts, togglePostExpand, isEdit, onCompare, onPrint, qty,
}: {
  macro: Macro | null;
  chantierName: string;
  posts: ServicePost[];
  finish: Finish;
  setFinish: (f: Finish) => void;
  config: EstimateConfig;
  setConfig: (c: EstimateConfig) => void;
  configOpen: boolean;
  setConfigOpen: (v: boolean) => void;
  togglePost: (i: number) => void;
  bumpSurface: (i: number, delta: number) => void;
  setPostModifier: (i: number, modId: string, optIdx: number) => void;
  removePost: (i: number) => void;
  chantierEst: ReturnType<typeof estimateChantier>;
  totalMid: number;
  onBack: () => void;
  onAddService: () => void;
  expandedPosts: Set<number>;
  togglePostExpand: (i: number) => void;
  isEdit: boolean;
  onCompare: () => void;
  onPrint: () => void;
  qty: number;
}) {
  const enabledCount = posts.filter(p => p.enabled !== false).length;
  const totalSurface = posts.filter(p => p.enabled !== false).reduce((s, p) => s + p.surface, 0);
  const alerts = useMemo(() => detectAlerts(chantierEst, config, qty || totalSurface), [chantierEst, config, qty, totalSurface]);

  return (
    <>
      <div className="px-6 pt-6 pb-4 fade-in">
        <button onClick={onBack} className="text-[color:var(--color-muted)] text-sm mb-4 flex items-center gap-1 hover:text-[color:var(--color-ink)] transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {isEdit ? "início" : "voltar"}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{macro?.emoji || "🔧"}</span>
          <h1 className="text-[22px] font-bold leading-tight">{macro?.name || chantierName || "Chantier"}</h1>
        </div>
        {isEdit && (
          <p className="text-[12px] text-[color:var(--color-muted)] mt-1 ml-11">Editando chantier salvo</p>
        )}
      </div>

      {/* Total card — receipt style */}
      <div className="px-6 mb-6 fade-in fade-in-1">
        <div className="card-outlined p-6">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-muted)] font-medium mb-3">
              {config.materialMode === "client" ? "Só mão de obra" : "Total com BDI"}
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-[color:var(--color-muted)] text-xl font-medium">R$</span>
              <span className="display text-[52px]">{fmt(totalMid)}</span>
            </div>
            <p className="text-[12px] text-[color:var(--color-muted)] num mt-1">
              {fmtBRL(chantierEst.total[0])} — {fmtBRL(chantierEst.total[1])}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[color:var(--color-muted)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[12px]">{chantierEst.days} dias · {chantierEst.workers} pedreiro{chantierEst.workers > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="divider mb-4" />

          <div className="space-y-2 text-[13px]">
            {config.materialMode !== "client" && (
              <ReceiptLine dot="#0071e3" label="Material" value={fmtBRL(midOf(chantierEst.material))} />
            )}
            {config.modoContrato === "diaria" ? (
              <ReceiptLine dot="#8e8e93" label="Mão de obra (diária)" hint={`${chantierEst.days}d · R$${config.diariaOficial}/${config.diariaAjudante}`} value={fmtBRL(midOf(chantierEst.moFinal))} />
            ) : (
              <>
                <ReceiptLine dot="#8e8e93" label="Mão de obra bruta"                                        value={fmtBRL(midOf(chantierEst.moBase))} />
                <ReceiptLine dot="#af52de" label={`Encargos sociais`}  hint={fmtPct(config.encargos)}       value={fmtBRL(midOf(chantierEst.moEncargos))} />
                <ReceiptLine dot="#ff9500" label={`BDI empreiteira`}   hint={fmtPct(config.bdi)}            value={fmtBRL(midOf(chantierEst.bdi))} />
              </>
            )}
            <ReceiptLine   dot="#ff3b30" label={`Contingência`}      hint={fmtPct(config.contingencia)}   value={fmtBRL(midOf(chantierEst.contingencia))} />
            <div className="divider my-2" />
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-[14px]">Total final</span>
              <span className="font-bold num text-[15px]">{fmtBRL(totalMid)}</span>
            </div>
          </div>

          {/* Alertes anomalies */}
          {alerts.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[color:var(--color-line)] space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                  <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={a.level === "danger" ? "#ff3b30" : a.level === "warn" ? "#ff9500" : "#0071e3"} strokeWidth={2.5}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-[color:var(--color-ink-2)]">{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bouton Comparar com orçamento */}
        <button
          onClick={onCompare}
          className="w-full mt-3 py-3 bg-[color:var(--color-accent-soft)] rounded-2xl flex items-center justify-center gap-2 text-[13px] font-semibold text-[color:var(--color-accent)] active:scale-[0.98] transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
            <path d="M19 3h-4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
          </svg>
          Comparar com orçamento recebido
        </button>
      </div>

      {/* Timeline visuel des phases */}
      <PhaseTimelineSection chantierEst={chantierEst} />


      {/* Configuration accordéon */}
      <div className="px-6 mb-6 fade-in fade-in-2">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full card-outlined p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <p className="text-[14px] font-semibold">Configuração do devis</p>
            <span className="text-[11px] text-[color:var(--color-muted)] num">
              {config.modoContrato === "diaria"
                ? `💵 R$${config.diariaOficial}/${config.diariaAjudante}`
                : `🏢 BDI ${fmtPct(config.bdi)}`
              } · 👷{config.oficiais}{config.ajudantes > 0 ? `+🧑‍🔧${config.ajudantes}` : ""}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: configOpen ? "rotate(180deg)" : "" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {configOpen && (
          <div className="card-outlined p-5 mt-2 space-y-5">
            {/* Toggle mode contratação */}
            <div>
              <p className="text-[13px] font-medium mb-2">
                Modo de contratação
                <span className="block text-[10px] text-[color:var(--color-muted)] opacity-70 font-normal">Type de contrat</span>
              </p>
              <div className="segmented">
                <button
                  onClick={() => setConfig({ ...config, modoContrato: "diaria" })}
                  className={`seg-btn ${config.modoContrato === "diaria" ? "active" : ""}`}
                >
                  💵 Diária MEI
                </button>
                <button
                  onClick={() => setConfig({ ...config, modoContrato: "empreiteira" })}
                  className={`seg-btn ${config.modoContrato === "empreiteira" ? "active" : ""}`}
                >
                  🏢 Empreiteira
                </button>
              </div>
              <p className="text-[11px] text-[color:var(--color-muted)] mt-2 leading-snug">
                {config.modoContrato === "diaria"
                  ? "R$/dia direto para o artesão MEI. Sem encargos, sem BDI. Cliente compra o material."
                  : "Empreiteira com empregados CLT. Encargos sociais + BDI + material com margem."}
              </p>
            </div>

            {config.modoContrato === "diaria" ? (
              <>
                <ConfigInput
                  label="Diária oficial (R$/dia)"
                  hint="Pedreiro, pintor, encanador. Marché Rio Centro ~R$ 200-350/dia."
                  value={config.diariaOficial}
                  onChange={v => setConfig({ ...config, diariaOficial: v })}
                  min={100} max={600}
                />
                <ConfigInput
                  label="Diária ajudante (R$/dia)"
                  hint="Servente, auxiliar. Rio Centro ~R$ 120-200/dia."
                  value={config.diariaAjudante}
                  onChange={v => setConfig({ ...config, diariaAjudante: v })}
                  min={80} max={400}
                />
              </>
            ) : (
              <>
                <ConfigSlider
                  label="BDI empreiteira"
                  tip="Frais généraux + marge. Padrão BR 25-35%."
                  value={config.bdi}
                  onChange={v => setConfig({ ...config, bdi: v })}
                  min={0} max={0.5} step={0.01}
                />
                <ConfigSlider
                  label="Encargos sociais sur MO"
                  tip="INSS + FGTS + férias + 13º. Padrão BR ~80% sur MO bruta."
                  value={config.encargos}
                  onChange={v => setConfig({ ...config, encargos: v })}
                  min={0} max={1.2} step={0.05}
                />
              </>
            )}

            <ConfigSlider
              label="Contingência (imprévus)"
              tip="Reserva para surpresas de chantier. Recomendado 10-15%."
              value={config.contingencia}
              onChange={v => setConfig({ ...config, contingencia: v })}
              min={0} max={0.25} step={0.01}
            />

            <div className="divider" />

            <div>
              <p className="text-[13px] font-medium mb-2">Modo material</p>
              <div className="segmented">
                <button
                  onClick={() => setConfig({ ...config, materialMode: "included" })}
                  className={`seg-btn ${config.materialMode === "included" ? "active" : ""}`}
                >
                  Empreiteiro fornece
                </button>
                <button
                  onClick={() => setConfig({ ...config, materialMode: "client" })}
                  className={`seg-btn ${config.materialMode === "client" ? "active" : ""}`}
                >
                  Cliente compra
                </button>
              </div>
              <p className="text-[11px] text-[color:var(--color-muted)] mt-2">
                {config.materialMode === "included"
                  ? "Preço inclui material com marge do empreiteiro."
                  : "Só mão de obra. Cliente compra o material separadamente (lista abaixo)."}
              </p>
            </div>

            <div className="divider" />

            <TeamPicker config={config} setConfig={setConfig} />

            <button
              onClick={() => setConfig(DEFAULT_CONFIG)}
              className="text-[12px] text-[color:var(--color-accent)] font-medium"
            >
              Resetar padrão BR
            </button>
          </div>
        )}
      </div>

      {/* Finish */}
      <div className="px-6 mb-8 fade-in fade-in-3">
        <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">Acabamento global</p>
        <div className="segmented">
          {FINISH_LABELS.map(f => (
            <button key={f.id} onClick={() => setFinish(f.id)} className={`seg-btn ${finish === f.id ? "active" : ""}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services detail */}
      <div className="px-6 mb-6 fade-in fade-in-4">
        <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
          Detalhamento por poste ({enabledCount}/{posts.length})
        </p>
        <div className="space-y-3">
          {posts.map((post, idx) => {
            const svc = getService(post.serviceId);
            if (!svc) return null;
            const enabled = post.enabled !== false;
            const expanded = expandedPosts.has(idx);
            const est = estimatePost(post, finish, config);
            const midPost = est ? midOf(est.total) : 0;
            const pct = totalMid > 0 && enabled ? Math.round((midPost / totalMid) * 100) : 0;
            const macroPost = macro?.posts.find(mp => mp.serviceId === post.serviceId);
            const note = macroPost?.note;

            return (
              <div key={idx} className={`card-outlined overflow-hidden transition-opacity ${enabled ? "" : "opacity-50"}`}>
                {/* Compact header — always visible */}
                <div className="flex items-center gap-3 p-3">
                  <button onClick={(e) => { e.stopPropagation(); togglePost(idx); }} className={`check ${enabled ? "on" : ""}`} aria-label="toggle">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => togglePostExpand(idx)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[color:var(--color-bg-2)] flex items-center justify-center text-base shrink-0">
                      {svc.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-semibold leading-tight truncate">{svc.name.replace(/^[^\s]+\s/, "")}</p>
                        {est?.observedSource && (
                          <span
                            title={`${est.observedSource.datapoints} NFs · ${est.observedSource.source}`}
                            className="inline-flex items-center gap-0.5 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            RJ
                          </span>
                        )}
                      </div>
                      {enabled && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[color:var(--color-muted)] num">
                            {post.surface.toFixed(post.surface % 1 === 0 ? 0 : 1)} {svc.unit}
                          </span>
                          {pct > 0 && (
                            <>
                              <span className="text-[10px] text-[color:var(--color-line-2)]">·</span>
                              <span className="text-[11px] text-[color:var(--color-muted)] num">{pct}%</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {est && enabled && (
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold num">{fmtBRL(midPost)}</p>
                      </div>
                    )}
                    <svg
                      className="text-[color:var(--color-muted)] shrink-0 transition-transform"
                      style={{ transform: expanded ? "rotate(180deg)" : "" }}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {/* % bar (visible même collapsed) */}
                {enabled && pct > 0 && !expanded && (
                  <div className="px-3 pb-2 ml-[calc(22px+12px+36px+12px)]">
                    <div className="h-0.5 rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
                      <div className="h-full bg-[color:var(--color-accent)] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {/* Expanded content */}
                {enabled && expanded && (
                  <div className="px-4 pb-4">
                    <div className="divider mb-3" />

                    {note && (
                      <p className="text-[11px] text-[color:var(--color-muted)] italic mb-3 leading-snug">💡 {note}</p>
                    )}

                    {est && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <MiniStat label={config.materialMode === "client" ? "Só MO" : "Material"} value={fmtBRL(midOf(config.materialMode === "client" ? [0, 0] : est.material))} />
                        <MiniStat label="MO + enc." value={fmtBRL(midOf(est.moFinal))} />
                        <MiniStat label="Prazo" value={`${est.days}d`} />
                      </div>
                    )}

                    <DaysBreakdownBlock post={post} config={config} />


                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[12px] text-[color:var(--color-muted)]">Quantidade ({svc.unit})</label>
                      <PostSurfaceInput
                        value={post.surface}
                        onDelta={d => bumpSurface(idx, d)}
                        onSet={(n) => {
                          const delta = n - post.surface;
                          if (delta !== 0) bumpSurface(idx, delta);
                        }}
                      />
                    </div>
                    {(svc.modifiers || []).map(m => (
                      <div key={m.id} className="mb-2">
                        <p className="text-[11px] text-[color:var(--color-muted)] mb-1.5">{m.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => setPostModifier(idx, m.id, i)}
                              className={`chip ${(post.modifiers?.[m.id] ?? 0) === i ? "active" : ""} rounded-full px-3 py-1 text-[11px]`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => removePost(idx)}
                      className="text-[11px] text-[color:var(--color-danger)] mt-2 opacity-70 hover:opacity-100"
                    >
                      Remover este poste
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={onAddService}
            className="w-full py-3.5 text-[14px] font-medium text-[color:var(--color-accent)] flex items-center justify-center gap-1.5 border border-dashed border-[color:var(--color-line-2)] rounded-2xl"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar outro serviço
          </button>
        </div>
      </div>

      {/* Material list */}
      <div className="px-6 mb-8 fade-in fade-in-5">
        <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-3 px-2">
          Lista de material {config.materialMode === "client" ? "(cliente compra)" : "(empreiteiro fornece)"}
        </p>
        <div className="space-y-3">
          {chantierEst.estimates.map(e => {
            const mats = getMaterials(e.post.serviceId, e.post.surface, finish);
            const svc = e.svc;
            return (
              <div key={e.post.serviceId} className="card-outlined p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{svc.emoji}</span>
                    <p className="text-[13px] font-semibold">{svc.name.replace(/^[^\s]+\s/, "")}</p>
                  </div>
                  {mats && <span className="text-[12px] font-semibold num">{fmtBRL(mats.reduce((s, m) => s + m.total, 0))}</span>}
                </div>
                {mats ? (
                  <div>
                    {mats.map((m, i) => (
                      <div key={i} className={`flex items-baseline justify-between py-1.5 ${i > 0 ? "border-t border-[color:var(--color-line)]" : ""}`}>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[12px] truncate">{m.name}</p>
                          <p className="text-[10px] text-[color:var(--color-muted)] num">
                            {m.qty} {m.unit} × {fmtBRL(m.unitPrice)}
                          </p>
                        </div>
                        <p className="text-[12px] font-medium num shrink-0">{fmtBRL(m.total)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[color:var(--color-muted)]">Lista detalhada em breve para este serviço.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="flex items-start gap-2 px-2">
          <svg className="mt-0.5 text-[color:var(--color-success)] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <p className="text-[11px] text-[color:var(--color-muted)] leading-relaxed">
            Calibrado com SINAPI RJ 2025 + 246 NFs reais Rio Centro. Encargos e BDI aplicados conforme padrão BR (ajustáveis na configuração).
          </p>
        </div>
      </div>
    </>
  );
}

function QtyInput({
  value, onChange, min, max, unit,
}: {
  value: number; onChange: (n: number) => void;
  min: number; max: number; unit: string;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);

  function commit(raw: string) {
    const n = parseInt(raw.replace(/[^\d]/g, ""));
    if (isNaN(n)) { setTxt(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setTxt(String(clamped));
  }

  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className="flex items-baseline gap-1 bg-white dark:bg-[color:var(--color-bg-2)] rounded-xl px-3 py-1.5 border border-[color:var(--color-line)] cursor-text hover:border-[color:var(--color-accent)] focus-within:border-[color:var(--color-accent)] focus-within:ring-2 focus-within:ring-[color:var(--color-accent)]/20 transition"
      onClick={() => ref.current?.focus()}
    >
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={txt}
        onChange={e => setTxt(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-16 text-right display text-3xl bg-transparent outline-none cursor-text"
      />
      <span className="text-[color:var(--color-muted)] text-sm">{unit}</span>
    </label>
  );
}

function PostSurfaceInput({
  value, onDelta, onSet,
}: {
  value: number; onDelta: (d: number) => void; onSet: (n: number) => void;
}) {
  const [txt, setTxt] = useState(value.toFixed(value % 1 === 0 ? 0 : 1));
  useEffect(() => { setTxt(value.toFixed(value % 1 === 0 ? 0 : 1)); }, [value]);

  function commit(raw: string) {
    const n = parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
    if (isNaN(n) || n <= 0) { setTxt(value.toFixed(value % 1 === 0 ? 0 : 1)); return; }
    const clamped = Math.max(0.5, Math.round(n * 10) / 10);
    onSet(clamped);
  }

  return (
    <div className="stepper">
      <button onClick={() => onDelta(-1)}>−</button>
      <input
        type="text"
        inputMode="decimal"
        value={txt}
        onChange={e => setTxt(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-14 text-center bg-transparent border-none text-[15px] font-semibold num text-[color:var(--color-ink)] outline-none"
      />
      <button onClick={() => onDelta(1)}>+</button>
    </div>
  );
}

function PhaseTimelineSection({ chantierEst }: { chantierEst: ReturnType<typeof estimateChantier> }) {
  const perPhase = useMemo(() => {
    const map: Record<PhaseId, { days: number; total: number; count: number }> = {
      preparo: { days: 0, total: 0, count: 0 },
      estrutura: { days: 0, total: 0, count: 0 },
      instalacoes: { days: 0, total: 0, count: 0 },
      acabamento: { days: 0, total: 0, count: 0 },
      final: { days: 0, total: 0, count: 0 },
    };
    chantierEst.estimates.forEach(e => {
      const ph = getPhaseForService(e.post.serviceId);
      map[ph.id].days += e.days;
      map[ph.id].total += midOf(e.total);
      map[ph.id].count += 1;
    });
    return map;
  }, [chantierEst]);

  const totalDays = Object.values(perPhase).reduce((s, p) => s + p.days, 0);
  if (totalDays === 0) return null;

  const activePhases = PHASES.filter(p => perPhase[p.id].count > 0);

  return (
    <div className="px-6 mb-6 fade-in fade-in-2">
      <div className="flex items-center justify-between mb-3 px-2">
        <p className="text-[13px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium">Cronograma</p>
        <p className="text-[11px] text-[color:var(--color-muted)] num">{Math.round(totalDays)} dias · {activePhases.length} fase{activePhases.length > 1 ? "s" : ""}</p>
      </div>
      <div className="card-outlined p-5">
        <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
          {activePhases.map(p => (
            <div
              key={p.id}
              className="h-full"
              style={{
                width: `${(perPhase[p.id].days / totalDays) * 100}%`,
                background: p.color,
              }}
              title={`${p.label} · ${Math.round(perPhase[p.id].days)}d`}
            />
          ))}
        </div>
        <div className="space-y-2.5">
          {activePhases.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-base shrink-0">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{p.label}</p>
                <p className="text-[10px] text-[color:var(--color-muted)]">{perPhase[p.id].count} serviço{perPhase[p.id].count > 1 ? "s" : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold num">{Math.round(perPhase[p.id].days)}d</p>
                <p className="text-[10px] text-[color:var(--color-muted)] num">{fmtBRL(perPhase[p.id].total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReceiptLine({ dot, label, hint, value }: { dot: string; label: string; hint?: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <span className="text-[color:var(--color-ink-2)]">{label}</span>
        {hint && <span className="text-[10px] text-[color:var(--color-muted)] num">+{hint}</span>}
      </div>
      <span className="num text-[color:var(--color-ink-2)]">{value}</span>
    </div>
  );
}

function CompareModal({
  chantierEst, onClose, onResult,
}: {
  chantierEst: ReturnType<typeof estimateChantier>;
  onClose: () => void;
  onResult: (r: ComparisonResult) => void;
}) {
  const [totalTxt, setTotalTxt] = useState("");
  const [mode, setMode] = useState<"total" | "detail">("total");
  const [postValues, setPostValues] = useState<Record<string, string>>({});
  const [aiParsing, setAiParsing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string>("");
  const aiInputRef = useRef<HTMLInputElement>(null);

  async function handleAiParse(file: File) {
    setAiError("");
    setAiSummary("");
    setAiParsing(true);
    try {
      const expectedServices = chantierEst.estimates.map(e => ({
        serviceId: e.svc.id,
        name: e.svc.name,
        category: e.svc.cat,
      }));
      const form = new FormData();
      form.append("file", file);
      form.append("expectedServices", JSON.stringify(expectedServices));
      const res = await fetch("/api/parse-orcamento", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao analisar orçamento.");
      const parsed = data.parsed as {
        totalRecebido: number;
        postsRecebido: Record<string, number>;
        linhas: Array<{ descricao_normalizada: string; servico_matched: string | null }>;
        linhas_nao_matchadas: number;
      };
      // Pré-remplit les champs.
      if (parsed.totalRecebido > 0) {
        setTotalTxt(String(Math.round(parsed.totalRecebido)));
      }
      if (Object.keys(parsed.postsRecebido).length > 0) {
        setMode("detail");
        const values: Record<string, string> = {};
        Object.entries(parsed.postsRecebido).forEach(([sid, v]) => {
          values[sid] = String(Math.round(v));
        });
        setPostValues(values);
      }
      const matched = parsed.linhas.filter(l => l.servico_matched).length;
      setAiSummary(
        `✓ ${parsed.linhas.length} linhas lidas · ${matched} associadas a serviços${parsed.linhas_nao_matchadas > 0 ? ` · ${parsed.linhas_nao_matchadas} sem match` : ""}`,
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiParsing(false);
    }
  }

  function onAiFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiParse(f);
  }

  function submit() {
    const total = parseFloat(totalTxt.replace(/\./g, "").replace(",", "."));
    if (isNaN(total) || total <= 0) return;
    let postsRecebido: Record<string, number> | undefined = undefined;
    if (mode === "detail") {
      postsRecebido = {};
      Object.entries(postValues).forEach(([sid, v]) => {
        const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
        if (!isNaN(n) && n > 0) postsRecebido![sid] = n;
      });
    }
    const result = compareWithOrcamento(chantierEst, { totalRecebido: total, postsRecebido });
    onResult(result);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 flex items-center justify-between border-b border-[color:var(--color-line)]">
          <p className="text-[16px] font-semibold">Comparar com orçamento</p>
          <button onClick={onClose} className="text-[color:var(--color-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Upload orçamento (PDF ou photo) — parse automatique via Claude Vision */}
          <div className="rounded-2xl border border-dashed border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-soft)]/40 p-4">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-semibold mb-2 px-1">
              📸 Ler orçamento com IA
              <span className="block normal-case tracking-normal text-[10px] opacity-95 font-normal text-[color:var(--color-ink-2)]">Lire un devis via IA</span>
            </p>
            <input
              ref={aiInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onAiFileChange}
              className="sr-only"
              id="cq-orcamento-file"
            />
            <label
              htmlFor="cq-orcamento-file"
              className={`w-full rounded-xl bg-[color:var(--color-accent)] text-white py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${aiParsing ? "opacity-60 pointer-events-none" : "hover:opacity-90"}`}
            >
              {aiParsing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Analisando o orçamento…
                </>
              ) : (
                <>📤 Escolher PDF ou foto</>
              )}
            </label>
            {aiSummary && (
              <p className="text-[11px] text-[#34c759] mt-2 font-medium">{aiSummary}</p>
            )}
            {aiError && (
              <p className="text-[11px] text-[#ff3b30] mt-2">{aiError}</p>
            )}
            <p className="text-[10px] text-[color:var(--color-muted)] mt-2 leading-snug">
              A IA extrai as linhas do orçamento e associa cada uma aos serviços do chantier.
            </p>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-1.5 block px-1">
              Valor total do orçamento (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={totalTxt}
              onChange={e => setTotalTxt(e.target.value)}
              placeholder="Ex: 18500"
              className="w-full bg-[color:var(--color-bg-2)] rounded-xl px-4 py-3 text-[17px] font-semibold num outline-none placeholder:text-[color:var(--color-muted)] placeholder:font-normal focus:bg-white focus:border focus:border-[color:var(--color-line-2)] transition"
              autoFocus
            />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
              Detalhamento por poste (opcional)
            </p>
            <div className="segmented">
              <button onClick={() => setMode("total")} className={`seg-btn ${mode === "total" ? "active" : ""}`}>Só total</button>
              <button onClick={() => setMode("detail")} className={`seg-btn ${mode === "detail" ? "active" : ""}`}>Detalhado</button>
            </div>
            {mode === "detail" && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[color:var(--color-muted)] px-1 leading-snug">Digite o preço do empreiteiro para cada poste que ele detalhou. Deixe em branco os postes sem detalhe.</p>
                {chantierEst.estimates.map(e => (
                  <div key={e.post.serviceId} className="flex items-center gap-2">
                    <span className="text-base shrink-0">{e.svc.emoji}</span>
                    <span className="flex-1 text-[13px] truncate">{e.svc.name.replace(/^[^\s]+\s/, "")}</span>
                    <div className="w-24 bg-[color:var(--color-bg-2)] rounded-lg px-2 py-1.5 flex items-center gap-1">
                      <span className="text-[11px] text-[color:var(--color-muted)]">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={fmt(midOf(e.total))}
                        value={postValues[e.post.serviceId] ?? ""}
                        onChange={ev => setPostValues(prev => ({ ...prev, [e.post.serviceId]: ev.target.value }))}
                        className="flex-1 text-right text-[13px] font-semibold num bg-transparent outline-none placeholder:text-[color:var(--color-line-2)] placeholder:font-normal"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-[color:var(--color-line)] grid grid-cols-2">
          <button onClick={onClose} className="py-3.5 text-[15px] text-[color:var(--color-muted)] border-r border-[color:var(--color-line)]">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!totalTxt.trim()}
            className="py-3.5 text-[15px] font-semibold text-[color:var(--color-accent)] disabled:opacity-40"
          >
            Comparar
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparisonResultModal({ result, onClose }: { result: ComparisonResult; onClose: () => void }) {
  const v = verdictLabel(result.verdict);
  const isPositive = result.deltaAbs > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 flex items-center justify-between border-b border-[color:var(--color-line)]">
          <p className="text-[16px] font-semibold">Resultado da comparação</p>
          <button onClick={onClose} className="text-[color:var(--color-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1.5 rounded-full mb-4" style={{ background: v.color + "22", color: v.color }}>
              <p className="text-[11px] font-bold uppercase tracking-wide">{v.label}</p>
            </div>
            <p className="text-[12px] text-[color:var(--color-muted)] mb-1">Diferença</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="display text-4xl" style={{ color: v.color }}>
                {isPositive ? "+" : ""}{fmtBRL(Math.abs(result.deltaAbs))}
              </span>
            </div>
            <p className="text-[13px] text-[color:var(--color-muted)] mt-1 num">
              {isPositive ? "+" : ""}{Math.round(result.deltaPct * 100)}% vs nossa estimativa
            </p>
          </div>

          <div className="card p-4 mb-4 space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[color:var(--color-muted)]">Orçamento recebido</span>
              <span className="font-semibold num">{fmtBRL(result.totalRecebido)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[color:var(--color-muted)]">Nossa estimativa</span>
              <span className="font-semibold num">{fmtBRL(result.estimatedMid)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[color:var(--color-muted)]">
              <span>Faixa</span>
              <span className="num">{fmtBRL(result.estimatedRange[0])}–{fmtBRL(result.estimatedRange[1])}</span>
            </div>
          </div>

          {result.perPost && result.perPost.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-2 px-1">
                Detalhamento por poste
              </p>
              <div className="space-y-1.5">
                {result.perPost.map(p => {
                  const c = p.deltaPct > 0.15 ? "#ff9500" : p.deltaPct > 0.35 ? "#ff3b30" : p.deltaPct < -0.15 ? "#0071e3" : "#34c759";
                  return (
                    <div key={p.serviceId} className="card p-3 flex items-center justify-between text-[13px]">
                      <span className="truncate flex-1">{p.svcName}</span>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-semibold num" style={{ color: c }}>
                          {p.deltaAbs > 0 ? "+" : ""}{Math.round(p.deltaPct * 100)}%
                        </p>
                        <p className="text-[10px] text-[color:var(--color-muted)] num">
                          {fmtBRL(p.recebido)} vs {fmtBRL(p.estimated)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-[color:var(--color-muted)] mt-5 leading-snug px-1 text-center">
            Faixa média Rio Centro baseada em SINAPI RJ 2025 e 246 NFs reais. Diferenças podem ser justificadas por qualidade, urgência ou marca específica.
          </p>
        </div>
        <div className="border-t border-[color:var(--color-line)] p-3">
          <button onClick={onClose} className="w-full py-3 text-[15px] font-semibold text-[color:var(--color-accent)]">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal de partage : lien public, WhatsApp, impression PDF
// ============================================================
function ShareModal({
  chantierName, posts, finish, total, editId, copied, setCopied, onClose,
}: {
  chantierName: string;
  posts: ServicePost[];
  finish: Finish;
  total: [number, number];
  editId: string | null;
  copied: boolean;
  setCopied: (b: boolean) => void;
  onClose: () => void;
}) {
  // Construit un Chantier temporaire pour l'encoder — même sans sauvegarde préalable,
  // le lien contient toutes les data (pas besoin de backend).
  const shareUrl = useMemo(() => {
    const chantierForShare: Chantier = {
      id: editId || `ch_temp_${Date.now()}`,
      name: chantierName,
      posts,
      finish,
      total,
      createdAt: new Date().toISOString(),
    };
    // Si le chantier est sauvegardé, on prend la thumbnail de la 1re photo attachée.
    let thumb: string | undefined;
    if (editId) {
      const photos = getPhotosByChantier(editId);
      if (photos.length > 0) thumb = photos[0].thumbnail;
    }
    return buildShareUrl(chantierForShare, thumb);
  }, [chantierName, posts, finish, total, editId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  function handleWhatsApp() {
    const mid = midOf(total);
    const nPosts = posts.length;
    const text = [
      `📋 *${chantierName}*`,
      `${nPosts} serviço${nPosts > 1 ? "s" : ""} · ${fmtBRL(mid)}`,
      ``,
      `Ver detalhes : ${shareUrl}`,
      ``,
      `_Feito com Custa Quanto — estimador RJ_`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function handlePrint() {
    onClose();
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center px-6 pb-6 sm:pb-0">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[color:var(--color-accent-soft)] flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth={2}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold">Partilhar orçamento</p>
          <p className="text-[13px] text-[color:var(--color-muted)] mt-1">
            Lien público, sans compte utilisateur
          </p>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] transition text-left"
          >
            <span className="accordion-icon bg-[color:var(--color-accent-soft)]">🔗</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">{copied ? "✓ Link copiado !" : "Copiar link"}</p>
              <p className="text-[11px] text-[color:var(--color-muted)] truncate">
                Envie por onde quiser
              </p>
            </div>
          </button>

          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[color:var(--color-line)] hover:border-[#25D366] transition text-left"
          >
            <span className="accordion-icon bg-[#25D366]/10">💬</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">Partilhar por WhatsApp</p>
              <p className="text-[11px] text-[color:var(--color-muted)]">Mensagem pronta + link</p>
            </div>
          </button>

          <button
            onClick={handlePrint}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] transition text-left"
          >
            <span className="accordion-icon bg-[color:var(--color-bg-2)]">🖨</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">Imprimir / Salvar PDF</p>
              <p className="text-[11px] text-[color:var(--color-muted)]">Exportar em PDF via impressora</p>
            </div>
          </button>
        </div>

        <div className="border-t border-[color:var(--color-line)]">
          <button onClick={onClose} className="w-full py-3.5 text-[15px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveChantierModal({
  name, setName, total, onCancel, onConfirm, isEdit,
}: {
  name: string;
  setName: (n: string) => void;
  total: [number, number];
  onCancel: () => void;
  onConfirm: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[color:var(--color-accent-soft)] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth={2}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold">{isEdit ? "Atualizar chantier" : "Salvar chantier"}</p>
          <p className="text-[13px] text-[color:var(--color-muted)] mt-1 num">
            {fmtBRL(midOf(total))} · faixa {fmtBRL(total[0])}–{fmtBRL(total[1])}
          </p>
        </div>
        <div className="px-5 pb-5">
          <label className="text-[11px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium mb-1.5 block px-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
            placeholder="Ex: Cozinha Riachuelo"
            className="w-full bg-[color:var(--color-bg-2)] rounded-xl px-4 py-3 text-[15px] outline-none placeholder:text-[color:var(--color-muted)] focus:bg-white focus:border focus:border-[color:var(--color-line-2)] transition"
            autoFocus
          />
        </div>
        <div className="border-t border-[color:var(--color-line)] grid grid-cols-2">
          <button onClick={onCancel} className="py-3.5 text-[15px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition border-r border-[color:var(--color-line)]">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!name.trim()}
            className="py-3.5 text-[15px] font-semibold text-[color:var(--color-accent)] disabled:opacity-40 hover:bg-[color:var(--color-bg-2)] transition"
          >
            {isEdit ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Affiche le texte PT-BR + une petite traduction FR discrète en dessous.
function PtFr({
  fr, children, as: As = "span", className = "", frClassName = "",
}: {
  fr: string;
  children: React.ReactNode;
  as?: "span" | "p" | "h1" | "h2" | "div";
  className?: string;
  frClassName?: string;
}) {
  return (
    <As className={className}>
      {children}
      <span className={`block text-[color:var(--color-muted)] font-normal opacity-70 leading-tight ${frClassName || "text-[10px]"}`}>
        {fr}
      </span>
    </As>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[color:var(--color-bg-2)] rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-[color:var(--color-accent)] font-medium truncate">{label}</p>
      <p className="text-[12px] font-semibold num mt-0.5 leading-tight">{value}</p>
    </div>
  );
}

function DaysBreakdownBlock({ post, config }: { post: ServicePost; config: EstimateConfig }) {
  const [open, setOpen] = useState(false);
  const b = explainDays(post, config);
  if (!b) return null;

  const fmtD = (n: number) => (n < 1 ? n.toFixed(1) : Math.round(n).toString());
  const fmtQty = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));

  return (
    <div className="rounded-xl bg-[color:var(--color-bg-2)] mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px]">⏱️</span>
          <span className="text-[12px] font-medium">Como chegamos a {fmtD(b.daysFinal)} dia{b.daysFinal > 1 ? "s" : ""}</span>
        </div>
        <svg
          className="text-[color:var(--color-muted)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "" }}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[color:var(--color-line)]">
          <div className="space-y-1.5 text-[11px] leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--color-muted)]">Rendimento SINAPI</span>
              <span className="num font-medium">{b.baseDaily} {b.unit}/dia</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--color-muted)]">Quantidade</span>
              <span className="num font-medium">{fmtQty(b.qty)} {b.unit}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[color:var(--color-line)]">
              <span className="text-[color:var(--color-muted)] num">{fmtQty(b.qty)} ÷ {b.baseDaily}</span>
              <span className="num font-medium">
                {fmtD(b.qty / b.baseDaily)} dia{b.qty / b.baseDaily > 1 ? "s" : ""}
              </span>
            </div>

            {b.modifierSteps.length > 0 && (
              <>
                {b.modifierSteps.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[color:var(--color-muted)] truncate">× {s.optionLabel}</span>
                    <span className="num font-medium">×{s.factor.toFixed(2).replace(/\.?0+$/, "")}</span>
                  </div>
                ))}
              </>
            )}

            {b.teamStep && (
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)] truncate">
                  ÷ Equipe {b.teamStep.oficiais} oficial{b.teamStep.oficiais > 1 ? "is" : ""}{b.teamStep.ajudantes > 0 ? ` + ${b.teamStep.ajudantes} ajudante${b.teamStep.ajudantes > 1 ? "s" : ""}` : ""}
                </span>
                <span className="num font-medium">
                  {b.teamStep.factor > 1 ? "÷" : "×"}{(b.teamStep.factor > 1 ? b.teamStep.factor : 1 / b.teamStep.factor).toFixed(2).replace(/\.?0+$/, "")}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1.5 border-t border-[color:var(--color-line)]">
              <span className="font-semibold">= Prazo estimado</span>
              <span className="num font-bold text-[13px]">{fmtD(b.daysFinal)} dia{b.daysFinal > 1 ? "s" : ""}</span>
            </div>

            {b.clamped && (
              <p className="text-[10px] text-[color:var(--color-muted)] italic pt-1">
                Arredondado para meio-dia mínimo (setup + deslocamento).
              </p>
            )}
            <p className="text-[10px] text-[color:var(--color-muted)] pt-1">
              Fonte : {b.source} · Baseline SINAPI = 1 oficial + 1 servente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigInput({
  label, hint, value, onChange, min, max,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
  min: number; max: number;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);

  function commit(raw: string) {
    const n = parseInt(raw.replace(/[^\d]/g, ""));
    if (isNaN(n)) { setTxt(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setTxt(String(clamped));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[13px] font-medium">{label}</label>
        <div className="flex items-baseline gap-1 bg-[color:var(--color-bg-2)] rounded-lg px-2 py-1">
          <span className="text-[color:var(--color-muted)] text-[11px]">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={txt}
            onChange={e => setTxt(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onFocus={e => e.target.select()}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-14 text-right text-[14px] font-bold num bg-transparent outline-none"
            style={{ color: "var(--color-accent)" }}
          />
        </div>
      </div>
      <p className="text-[11px] text-[color:var(--color-muted)] leading-snug">{hint}</p>
    </div>
  );
}

function TeamPicker({
  config, setConfig,
}: {
  config: EstimateConfig;
  setConfig: (c: EstimateConfig) => void;
}) {
  const mult = teamMultiplier(config.oficiais, config.ajudantes);
  const speed = teamSpeedFactor(config.oficiais, config.ajudantes);
  const pct = Math.round((speed - 1) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[13px] font-medium">
          Equipe do chantier
          <span className="block text-[10px] text-[color:var(--color-muted)] opacity-70 font-normal">Équipe du chantier</span>
        </p>
        <span className="text-[11px] text-[color:var(--color-muted)] num">
          coef {mult.toFixed(1)} · {speed >= 1 ? `+${pct}%` : `${pct}%`} vs padrão
        </span>
      </div>

      <TeamRow
        label="Oficiais"
        labelFr="Ouvriers qualifiés"
        emoji="👷"
        hint="Pedreiro, pintor, encanador"
        value={config.oficiais}
        min={1} max={4}
        onChange={n => setConfig({ ...config, oficiais: n })}
      />
      <TeamRow
        label="Ajudantes"
        labelFr="Aides / manœuvres"
        emoji="🧑‍🔧"
        hint="Servente, auxiliar (× 0.6 vs oficial)"
        value={config.ajudantes}
        min={0} max={3}
        onChange={n => setConfig({ ...config, ajudantes: n })}
      />

      <p className="text-[10px] text-[color:var(--color-muted)] mt-2 leading-snug">
        Baseline SINAPI = 1 oficial + 1 ajudante (coef 1.6). Uma equipe maior acelera o chantier proporcionalmente.
      </p>
    </div>
  );
}

function TeamRow({
  label, labelFr, emoji, hint, value, min, max, onChange,
}: {
  label: string;
  labelFr: string;
  emoji: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xl w-6 text-center">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
        <p className="text-[10px] text-[color:var(--color-muted)] opacity-70 leading-tight">{labelFr} · {hint}</p>
      </div>
      <div className="flex items-center gap-2 bg-[color:var(--color-bg-2)] rounded-full px-1 py-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-7 h-7 rounded-full bg-white dark:bg-[color:var(--color-bg)] flex items-center justify-center disabled:opacity-30"
          aria-label="Menos"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}>
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="text-[15px] font-semibold num w-5 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-7 h-7 rounded-full bg-white dark:bg-[color:var(--color-bg)] flex items-center justify-center disabled:opacity-30"
          aria-label="Mais"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ConfigSlider({
  label, tip, value, onChange, min, max, step,
}: {
  label: string; tip: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  // Value stocké en 0-1 (ratio), affiché en 0-100 (%)
  const displayValue = Math.round(value * 100);
  const [txt, setTxt] = useState(String(displayValue));

  // Sync input quand value change externally (ex: reset défaut)
  const lastDisplay = useMemo(() => Math.round(value * 100), [value]);
  useEffect(() => { setTxt(String(lastDisplay)); }, [lastDisplay]);

  function commit(raw: string) {
    const n = parseInt(raw.replace(/[^\d]/g, ""));
    if (isNaN(n)) { setTxt(String(displayValue)); return; }
    const clamped = Math.max(Math.round(min * 100), Math.min(Math.round(max * 100), n));
    onChange(clamped / 100);
    setTxt(String(clamped));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-medium">{label}</label>
        <div className="flex items-center gap-1 bg-[color:var(--color-bg-2)] rounded-lg px-2 py-1">
          <input
            type="text"
            inputMode="numeric"
            value={txt}
            onChange={e => setTxt(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-9 text-right text-[14px] font-bold num bg-transparent outline-none"
            style={{ color: "var(--color-accent)" }}
          />
          <span className="text-[13px] font-bold" style={{ color: "var(--color-accent)" }}>%</span>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <p className="text-[11px] text-[color:var(--color-muted)] mt-1 leading-snug">{tip}</p>
    </div>
  );
}

function AddServiceModal({
  existingIds, search, setSearch, onPick, onClose,
}: {
  existingIds: Set<string>;
  search: string;
  setSearch: (s: string) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = SERVICES.filter(s => {
    if (existingIds.has(s.id)) return false;
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col">
        <div className="p-5 flex items-center justify-between border-b border-[color:var(--color-line)]">
          <p className="text-[16px] font-semibold">Adicionar serviço</p>
          <button onClick={onClose} className="text-[color:var(--color-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <input
            type="text"
            placeholder="Buscar serviço…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[color:var(--color-bg-2)] rounded-xl px-4 py-3 text-[15px] outline-none placeholder:text-[color:var(--color-muted)]"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-[color:var(--color-muted)] py-8">Nenhum serviço disponível.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(s => (
                <button key={s.id} onClick={() => onPick(s.id)} className="w-full flex items-center gap-3 p-3 hover:bg-[color:var(--color-bg-2)] rounded-xl text-left transition">
                  <div className="w-9 h-9 rounded-lg bg-[color:var(--color-bg-2)] flex items-center justify-center text-base shrink-0">{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">{s.name.replace(/^[^\s]+\s/, "")}</p>
                    <p className="text-[11px] text-[color:var(--color-muted)] num">R$ {s.min}–{s.max} / {s.unit} · {s.cat}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultSurfaceFor(unit: string): number {
  if (unit === "m²") return 10;
  if (unit.includes("linear")) return 15;
  if (unit === "ponto") return 1;
  if (unit === "unité" || unit === "aparelho" || unit === "porta" || unit === "janela") return 1;
  if (unit === "chantier") return 1;
  return 5;
}
