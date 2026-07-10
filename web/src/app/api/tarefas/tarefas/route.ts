import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type TarefaRow = {
  id: number; projeto_id: number | null; cliente_id: number | null;
  titulo: string; descricao: string | null;
  status: string; prioridade: string;
  data_limite: string | null; responsavel: string | null;
  lead_id: string | null; lead_nome: string | null; visivel_portal: boolean; posicao: number;
};
type MicroRow = { id: number; tarefa_id: number; texto: string; concluida: boolean; ordem: number };

// GET /api/tarefas/tarefas?clienteId=X  → tarefas sem projeto do cliente (ou sem cliente se sem param)
export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("clienteId");
  const semCliente = !param || param === "";

  const tarefas = semCliente
    ? await db.$queryRaw<TarefaRow[]>`
        SELECT ct.id, ct.projeto_id, ct.cliente_id, ct.titulo, ct.descricao, ct.status, ct.prioridade,
               ct.data_limite::text, ct.responsavel, ct.lead_id, ct.visivel_portal, ct.posicao,
               fl.lead_nome
        FROM crm_tarefas ct
        LEFT JOIN fb_leads fl ON fl.lead_id = ct.lead_id
        WHERE ct.projeto_id IS NULL AND ct.cliente_id IS NULL
        ORDER BY ct.posicao ASC, ct.id ASC`
    : await db.$queryRaw<TarefaRow[]>`
        SELECT ct.id, ct.projeto_id, ct.cliente_id, ct.titulo, ct.descricao, ct.status, ct.prioridade,
               ct.data_limite::text, ct.responsavel, ct.lead_id, ct.visivel_portal, ct.posicao,
               fl.lead_nome
        FROM crm_tarefas ct
        LEFT JOIN fb_leads fl ON fl.lead_id = ct.lead_id
        WHERE ct.projeto_id IS NULL AND ct.cliente_id = ${Number(param)}
        ORDER BY ct.posicao ASC, ct.id ASC`;

  const micros = tarefas.length > 0
    ? await db.$queryRaw<MicroRow[]>`
        SELECT id, tarefa_id, texto, concluida, ordem FROM crm_microtarefas
        WHERE tarefa_id = ANY(${tarefas.map((t) => t.id)}::int[])
        ORDER BY ordem ASC, id ASC`
    : [];

  return NextResponse.json(
    tarefas.map((t) => ({ ...t, microtarefas: micros.filter((m) => m.tarefa_id === t.id) }))
  );
}

// POST /api/tarefas/tarefas  → cria tarefa sem projeto
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clienteId, titulo, descricao, prioridade, data_limite, responsavel, status } = body as {
    clienteId?: number | null; titulo: string; descricao?: string;
    prioridade?: string; data_limite?: string; responsavel?: string; status?: string;
  };
  if (!titulo) return NextResponse.json({ erro: "título obrigatório" }, { status: 400 });

  const [row] = await db.$queryRaw<{ id: number }[]>`
    INSERT INTO crm_tarefas (projeto_id, cliente_id, titulo, descricao, prioridade, data_limite, responsavel, status)
    VALUES (NULL, ${clienteId ?? null}, ${titulo}, ${descricao ?? null},
            ${prioridade ?? "media"}, ${data_limite ?? null}, ${responsavel ?? null}, ${status ?? "a_fazer"})
    RETURNING id`;

  return NextResponse.json(row, { status: 201 });
}
