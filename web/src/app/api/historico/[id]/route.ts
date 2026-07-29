// PATCH  /api/historico/[id]  → edita entrada
// DELETE /api/historico/[id]  → remove entrada

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { podeIrProPortal, tipoInfo } from "@/lib/historico-tipos";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const { id } = await params;
  const entradaId = Number(id);
  if (Number.isNaN(entradaId)) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const body = await req.json() as {
    tipo?: string; titulo?: string; descricao?: string;
    dataAcao?: string; visivelPortal?: boolean;
  };

  type Atual = {
    tipo: string; titulo: string; descricao: string | null;
    data_acao: string; visivel_portal: boolean;
  };
  const linhas = await db.$queryRaw<Atual[]>`
    SELECT tipo, titulo, descricao, data_acao::text, visivel_portal
    FROM cliente_historico WHERE id = ${entradaId} LIMIT 1`;
  if (linhas.length === 0) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const atual = linhas[0];

  // Campo ausente no body = mantém o valor atual (não apaga)
  const tipo      = body.tipo !== undefined ? tipoInfo(body.tipo).valor : atual.tipo;
  const titulo    = body.titulo?.trim() || atual.titulo;
  const descricao = body.descricao !== undefined ? (body.descricao.trim() || null) : atual.descricao;
  const dataAcao  = body.dataAcao || atual.data_acao;
  // Mesma regra dura do POST — trocar o tipo para "interno" derruba a visibilidade
  const visivel   = podeIrProPortal(tipo) && (body.visivelPortal ?? atual.visivel_portal);

  try {
    await db.$executeRaw`
      UPDATE cliente_historico SET
        tipo           = ${tipo},
        titulo         = ${titulo},
        descricao      = ${descricao},
        data_acao      = ${dataAcao}::date,
        visivel_portal = ${visivel},
        atualizado_em  = NOW()
      WHERE id = ${entradaId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/historico falhou:", err);
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const { id } = await params;
  const entradaId = Number(id);
  if (Number.isNaN(entradaId)) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  await db.$executeRaw`DELETE FROM cliente_historico WHERE id = ${entradaId}`;
  return NextResponse.json({ ok: true });
}
