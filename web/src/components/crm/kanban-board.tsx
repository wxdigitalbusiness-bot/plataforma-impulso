"use client";

import { useCallback, useEffect, useState } from "react";
import { LeadCard } from "./lead-card";
import { ConversaPanel } from "./conversa-panel";

type Lead = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  source_app: string | null;
  ultima_msg: string | null;
  ultima_msg_tipo: string | null;
  ultima_msg_em: string | null;
};

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

export function KanbanBoard({ clienteId, etapas, initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);

  const selectedLead = leads.find((l) => l.lead_id === selectedId) ?? null;

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
      {/* Kanban columns */}
      <div className="flex h-full gap-3 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const leadsEtapa = leads.filter((l) => l.fase === etapa.etapaLabel);
          const cores = etapaCores(etapa.etapa);

          return (
            <div key={etapa.etapa} className="flex w-64 shrink-0 flex-col gap-2">
              {/* Cabeçalho da coluna */}
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${cores.header}`}>
                <span className="text-xs font-semibold">{etapa.etapaLabel}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${cores.count}`}>
                  {leadsEtapa.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
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
