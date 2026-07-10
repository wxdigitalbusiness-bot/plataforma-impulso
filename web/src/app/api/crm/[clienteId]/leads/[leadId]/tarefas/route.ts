import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

type TarefaRow = {
  id: number; projeto_id: number | null; cliente_id: number | null;
  titulo: string; descricao: string | null;
  status: string; prioridade: string;
  data_limite: string | null; responsavel: string | null;
  visivel_portal: boolean;
};
type MicroRow = { id: number; tarefa_id: number; texto: string; concluida: boolean; ordem: number };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { leadId } = await params;

  const tarefas = await db.$queryRaw<TarefaRow[]>`
    SELECT id, projeto_id, cliente_id, titulo, descricao, status, prioridade,
           data_limite::text, responsavel, visivel_portal
    FROM crm_tarefas
    WHERE lead_id = ${leadId}
    ORDER BY criado_em DESC
  `;

  const micros = tarefas.length > 0
    ? await db.$queryRaw<MicroRow[]>`
        SELECT id, tarefa_id, texto, concluida, ordem
        FROM crm_microtarefas
        WHERE tarefa_id = ANY(${tarefas.map((t) => t.id)}::int[])
        ORDER BY ordem ASC, id ASC`
    : [];

  return NextResponse.json(
    tarefas.map((t) => ({ ...t, microtarefas: micros.filter((m) => m.tarefa_id === t.id) }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const { titulo, prioridade, data_limite, projeto_id } = await req.json() as {
    titulo: string; prioridade?: string; data_limite?: string; projeto_id?: number | null;
  };

  if (!titulo?.trim()) return NextResponse.json({ erro: "título obrigatório" }, { status: 400 });

  const [row] = await db.$queryRaw<{ id: number }[]>`
    INSERT INTO crm_tarefas (lead_id, cliente_id, projeto_id, titulo, prioridade, data_limite)
    VALUES (
      ${leadId}, ${Number(clienteId)}, ${projeto_id ?? null},
      ${titulo.trim()}, ${prioridade ?? "media"}, ${data_limite ?? null}
    )
    RETURNING id
  `;

  return NextResponse.json(row, { status: 201 });
}
