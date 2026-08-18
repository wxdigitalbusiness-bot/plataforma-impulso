// PATCH — corrige o valor de um lançamento já registrado no histórico de
// negociação (ex.: valor digitado errado). Não cria um novo lançamento.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string; historicoId: string };

async function resolveClientKey(clienteId: string) {
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return null;
  const c = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  return c?.n8nClientKey ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId, historicoId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const id = parseInt(historicoId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json() as { valor?: number };
  if (typeof body.valor !== "number" || body.valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const result = await db.$executeRaw`
    UPDATE crm_historico_negociacao
    SET valor = ${body.valor}
    WHERE id = ${id}
      AND lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
  `;

  if (result === 0) {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
