"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeadCard, type Lead } from "./lead-card";
import { ConversaPanel } from "./conversa-panel";

// ── Types ──────────────────────────────────────────────────────────────────
type Etapa = { etapa: string; etapaLabel: string };
type Props = { clienteId: number; etapas: Etapa[]; initialLeads: Lead[] };
type FiltroOrigem = "todos" | "pago" | "organico";
type DateRange = { de: string; ate: string; label: string } | null;

// ── Cores por etapa ────────────────────────────────────────────────────────
const CORES_ETAPA: Record<string, { header: string; count: string }> = {
  novo_lead:        { header: "bg-neutral-100 text-neutral-700", count: "bg-neutral-200 text-neutral-700" },
  nao_classificado: { header: "bg-neutral-100 text-neutral-500", count: "bg-neutral-200 text-neutral-500" },
  qualificado:      { header: "bg-emerald-50 text-emerald-700",  count: "bg-emerald-100 text-emerald-700" },
  perdido:          { header: "bg-red-50 text-red-600",          count: "bg-red-100 text-red-600" },
  concluido:        { header: "bg-violet-50 text-violet-700",    count: "bg-violet-100 text-violet-700" },
};
function etapaCores(e: string) {
  return CORES_ETAPA[e] ?? { header: "bg-blue-50 text-blue-700", count: "bg-blue-100 text-blue-700" };
}

// ── Helpers de data ────────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getPresetRange(preset: string): DateRange {
  const now = new Date();
  const today = toISO(now);
  switch (preset) {
    case "hoje":    return { de: today, ate: today, label: "Hoje" };
    case "ontem": {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      const iso = toISO(d);
      return { de: iso, ate: iso, label: "Ontem" };
    }
    case "7dias": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { de: toISO(d), ate: today, label: "7 Dias" };
    }
    case "estemes": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { de: toISO(d), ate: today, label: "Este mês" };
    }
    case "mesanterior": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { de: toISO(start), ate: toISO(end), label: "Mês anterior" };
    }
    default: return null;
  }
}

// ── Calendário ─────────────────────────────────────────────────────────────
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS_SEMANA = ["dom","seg","ter","qua","qui","sex","sáb"];

function CalendarPicker({
  value,
  onChange,
  onClose,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  onClose: () => void;
}) {
  const [mes, setMes] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  function navMes(delta: number) {
    setMes(({ year, month }) => {
      let m = month + delta;
      let y = year;
      if (m < 0)  { m = 11; y--; }
      if (m > 11) { m = 0;  y++; }
      return { year: y, month: m };
    });
  }

  const primeiroDia = new Date(mes.year, mes.month, 1).getDay();
  const diasNoMes   = new Date(mes.year, mes.month + 1, 0).getDate();
  const today       = toISO(new Date());

  function dayISO(d: number) {
    return `${mes.year}-${String(mes.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function selectDay(d: number) {
    const iso = dayISO(d);
    onChange({ de: iso, ate: iso, label: iso });
    onClose();
  }

  const cells: (number | null)[] = [
    ...Array<null>(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-60 p-3">
      {/* Navegação de mês */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navMes(-1)}
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-neutral-800">
          {MESES[mes.month]} de {mes.year}
        </span>
        <button
          onClick={() => navMes(1)}
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          ›
        </button>
      </div>

      {/* Cabeçalho da semana */}
      <div className="mb-1 grid grid-cols-7">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="text-center text-[10px] font-medium text-neutral-400">{d}</span>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) =>
          d === null ? (
            <span key={i} className="h-8" />
          ) : (
            <button
              key={i}
              onClick={() => selectDay(d)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                value && (dayISO(d) === value.de || dayISO(d) === value.ate)
                  ? "bg-neutral-900 text-white font-semibold"
                  : value && dayISO(d) > value.de && dayISO(d) < value.ate
                  ? "bg-neutral-100 text-neutral-700"
                  : dayISO(d) === today
                  ? "text-blue-600 font-semibold hover:bg-neutral-100"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {d}
            </button>
          )
        )}
      </div>

      <div className="my-2 border-t border-neutral-100" />

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 gap-0.5">
        {(["hoje","ontem","7dias","estemes","mesanterior"] as const).map((key) => {
          const labels: Record<string, string> = {
            hoje:"Hoje", ontem:"Ontem", "7dias":"7 Dias",
            estemes:"Este mês", mesanterior:"Mês anterior",
          };
          return (
            <button
              key={key}
              onClick={() => { onChange(getPresetRange(key)); onClose(); }}
              className="rounded-lg px-2 py-1.5 text-left text-xs text-neutral-600 hover:bg-neutral-100"
            >
              {labels[key]}
            </button>
          );
        })}
        <button
          onClick={() => { onChange(null); onClose(); }}
          className="rounded-lg px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
        >
          Remover Data
        </button>
      </div>
    </div>
  );
}

// ── Wrapper genérico de dropdown ───────────────────────────────────────────
function FilterDropdown({
  label,
  sublabel,
  active,
  open,
  onToggle,
  children,
  alignRight,
}: {
  label: string;
  sublabel: string;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  alignRight?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={`flex min-w-[110px] flex-col items-start rounded-lg border px-3 py-1.5 transition-colors ${
          active || open
            ? "border-neutral-400 bg-neutral-50"
            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
        }`}
      >
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "text-neutral-600" : "text-neutral-400"}`}>
          {label}
        </span>
        <span className={`text-xs ${active ? "font-medium text-neutral-900" : "text-neutral-500"}`}>
          {sublabel}
        </span>
      </button>

      {open && (
        <div className={`absolute top-full z-40 mt-1.5 rounded-xl border border-neutral-200 bg-white shadow-lg ${alignRight ? "right-0" : "left-0"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Dropdown de Etapas ─────────────────────────────────────────────────────
function EtapaDropdown({
  etapas, selected, onToggle, onClear, open, onOpenToggle,
}: {
  etapas: Etapa[];
  selected: Set<string>;
  onToggle: (e: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenToggle: () => void;
}) {
  const sublabel =
    selected.size === 0 ? "Todas as etapas"
    : selected.size === 1 ? (etapas.find((e) => selected.has(e.etapa))?.etapaLabel ?? "1 etapa")
    : `${selected.size} etapas`;

  return (
    <FilterDropdown
      label="Etapa"
      sublabel={sublabel}
      active={selected.size > 0}
      open={open}
      onToggle={onOpenToggle}
    >
      <div className="min-w-[190px] p-2">
        {etapas.map((e) => {
          const ativo = selected.has(e.etapa);
          return (
            <button
              key={e.etapa}
              onClick={() => onToggle(e.etapa)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                ativo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
              }`}>
                {ativo && "✓"}
              </span>
              {e.etapaLabel}
            </button>
          );
        })}
        {selected.size > 0 && (
          <>
            <div className="my-1 border-t border-neutral-100" />
            <button
              onClick={onClear}
              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-neutral-400 hover:text-neutral-700"
            >
              Limpar seleção
            </button>
          </>
        )}
      </div>
    </FilterDropdown>
  );
}

// ── Dropdown de Data ───────────────────────────────────────────────────────
function DataDropdown({
  value, onChange, open, onOpenToggle,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  open: boolean;
  onOpenToggle: () => void;
}) {
  const sublabel = value
    ? value.de === value.ate ? value.label || value.de : `${value.de} – ${value.ate}`
    : "Selecionar data";

  return (
    <FilterDropdown
      label="Data"
      sublabel={sublabel}
      active={!!value}
      open={open}
      onToggle={onOpenToggle}
    >
      <CalendarPicker value={value} onChange={onChange} onClose={onOpenToggle} />
    </FilterDropdown>
  );
}

// ── Dropdown Mais Filtros ──────────────────────────────────────────────────
function MaisFiltrosDropdown({
  origem, onOrigemChange, open, onOpenToggle,
}: {
  origem: FiltroOrigem;
  onOrigemChange: (v: FiltroOrigem) => void;
  open: boolean;
  onOpenToggle: () => void;
}) {
  const sublabel =
    origem === "todos" ? "Mais filtros"
    : origem === "pago" ? "Tráfego pago"
    : "Orgânico";

  return (
    <FilterDropdown
      label="Outros"
      sublabel={sublabel}
      active={origem !== "todos"}
      open={open}
      onToggle={onOpenToggle}
    >
      <div className="min-w-[180px] p-2">
        <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          Origem
        </p>
        {([ ["todos","Todos"], ["pago","Tráfego pago"], ["organico","Orgânico"] ] as [FiltroOrigem, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { onOrigemChange(v); onOpenToggle(); }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
              origem === v
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </FilterDropdown>
  );
}

// ── KanbanBoard ────────────────────────────────────────────────────────────
export function KanbanBoard({ clienteId, etapas, initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);

  // ── Drag & drop ────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overEtapa, setOverEtapa]   = useState<string | null>(null);

  async function handleDrop(etapa: Etapa) {
    if (!draggingId) return;
    const lead = leads.find((l) => l.lead_id === draggingId);
    setDraggingId(null);
    setOverEtapa(null);
    if (!lead || lead.fase === etapa.etapaLabel) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => l.lead_id === draggingId ? { ...l, fase: etapa.etapaLabel } : l)
    );

    try {
      await fetch(`/api/crm/${clienteId}/leads/${draggingId}/fase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fase: etapa.etapa, faseLabel: etapa.etapaLabel }),
      });
    } catch {
      await fetchLeads(); // reverte em caso de erro
    }
  }

  // Filtros
  const [filtroEtapas, setFiltroEtapas]   = useState<Set<string>>(new Set());
  const [filtroData, setFiltroData]        = useState<DateRange>(null);
  const [filtroOrigem, setFiltroOrigem]    = useState<FiltroOrigem>("todos");
  const [busca, setBusca]                  = useState("");

  // Qual dropdown está aberto
  const [dropdownAberto, setDropdownAberto] = useState<"etapa" | "data" | "mais" | null>(null);

  function toggleDropdown(d: "etapa" | "data" | "mais") {
    setDropdownAberto((prev) => (prev === d ? null : d));
  }

  const selectedLead = leads.find((l) => l.lead_id === selectedId) ?? null;

  // ── Filtragem client-side ──────────────────────────────────────────────
  const leadsFiltrados = leads.filter((l) => {
    const isPago = !!(l.gclid || l.ad_id || l.ctwa_clid);
    if (filtroOrigem === "pago"     && !isPago) return false;
    if (filtroOrigem === "organico" &&  isPago) return false;

    if (filtroData && l.data_criacao) {
      if (l.data_criacao.slice(0, 10) < filtroData.de) return false;
      if (l.data_criacao.slice(0, 10) > filtroData.ate) return false;
    }
    if (filtroData && !l.data_criacao) return false;

    if (busca) {
      const q = busca.toLowerCase();
      const nome = l.lead_nome?.toLowerCase() ?? "";
      const fone = l.lead_whatsapp?.toLowerCase() ?? "";
      if (!nome.includes(q) && !fone.includes(q)) return false;
    }

    return true;
  });

  const etapasFiltradas = filtroEtapas.size === 0
    ? etapas
    : etapas.filter((e) => filtroEtapas.has(e.etapa));

  const temFiltro = filtroEtapas.size > 0 || !!filtroData || filtroOrigem !== "todos" || !!busca;

  function limparFiltros() {
    setFiltroEtapas(new Set());
    setFiltroData(null);
    setFiltroOrigem("todos");
    setBusca("");
  }

  // ── Polling ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads`);
      if (!res.ok) return;
      const data = await res.json() as { leads: Lead[] };
      setLeads(data.leads);
    } catch { /* silencioso */ }
  }, [clienteId]);

  useEffect(() => {
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dropdownAberto) { setDropdownAberto(null); return; }
        fecharPainel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dropdownAberto]);

  function abrirPainel(leadId: string) { setSelectedId(leadId); setOverlay(true); }
  function fecharPainel() { setSelectedId(null); setOverlay(false); }

  function handleFaseChange(leadId: string, _etapa: string, faseLabel: string) {
    setLeads((prev) => prev.map((l) => l.lead_id === leadId ? { ...l, fase: faseLabel } : l));
  }

  function handleDelete(leadId: string) {
    setLeads((prev) => prev.filter((l) => l.lead_id !== leadId));
    fecharPainel();
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Barra de filtros ──────────────────────────────────────────── */}
      <div className="mb-3 flex shrink-0 items-center gap-2">

        {/* Etapa */}
        <EtapaDropdown
          etapas={etapas}
          selected={filtroEtapas}
          onToggle={(e) =>
            setFiltroEtapas((prev) => {
              const next = new Set(prev);
              next.has(e) ? next.delete(e) : next.add(e);
              return next;
            })
          }
          onClear={() => setFiltroEtapas(new Set())}
          open={dropdownAberto === "etapa"}
          onOpenToggle={() => toggleDropdown("etapa")}
        />

        {/* Data */}
        <DataDropdown
          value={filtroData}
          onChange={setFiltroData}
          open={dropdownAberto === "data"}
          onOpenToggle={() => toggleDropdown("data")}
        />

        {/* Mais filtros */}
        <MaisFiltrosDropdown
          origem={filtroOrigem}
          onOrigemChange={setFiltroOrigem}
          open={dropdownAberto === "mais"}
          onOpenToggle={() => toggleDropdown("mais")}
        />

        {/* Limpar filtros */}
        {temFiltro && (
          <button
            onClick={limparFiltros}
            className="text-xs text-neutral-400 hover:text-neutral-700 underline"
          >
            Limpar
          </button>
        )}

        {/* Espaço + contagem */}
        {temFiltro && (
          <span className="text-xs text-neutral-400">
            {leadsFiltrados.length}/{leads.length} leads
          </span>
        )}

        {/* Busca — lado direito */}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 focus-within:border-neutral-400">
          <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1111 17a6 6 0 016-6z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-36 bg-transparent text-xs text-neutral-700 outline-none placeholder:text-neutral-400"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-neutral-400 hover:text-neutral-600">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Colunas do Kanban ──────────────────────────────────────────── */}
      <div className="flex h-full gap-3 overflow-x-auto pb-4">
        {etapasFiltradas.map((etapa) => {
          const leadsEtapa = leadsFiltrados.filter((l) => l.fase === etapa.etapaLabel);
          const cores = etapaCores(etapa.etapa);
          const isOver = overEtapa === etapa.etapa && !!draggingId;

          return (
            <div
              key={etapa.etapa}
              className="flex w-64 shrink-0 flex-col gap-2"
              onDragOver={(e) => { e.preventDefault(); setOverEtapa(etapa.etapa); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverEtapa(null);
              }}
              onDrop={(e) => { e.preventDefault(); handleDrop(etapa); }}
            >
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                isOver ? "ring-2 ring-violet-300 " + cores.header : cores.header
              }`}>
                <span className="text-xs font-semibold">{etapa.etapaLabel}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${cores.count}`}>
                  {leadsEtapa.length}
                </span>
              </div>

              <div
                className={`flex flex-col gap-2 overflow-y-auto rounded-xl transition-colors ${
                  isOver ? "bg-violet-50/60" : ""
                }`}
                style={{ maxHeight: "calc(100vh - 260px)" }}
              >
                {leadsEtapa.map((lead) => (
                  <div
                    key={lead.lead_id}
                    draggable
                    onDragStart={() => setDraggingId(lead.lead_id)}
                    onDragEnd={() => { setDraggingId(null); setOverEtapa(null); }}
                    className={`cursor-grab active:cursor-grabbing transition-opacity ${
                      draggingId === lead.lead_id ? "opacity-40" : ""
                    }`}
                  >
                    <LeadCard
                      lead={lead}
                      isSelected={lead.lead_id === selectedId}
                      onClick={() => abrirPainel(lead.lead_id)}
                    />
                  </div>
                ))}
                {leadsEtapa.length === 0 && (
                  <p className={`rounded-xl border border-dashed px-3 py-6 text-center text-xs transition-colors ${
                    isOver ? "border-violet-300 text-violet-400" : "border-neutral-200 text-neutral-400"
                  }`}>
                    {isOver ? "Soltar aqui" : "Nenhum lead"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overlay + painel de conversa */}
      {overlay && selectedLead && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={fecharPainel} />
          <ConversaPanel
            clienteId={clienteId}
            lead={selectedLead}
            etapas={etapas}
            onClose={fecharPainel}
            onFaseChange={handleFaseChange}
            onDelete={handleDelete}
          />
        </>
      )}
    </>
  );
}
