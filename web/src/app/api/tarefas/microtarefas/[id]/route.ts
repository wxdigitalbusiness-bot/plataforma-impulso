import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { concluida, texto } = await req.json() as { concluida?: boolean; texto?: string };

  await db.$executeRaw`
    UPDATE crm_microtarefas SET
      concluida = CASE WHEN ${concluida !== undefined} THEN ${concluida ?? false} ELSE concluida END,
      texto     = COALESCE(${texto ?? null}, texto)
    WHERE id = ${Number(id)}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await db.$executeRaw`DELETE FROM crm_microtarefas WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
