"use client";

import {
  type Lead, OrigemBadge, WebhookBadge, tempoRelativo, previewMsg, dataRelativa,
} from "./lead-card";
import { etapaCores, type Etapa } from "./kanban-board";

type Props = {
  leads: Lead[];
  etapas: Etapa[];
  selectedId: string | null;
  onSelect: (leadId: string) => void;
};

export function LeadList({ leads, etapas, selectedId, onSelect }: Props) {
  if (leads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-400">
        Nenhum lead encontrado.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Lead</th>
            <th className="px-4 py-2.5 font-medium">Etapa</th>
            <th className="px-4 py-2.5 font-medium">Origem</th>
            <th className="px-4 py-2.5 font-medium">Última mensagem</th>
            <th className="px-4 py-2.5 font-medium">Entrou em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {leads.map((lead) => {
            const etapa = etapas.find((e) => e.etapaLabel === lead.fase);
            const cores = etapaCores(etapa?.etapa ?? "");
            const preview = previewMsg(lead.ultima_msg_tipo, lead.ultima_msg);
            const tempo = tempoRelativo(lead.ultima_msg_em);

            return (
              <tr
                key={lead.lead_id}
                onClick={() => onSelect(lead.lead_id)}
                className={`cursor-pointer transition-colors ${
                  selectedId === lead.lead_id ? "bg-violet-50" : "hover:bg-neutral-50"
                }`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {lead.nova_mensagem && (
                      <span title="Nova mensagem desde a última classificação" className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{lead.lead_nome || "Sem nome"}</p>
                      <p className="text-[11px] text-neutral-400">{lead.lead_whatsapp}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cores.count}`}>
                    {lead.fase}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <WebhookBadge origem={lead.webhook_origem} />
                    <OrigemBadge lead={lead} />
                  </div>
                </td>
                <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{preview ?? "—"}</span>
                    {tempo && <span className="shrink-0 text-[11px] text-neutral-400">{tempo}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">
                  {dataRelativa(lead.data_criacao)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
