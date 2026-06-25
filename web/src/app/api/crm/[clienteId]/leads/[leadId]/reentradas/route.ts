import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

type ReentradaRow = {
  id: bigint;
  fase_anterior: string;
  reentrada_em: Date;
  ad_id: string | null;
  ctwa_clid: string | null;
  source_app: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true },
  });

  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const rows = await db.$queryRaw<ReentradaRow[]>`
    SELECT id, fase_anterior, reentrada_em, ad_id, ctwa_clid, source_app
    FROM crm_reentradas
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${cliente.n8nClientKey})
    ORDER BY reentrada_em DESC
  `;

  return NextResponse.json({
    reentradas: rows.map((r) => ({
      ...r,
      id: r.id.toString(),
      reentrada_em: r.reentrada_em.toISOString(),
    })),
  });
}
