// PATCH — marca/desmarca um lead como colaborador (funcionário testando o
// WhatsApp, não um lead de verdade). Some da lista de leads, funil e
// relatórios sem apagar a conversa — reversível.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  if (!cliente?.n8nClientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json() as { colaborador?: boolean };
  const colaborador = body.colaborador === true;

  await db.$executeRaw`
    UPDATE fb_leads
    SET eh_colaborador = ${colaborador}
    WHERE lead_id = ${leadId} AND lower(client_key) = lower(${cliente.n8nClientKey})
  `;

  return NextResponse.json({ ok: true, colaborador });
}
