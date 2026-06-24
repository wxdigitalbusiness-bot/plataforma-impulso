import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

export async function DELETE(
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

  const clientKey = cliente.n8nClientKey;

  await db.$executeRaw`
    DELETE FROM crm_mensagens
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
  `;

  await db.$executeRaw`
    DELETE FROM fb_leads
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
  `;

  return NextResponse.json({ ok: true });
}
