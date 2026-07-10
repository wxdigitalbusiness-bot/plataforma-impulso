import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { KanbanBoard } from "@/components/crm/kanban-board";

export const dynamic = "force-dynamic";

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
  capi_status: string | null;
  capi_enviado_em: Date | null;
  gconv_status: string | null;
  gconv_enviado_em: Date | null;
};

export default async function PortalLeadsPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const clienteId = session.clienteId;

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: {
      n8nClientKey: true,
      crmSomentePago: true,
      crmWebhooks: {
        select: { etapa: true, etapaLabel: true },
        orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
      },
    },
  });

  if (!cliente) redirect("/portal/login");

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
          m.conteudo        AS ultima_msg,
          m.tipo            AS ultima_msg_tipo,
          m.recebida_em     AS ultima_msg_em,
          fl.capi_status,
          fl.capi_enviado_em,
          fl.gconv_status,
          fl.gconv_enviado_em
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
          AND (NOT ${cliente.crmSomentePago} OR
               fl.ad_id IS NOT NULL OR fl.ctwa_clid IS NOT NULL OR
               fl.gclid IS NOT NULL OR fl.wbraid IS NOT NULL OR fl.gbraid IS NOT NULL)
        ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
      `
    : [];

  const leads = leadsRaw.map((l) => ({
    ...l,
    data_criacao:     l.data_criacao     ? new Date(l.data_criacao).toISOString()     : null,
    primeira_msg_em:  l.primeira_msg_em  ? l.primeira_msg_em.toISOString()            : null,
    ultima_msg_em:    l.ultima_msg_em    ? l.ultima_msg_em.toISOString()              : null,
    capi_enviado_em:  l.capi_enviado_em  ? l.capi_enviado_em.toISOString()            : null,
    gconv_enviado_em: l.gconv_enviado_em ? l.gconv_enviado_em.toISOString()           : null,
  }));

  if (etapas.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
        Nenhuma etapa de CRM configurada para esta conta.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Leads</h2>
        <span className="text-xs text-neutral-400">
          {leads.length} {leads.length === 1 ? "lead" : "leads"} no funil
        </span>
      </div>

      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <div className="min-w-max px-4 sm:px-6">
          <KanbanBoard
            clienteId={clienteId}
            etapas={etapas}
            initialLeads={leads}
          />
        </div>
      </div>
    </div>
  );
}
