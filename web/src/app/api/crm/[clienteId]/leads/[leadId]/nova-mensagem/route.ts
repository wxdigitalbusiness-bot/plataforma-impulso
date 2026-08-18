// PATCH — marca o sinalizador de "nova mensagem" de um lead já classificado
// como visto (limpa o ícone no card). Ação manual da agência.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  if (!cliente?.n8nClientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  await db.$executeRaw`
    UPDATE fb_leads
    SET nova_mensagem = false
    WHERE lead_id = ${leadId} AND lower(client_key) = lower(${cliente.n8nClientKey})
  `;

  return NextResponse.json({ ok: true });
}
