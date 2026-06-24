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
  data_criacao: Date;
  ultima_msg: string | null;
  ultima_msg_tipo: string | null;
  ultima_msg_em: Date | null;
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
    select: { n8nClientKey: true },
  });

  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const clientKey = cliente.n8nClientKey;

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
      fl.data_criacao,
      m.conteudo   AS ultima_msg,
      m.tipo       AS ultima_msg_tipo,
      m.recebida_em AS ultima_msg_em
    FROM fb_leads fl
    LEFT JOIN LATERAL (
      SELECT conteudo, tipo, recebida_em
      FROM crm_mensagens
      WHERE lead_id = fl.lead_id
        AND client_key = fl.client_key
      ORDER BY recebida_em DESC
      LIMIT 1
    ) m ON TRUE
    WHERE lower(fl.client_key) = lower(${clientKey})
    ORDER BY COALESCE(m.recebida_em, fl.data_criacao::timestamptz) DESC
  `;

  return NextResponse.json({ leads, clientKey });
}
