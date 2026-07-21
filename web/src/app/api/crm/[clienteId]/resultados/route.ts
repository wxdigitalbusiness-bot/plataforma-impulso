import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string };

type LeadResultado = {
  lead_id: string;
  lead_nome: string | null;
  lead_whatsapp: string | null;
  fase: string | null;
  total_negociado: number;
  ultima_negociacao: Date | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true },
  });
  if (!cliente?.n8nClientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const clientKey = cliente.n8nClientKey;

  const rows = await db.$queryRaw<LeadResultado[]>`
    SELECT
      fl.lead_id,
      fl.lead_nome,
      fl.lead_whatsapp,
      fl.fase,
      COALESCE(SUM(hn.valor), 0)::float AS total_negociado,
      MAX(hn.registrado_em)             AS ultima_negociacao
    FROM fb_leads fl
    LEFT JOIN crm_historico_negociacao hn
      ON hn.lead_id = fl.lead_id AND lower(hn.client_key) = lower(${clientKey})
    WHERE lower(fl.client_key) = lower(${clientKey})
    GROUP BY fl.lead_id, fl.lead_nome, fl.lead_whatsapp, fl.fase
    HAVING COALESCE(SUM(hn.valor), 0) > 0
    ORDER BY total_negociado DESC
  `;

  const totalCliente = rows.reduce((s, r) => s + r.total_negociado, 0);

  return NextResponse.json({ rows, totalCliente });
}
