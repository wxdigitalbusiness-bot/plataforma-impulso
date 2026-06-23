"use client";

import { useCallback, useEffect, useState } from "react";
import { LeadCard, type Lead } from "./lead-card";
import { ConversaPanel } from "./conversa-panel";

type Etapa = {
  etapa: string;
  etapaLabel: string;
};

type Props = {
  clienteId: number;
  etapas: Etapa[];
  initialLeads: Lead[];
};

const CORES_ETAPA: Record<string, { header: string; count: string }> = {
  novo_lead:        { header: "bg-neutral-100 text-neutral-700",   count: "bg-neutral-200 text-neutral-700" },
  nao_classificado: { header: "bg-neutral-100 text-neutral-500",   count: "bg-neutral-200 text-neutral-500" },
  qualificado:      { header: "bg-emerald-50 text-emerald-700",    count: "bg-emerald-100 text-emerald-700" },
  perdido:          { header: "bg-red-50 text-red-600",            count: "bg-red-100 text-red-600" },
  concluido:        { header: "bg-violet-50 text-violet-700",      count: "bg-violet-100 text-violet-700" },
};

function etapaCores(etapa: string) {
  return CORES_ETAPA[etapa] ?? { header: "bg-blue-50 text-blue-700", count: "bg-blue-100 text-blue-700" };
}

type FiltroOrigem = "todos" | "pago" | "organico";

export function KanbanBoard({ clienteId, etapas, initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>("todos");
  const [filtroEtapas, setFiltroEtapas] = useState<Set<string>>(new Set());
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  const selectedLead = leads.find((l) => l.lead_id === selectedId) ?? null;

  // Leads filtrados por origem e data
  const leadsFiltrados = leads.filter((l) => {
    const isPago = !!(l.gclid || l.ad_id || l.ctwa_clid);
    if (filtroOrigem === "pago"     && !isPago) return false;
    if (filtroOrigem === "organico" &&  isPago) return false;
    if (filtroDe && l.data_criacao && l.data_criacao < filtroDe) return false;
    if (filtroAte && l.data_criacao && l.data_criacao > filtroAte + "T23:59:59.999Z") return false;
    return true;
  });

  // Etapas visíveis (todas se nenhuma selecionada)
  const etapasFiltradas = filtroEtapas.size === 0
    ? etapas
    : etapas.filter((e) => filtroEtapas.has(e.etapa));

  function toggleEtapa(etapa: string) {
    setFiltroEtapas((prev) => {
      const next = new Set(prev);
      next.has(etapa) ? next.delete(etapa) : next.add(etapa);
      return next;
    });
  }

  const temFiltro = filtroOrigem !== "todos" || filtroEtapas.size > 0 || filtroDe || filtroAte;

  function limparFiltros() {
    setFiltroOrigem("todos");
    setFiltroEtapas(new Set());
    setFiltroDe("");
    setFiltroAte("");
  }

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/${clienteId}/leads`);
      if (!res.ok) return;
      const data = await res.json() as { leads: Lead[] };
      setLeads(data.leads);
    } catch {
      // ignora erros de rede silenciosamente
    }
  }, [clienteId]);

  // Poll a cada 30s para novos leads e mensagens
  useEffect(() => {
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // Fecha painel com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fecharPainel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function abrirPainel(leadId: string) {
    setSelectedId(leadId);
    setOverlay(true);
  }

  function fecharPainel() {
    setSelectedId(null);
    setOverlay(false);
  }

  function handleFaseChange(leadId: string, _etapa: string, faseLabel: string) {
    setLeads((prev) =>
      prev.map((l) => (l.lead_id === leadId ? { ...l, fase: faseLabel } : l))
    );
  }

  return (
    <>
      {/* ── Barra de filtros ─────────────────────────────────────────────── */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">

        {/* Origem */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {(["todos", "pago", "organico"] as FiltroOrigem[]).map((v) => (
            <button
              key={v}
              onClick={() => setFiltroOrigem(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filtroOrigem === v
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {v === "todos" ? "Todos" : v === "pago" ? "Tráfego pago" : "Orgânico"}
            </button>
          ))}
        </div>

        {/* Etapas */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">Etapas:</span>
          <div className="flex flex-wrap gap-1">
            {etapas.map((e) => {
              const ativo = filtroEtapas.has(e.etapa);
              const cores = etapaCores(e.etapa);
              return (
                <button
                  key={e.etapa}
                  onClick={() => toggleEtapa(e.etapa)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    ativo ? cores.header + " ring-1 ring-inset ring-current/20" : "bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  {e.etapaLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Datas */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">De:</span>
          <input
            type="date"
            value={filtroDe}
            onChange={(e) => setFiltroDe(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-400"
          />
          <span className="text-xs text-neutral-400">até</span>
          <input
            type="date"
            value={filtroAte}
            onChange={(e) => setFiltroAte(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-400"
          />
        </div>

        {/* Limpar */}
        {temFiltro && (
          <button
            onClick={limparFiltros}
            className="text-xs text-neutral-400 underline hover:text-neutral-700"
          >
            Limpar filtros
          </button>
        )}

        {/* Contagem filtrada */}
        {temFiltro && (
          <span className="ml-auto text-xs text-neutral-400">
            {leadsFiltrados.length} de {leads.length} leads
          </span>
        )}
      </div>

      {/* ── Colunas do Kanban ─────────────────────────────────────────────── */}
      <div className="flex h-full gap-3 overflow-x-auto pb-4">
        {etapasFiltradas.map((etapa) => {
          const leadsEtapa = leadsFiltrados.filter((l) => l.fase === etapa.etapaLabel);
          const cores = etapaCores(etapa.etapa);

          return (
            <div key={etapa.etapa} className="flex w-64 shrink-0 flex-col gap-2">
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${cores.header}`}>
                <span className="text-xs font-semibold">{etapa.etapaLabel}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${cores.count}`}>
                  {leadsEtapa.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
                {leadsEtapa.map((lead) => (
                  <LeadCard
                    key={lead.lead_id}
                    lead={lead}
                    isSelected={lead.lead_id === selectedId}
                    onClick={() => abrirPainel(lead.lead_id)}
                  />
                ))}
                {leadsEtapa.length === 0 && (
                  <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">
                    Nenhum lead
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
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
            onClick={fecharPainel}
          />
          <ConversaPanel
            clienteId={clienteId}
            lead={selectedLead}
            etapas={etapas}
            onClose={fecharPainel}
            onFaseChange={handleFaseChange}
          />
        </>
      )}
    </>
  );
}
