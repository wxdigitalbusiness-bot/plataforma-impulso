// Retorna o histórico completo de mensagens de um lead.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

type MensagemRow = {
  id: bigint;
  lead_id: string;
  de: string;
  tipo: string;
  conteudo: string | null;
  media_url: string | null;
  recebida_em: Date;
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

  const mensagens = await db.$queryRaw<MensagemRow[]>`
    SELECT id, lead_id, de, tipo, conteudo, media_url, recebida_em
    FROM crm_mensagens
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${cliente.n8nClientKey})
    ORDER BY recebida_em ASC
  `;

  // bigint não serializa em JSON — converte para string
  const serialized = mensagens.map((m) => ({ ...m, id: m.id.toString() }));

  return NextResponse.json({ mensagens: serialized });
}
