import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("clienteId");

  // sem clienteId → projetos sem cliente; com clienteId → projetos do cliente
  const rows = await db.$queryRaw<
    { id: number; nome: string; descricao: string | null; cor: string; status: string; cliente_id: number | null }[]
  >`SELECT id, nome, descricao, cor, status, cliente_id
    FROM crm_projetos
    WHERE status != 'arquivado'
      AND (${param === null || param === ""}
           OR cliente_id = ${param ? Number(param) : null}
           OR cliente_id IS NULL AND ${param === null || param === ""})
    ORDER BY id ASC`;

  // simplificando: semCliente → WHERE cliente_id IS NULL; comCliente → WHERE cliente_id = X
  const semCliente = !param || param === "";
  const filtrados = semCliente
    ? await db.$queryRaw<{ id: number; nome: string; descricao: string | null; cor: string; status: string; cliente_id: number | null; visivel_portal: boolean }[]>`
        SELECT id, nome, descricao, cor, status, cliente_id, visivel_portal FROM crm_projetos
        WHERE status != 'arquivado' AND cliente_id IS NULL ORDER BY id ASC`
    : await db.$queryRaw<{ id: number; nome: string; descricao: string | null; cor: string; status: string; cliente_id: number | null; visivel_portal: boolean }[]>`
        SELECT id, nome, descricao, cor, status, cliente_id, visivel_portal FROM crm_projetos
        WHERE status != 'arquivado' AND cliente_id = ${Number(param)} ORDER BY id ASC`;

  return NextResponse.json(filtrados);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clienteId, nome, descricao, cor } = body as {
    clienteId?: number | null; nome: string; descricao?: string; cor?: string;
  };
  if (!nome) return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });

  const [row] = await db.$queryRaw<{ id: number }[]>`
    INSERT INTO crm_projetos (cliente_id, nome, descricao, cor)
    VALUES (${clienteId ?? null}, ${nome}, ${descricao ?? null}, ${cor ?? "#6366f1"})
    RETURNING id`;

  return NextResponse.json(row, { status: 201 });
}
