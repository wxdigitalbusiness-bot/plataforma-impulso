import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { texto } = await req.json() as { texto: string };
  if (!texto?.trim()) return NextResponse.json({ erro: "texto obrigatório" }, { status: 400 });

  const [row] = await db.$queryRaw<{ id: number; texto: string; concluida: boolean; ordem: number }[]>`
    INSERT INTO crm_microtarefas (tarefa_id, texto, ordem)
    SELECT ${Number(id)}, ${texto.trim()}, COALESCE((SELECT MAX(ordem) + 1 FROM crm_microtarefas WHERE tarefa_id = ${Number(id)}), 0)
    RETURNING id, texto, concluida, ordem`;

  return NextResponse.json(row, { status: 201 });
}
