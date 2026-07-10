import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type TarefaRow = {
  id: number; projeto_id: number; cliente_id: number;
  titulo: string; descricao: string | null;
  status: string; prioridade: string;
  data_limite: string | null; responsavel: string | null;
  lead_id: string | null; lead_nome: string | null; visivel_portal: boolean;
  posicao: number; criado_em: Date;
};

type MicroRow = { id: number; tarefa_id: number; texto: string; concluida: boolean; ordem: number };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const projetoId = Number(id);

  const tarefas = await db.$queryRaw<TarefaRow[]>`
    SELECT ct.id, ct.projeto_id, ct.cliente_id, ct.titulo, ct.descricao, ct.status, ct.prioridade,
           ct.data_limite::text, ct.responsavel, ct.lead_id, ct.visivel_portal, ct.posicao, ct.criado_em,
           fl.lead_nome
    FROM crm_tarefas ct
    LEFT JOIN fb_leads fl ON fl.lead_id = ct.lead_id
    WHERE ct.projeto_id = ${projetoId}
    ORDER BY ct.posicao ASC, ct.id ASC`;

  const micros = tarefas.length > 0
    ? await db.$queryRaw<MicroRow[]>`
        SELECT id, tarefa_id, texto, concluida, ordem
        FROM crm_microtarefas
        WHERE tarefa_id = ANY(${tarefas.map((t) => t.id)}::int[])
        ORDER BY ordem ASC, id ASC`
    : [];

  const result = tarefas.map((t) => ({
    ...t,
    microtarefas: micros.filter((m) => m.tarefa_id === t.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const projetoId = Number(id);
  const body = await req.json();
  const { clienteId, titulo, descricao, prioridade, data_limite, responsavel } = body as {
    clienteId: number; titulo: string; descricao?: string;
    prioridade?: string; data_limite?: string; responsavel?: string;
  };

  if (!titulo) return NextResponse.json({ erro: "título obrigatório" }, { status: 400 });

  const [row] = await db.$queryRaw<{ id: number }[]>`
    INSERT INTO crm_tarefas (projeto_id, cliente_id, titulo, descricao, prioridade, data_limite, responsavel)
    VALUES (${projetoId}, ${clienteId}, ${titulo}, ${descricao ?? null},
            ${prioridade ?? "media"}, ${data_limite ?? null}, ${responsavel ?? null})
    RETURNING id`;

  return NextResponse.json(row, { status: 201 });
}
