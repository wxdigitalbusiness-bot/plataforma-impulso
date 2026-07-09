"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { NovoLeadModal } from "./_novo-lead-modal";
import type { Lead } from "@/components/crm/lead-card";

type Etapa = { etapa: string; etapaLabel: string };

type Props = {
  clienteId: number;
  etapas: Etapa[];
  initialLeads: Lead[];
  role: string;
};

export function KanbanPortalClient({ clienteId, etapas, initialLeads, role }: Props) {
  const [showModal, setShowModal] = useState(false);
  const podeEditar = role !== "visualizador";
  const primeiraEtapa = etapas[0]?.etapaLabel ?? "Novo Lead";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <span className="text-sm font-medium text-neutral-700">
          {initialLeads.length} {initialLeads.length === 1 ? "lead" : "leads"} no funil
        </span>
        {podeEditar && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            + Novo Lead
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        <KanbanBoard
          clienteId={clienteId}
          etapas={etapas}
          initialLeads={initialLeads}
        />
      </div>

      {showModal && (
        <NovoLeadModal
          clienteId={clienteId}
          primeiraEtapaLabel={primeiraEtapa}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
