import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { ClienteSeletor } from "@/components/crm/cliente-seletor";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cliente?: string }> };

type LeadRow = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  source_app: string | null;
  ad_id: string | null;
  ctwa_clid: string | null;
  gclid: string | null;
  utm_source: string | null;
  webhook_origem: string | null;
  data_criacao: Date;
  primeira_msg_em: Date | null;
  reentradas: number;
  ad_title: string | null;
  ad_body: string | null;
  ad_media_url: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  ultima_msg: string | null;
  ultima_msg_tipo: string | null;
  ultima_msg_em: Date | null;
};

export default async function CrmLeadsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const crmClientes = await db.cliente.findMany({
    where: { ativo: true, crmWebhooks: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (crmClientes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        Nenhum cliente com CRM configurado.
      </div>
    );
  }

  const clienteId = Number(sp.cliente);
  const clienteValido = crmClientes.some((c) => c.id === clienteId);

  if (!sp.cliente || !clienteValido) {
    redirect(`/crm/leads?cliente=${crmClientes[0].id}`);
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      n8nClientKey: true,
      evolutionInstance: true,
      crmWebhooks: {
        select: { etapa: true, etapaLabel: true },
        orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
      },
    },
  });

  if (!cliente) redirect(`/crm/leads?cliente=${crmClientes[0].id}`);

  const etapas = cliente.crmWebhooks.map((w) => ({
    etapa: w.etapa,
    etapaLabel: w.etapaLabel,
  }));

  const leadsRaw: LeadRow[] = cliente.n8nClientKey
    ? await db.$queryRaw<LeadRow[]>`
        SELECT
          fl.lead_id,
          fl.lead_nome,
          fl.lead_whatsapp,
          fl.fase,
          fl.source_app,
          fl.ad_id,
          fl.ctwa_clid,
          fl.gclid,
          fl.utm_source,
          fl.webhook_origem,
          fl.data_criacao,
          fl.reentradas,
          fl.ad_title,
          fl.ad_body,
          fl.ad_media_url,
          fl.ad_name,
          fl.adset_name,
          fl.campaign_name,
          fm.recebida_em AS primeira_msg_em,
          m.conteudo     AS ultima_msg,
          m.tipo         AS ultima_msg_tipo,
          m.recebida_em  AS ultima_msg_em
        FROM fb_leads fl
        LEFT JOIN LATERAL (
          SELECT recebida_em FROM crm_mensagens
          WHERE lead_id = fl.lead_id AND client_key = fl.client_key
          ORDER BY recebida_em ASC LIMIT 1
        ) fm ON TRUE
        LEFT JOIN LATERAL (
          SELECT conteudo, tipo, recebida_em FROM crm_mensagens
          WHERE lead_id = fl.lead_id AND client_key = fl.client_key
          ORDER BY recebida_em DESC LIMIT 1
        ) m ON TRUE
        WHERE lower(fl.client_key) = lower(${cliente.n8nClientKey})
        ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
      `
    : [];

  const leads = leadsRaw.map((l) => ({
    ...l,
    data_criacao: l.data_criacao ? new Date(l.data_criacao).toISOString() : null,
    primeira_msg_em: l.primeira_msg_em ? l.primeira_msg_em.toISOString() : null,
    ultima_msg_em: l.ultima_msg_em ? l.ultima_msg_em.toISOString() : null,
  }));

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <ClienteSeletor
            clientes={crmClientes}
            clienteAtualId={clienteId}
            basePath="/crm/leads"
          />
          <span className="text-xs text-neutral-400">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} no funil
          </span>
        </div>
      </header>

      {etapas.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
          Nenhuma etapa CRM configurada para este cliente.
        </div>
      ) : (
        <div className="flex-1 overflow-hidden px-6 py-4">
          <KanbanBoard
            key={clienteId}
            clienteId={clienteId}
            etapas={etapas}
            initialLeads={leads}
          />
        </div>
      )}
    </div>
  );
}
