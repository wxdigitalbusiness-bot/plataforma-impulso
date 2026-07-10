import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const {
    titulo, descricao, status, prioridade,
    data_limite, responsavel, visivel_portal, projeto_id,
  } = body as {
    titulo?: string; descricao?: string; status?: string; prioridade?: string;
    data_limite?: string | null; responsavel?: string | null;
    visivel_portal?: boolean; projeto_id?: number | null;
  };

  await db.$executeRaw`
    UPDATE crm_tarefas SET
      titulo         = COALESCE(${titulo ?? null}, titulo),
      descricao      = CASE WHEN ${descricao !== undefined} THEN ${descricao ?? null} ELSE descricao END,
      status         = COALESCE(${status ?? null}, status),
      prioridade     = COALESCE(${prioridade ?? null}, prioridade),
      data_limite    = CASE WHEN ${data_limite !== undefined} THEN ${data_limite ?? null}::date ELSE data_limite END,
      responsavel    = CASE WHEN ${responsavel !== undefined} THEN ${responsavel ?? null} ELSE responsavel END,
      visivel_portal = CASE WHEN ${visivel_portal !== undefined} THEN ${visivel_portal ?? false} ELSE visivel_portal END,
      projeto_id     = CASE WHEN ${projeto_id !== undefined} THEN ${projeto_id ?? null} ELSE projeto_id END,
      atualizado_em  = NOW()
    WHERE id = ${Number(id)}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await db.$executeRaw`DELETE FROM crm_tarefas WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
