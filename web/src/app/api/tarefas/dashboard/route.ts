import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type TarefaRow = {
  id: number; projeto_id: number | null; cliente_id: number | null;
  titulo: string; descricao: string | null;
  status: string; prioridade: string;
  data_limite: string | null; responsavel: string | null;
  lead_id: string | null; lead_nome: string | null; visivel_portal: boolean;
  cliente_nome: string | null; projeto_nome: string | null;
};
type MicroRow = { id: number; tarefa_id: number; texto: string; concluida: boolean; ordem: number };

export async function GET(req: NextRequest) {
  const p          = req.nextUrl.searchParams;
  const status     = p.get("status") || null;
  const responsavel = p.get("responsavel") || null;
  const clienteId  = p.get("clienteId") ? Number(p.get("clienteId")) : null;

  const tarefas = await db.$queryRaw<TarefaRow[]>`
    SELECT ct.id, ct.projeto_id, ct.cliente_id, ct.titulo, ct.descricao,
           ct.status, ct.prioridade, ct.data_limite::text, ct.responsavel,
           ct.lead_id, ct.visivel_portal,
           fl.lead_nome,
           c.nome  AS cliente_nome,
           cp.nome AS projeto_nome
    FROM crm_tarefas ct
    LEFT JOIN fb_leads      fl ON fl.lead_id   = ct.lead_id
    LEFT JOIN clientes      c  ON c.id         = ct.cliente_id
    LEFT JOIN crm_projetos  cp ON cp.id        = ct.projeto_id
    WHERE (${status}::text     IS NULL OR ct.status      = ${status}::text)
      AND (${responsavel}::text IS NULL OR ct.responsavel = ${responsavel}::text)
      AND (${clienteId}::int    IS NULL OR ct.cliente_id  = ${clienteId}::int)
    ORDER BY
      CASE ct.status
        WHEN 'a_fazer'      THEN 1
        WHEN 'em_andamento' THEN 2
        WHEN 'em_revisao'   THEN 3
        WHEN 'concluido'    THEN 4
        ELSE 5
      END,
      ct.data_limite ASC NULLS LAST,
      ct.criado_em DESC
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
