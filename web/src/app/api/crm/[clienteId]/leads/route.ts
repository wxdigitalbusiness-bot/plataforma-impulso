// Lista os leads de um cliente agrupados por fase, com a última mensagem.
// Alimenta o Kanban do CRM.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      AND (NOT ${somentePago} OR
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
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true },
  });
  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const body = await req.json() as { nome?: string; whatsapp?: string; primeiraEtapaLabel?: string };
  const nome  = body.nome?.trim();
  const wpp   = body.whatsapp?.replace(/\D/g, "");
  const fase  = body.primeiraEtapaLabel?.trim();

  if (!nome || !wpp || !fase) {
    return NextResponse.json({ error: "nome, whatsapp e primeiraEtapaLabel são obrigatórios" }, { status: 400 });
  }

  // lead_id = telefone; data_criacao é coluna text no banco
  const existing = await db.$queryRaw<{ lead_id: string }[]>`
    SELECT lead_id FROM fb_leads
    WHERE lead_id = ${wpp} AND lower(client_key) = lower(${cliente.n8nClientKey})
    LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Já existe um lead com este WhatsApp." }, { status: 409 });
  }

  await db.$executeRaw`
    INSERT INTO fb_leads (lead_id, lead_nome, lead_whatsapp, fase, client_key, source_app, webhook_origem, data_criacao, reentradas)
    VALUES (
      ${wpp},
      ${nome},
      ${wpp},
      ${fase},
      ${cliente.n8nClientKey},
      'plataforma',
      'plataforma',
      to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
      0
    )
  `;

  return NextResponse.json({ ok: true }, { status: 201 });
}
