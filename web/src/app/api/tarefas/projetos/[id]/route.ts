import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const { nome, descricao, cor, status, cliente_id } = body as {
    nome?: string; descricao?: string; cor?: string; status?: string; cliente_id?: number | null;
  };

  await db.$executeRaw`
    UPDATE crm_projetos SET
      nome       = COALESCE(${nome ?? null}, nome),
      descricao  = CASE WHEN ${descricao !== undefined} THEN ${descricao ?? null} ELSE descricao END,
      cor        = COALESCE(${cor ?? null}, cor),
      status     = COALESCE(${status ?? null}, status),
      cliente_id = CASE WHEN ${cliente_id !== undefined} THEN ${cliente_id ?? null} ELSE cliente_id END
    WHERE id = ${Number(id)}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await db.$executeRaw`DELETE FROM crm_projetos WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
