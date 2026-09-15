// Lista os leads de um cliente agrupados por fase, com a última mensagem.
// Alimenta o Kanban do CRM. POST cria um lead manualmente (contato fora do
// WhatsApp: telefone, presencial, indicação).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { upsertCrmLead } from "@/lib/crm-lead";

type LeadRow = {
  lead_id: string;
  lead_nome: string;
  lead_whatsapp: string;
  fase: string;
  ad_id: string | null;
  ctwa_clid: string | null;
  gclid: string | null;
  source_app: string | null;
  utm_source: string | null;
  webhook_origem: string | null;
  data_criacao: Date;
  primeira_msg_em: Date | null;
  reentradas: number;
  nova_mensagem: boolean;
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
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true, crmSomentePago: true },
  });

  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const clientKey = cliente.n8nClientKey;
  const somentePago = cliente.crmSomentePago;

  const leads = await db.$queryRaw<LeadRow[]>`
    SELECT
      fl.lead_id,
      fl.lead_nome,
      fl.lead_whatsapp,
      fl.fase,
      fl.ad_id,
      fl.ctwa_clid,
      fl.gclid,
      fl.source_app,
      fl.utm_source,
      fl.webhook_origem,
      fl.data_criacao,
      fl.reentradas,
      fl.nova_mensagem,
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
      fl.capi_enviado_em
    FROM fb_leads fl
    LEFT JOIN LATERAL (
      SELECT recebida_em
      FROM crm_mensagens
      WHERE lead_id = fl.lead_id
        AND client_key = fl.client_key
      ORDER BY recebida_em ASC
      LIMIT 1
    ) fm ON TRUE
    LEFT JOIN LATERAL (
      SELECT conteudo, tipo, recebida_em
      FROM crm_mensagens
      WHERE lead_id = fl.lead_id
        AND client_key = fl.client_key
      ORDER BY recebida_em DESC
      LIMIT 1
    ) m ON TRUE
    WHERE lower(fl.client_key) = lower(${clientKey})
      AND NOT fl.eh_colaborador
      AND (NOT ${somentePago} OR fl.criado_manual OR
           fl.ad_id IS NOT NULL OR fl.ctwa_clid IS NOT NULL OR
           fl.gclid IS NOT NULL OR fl.wbraid IS NOT NULL OR fl.gbraid IS NOT NULL)
    ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
  `;

  return NextResponse.json({ leads, clientKey });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { nome: true, n8nClientKey: true },
  });
  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente sem CRM configurado." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { nome?: string; whatsapp?: string; observacao?: string } | null;
  const nome = body?.nome?.trim();
  const whatsappDigits = (body?.whatsapp ?? "").replace(/\D/g, "");
  if (!nome || !whatsappDigits) {
    return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios." }, { status: 400 });
  }
  const phone = whatsappDigits.startsWith("55") ? whatsappDigits : `55${whatsappDigits}`;

  const { leadId, isNew } = await upsertCrmLead({
    phone,
    clientKey: cliente.n8nClientKey,
    clientName: cliente.nome,
    pushName: nome,
    adId: null,
    ctwaClid: null,
    sourceApp: null,
    adTitle: null,
    adBody: null,
    adMediaUrl: null,
    recebidaEm: new Date(),
    criadoManual: true,
  });

  // Só grava a observação na criação — se o lead já existia (mesmo WhatsApp),
  // não sobrescreve anotações que a agência já tenha feito nele.
  const observacao = body?.observacao?.trim();
  if (isNew && observacao) {
    await db.$executeRaw`
      UPDATE fb_leads SET observacoes = ${observacao}
      WHERE lead_id = ${leadId} AND lower(client_key) = lower(${cliente.n8nClientKey})
    `;
  }

  return NextResponse.json({ ok: true, leadId, isNew });
}
