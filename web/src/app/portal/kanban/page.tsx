import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { KanbanPortalClient } from "./_kanban-client";
import type { Lead } from "@/components/crm/lead-card";

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

export default async function PortalKanbanPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: {
      n8nClientKey: true,
      crmSomentePago: true,
      crmWebhooks: {
        select: { etapa: true, etapaLabel: true },
        orderBy: [{ ehExtra: "asc" }, { criadoEm: "asc" }],
      },
    },
  });

  if (!cliente?.n8nClientKey) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        CRM não configurado para este cliente.
      </div>
    );
  }

  const etapas = cliente.crmWebhooks.map((w) => ({
    etapa: w.etapa,
    etapaLabel: w.etapaLabel,
  }));

  const leadsRaw: LeadRow[] = await db.$queryRaw<LeadRow[]>`
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
    ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
  `;

  const leads: Lead[] = leadsRaw.map((l) => ({
    ...l,
    data_criacao:    l.data_criacao    ? new Date(l.data_criacao).toISOString() : null,
    primeira_msg_em: l.primeira_msg_em ? l.primeira_msg_em.toISOString()        : null,
    ultima_msg_em:   l.ultima_msg_em   ? l.ultima_msg_em.toISOString()          : null,
    capi_enviado_em:  l.capi_enviado_em  ? l.capi_enviado_em.toISOString()  : null,
    gconv_enviado_em: l.gconv_enviado_em ? l.gconv_enviado_em.toISOString() : null,
  }));

  return (
    <KanbanPortalClient
      clienteId={session.clienteId}
      etapas={etapas}
      initialLeads={leads}
      role={session.role}
    />
  );
}
