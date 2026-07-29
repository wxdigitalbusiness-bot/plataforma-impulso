// Histórico de ações por cliente ("prontuário").
// GET  /api/historico?clienteId=X  → lista (todos os clientes se omitido)
// POST /api/historico              → cria entrada

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { podeIrProPortal, tipoInfo } from "@/lib/historico-tipos";
import { listarHistorico } from "@/lib/historico";

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("clienteId");
  const clienteId = param ? Number(param) : undefined;
  if (param && Number.isNaN(clienteId)) {
    return NextResponse.json({ erro: "clienteId inválido" }, { status: 400 });
  }

  return NextResponse.json(await listarHistorico(clienteId));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const body = await req.json() as {
    clienteId?: number; tipo?: string; titulo?: string;
    descricao?: string; dataAcao?: string; visivelPortal?: boolean;
  };

  const clienteId = Number(body.clienteId);
  const titulo = body.titulo?.trim();
  if (!clienteId || Number.isNaN(clienteId)) {
    return NextResponse.json({ erro: "cliente obrigatório" }, { status: 400 });
  }
  if (!titulo) return NextResponse.json({ erro: "título obrigatório" }, { status: 400 });

  const tipo = tipoInfo(body.tipo ?? "").valor;
  // Regra dura: entradas internas nunca vazam pro portal, mesmo se o client pedir
  const visivel = podeIrProPortal(tipo) && body.visivelPortal !== false;
  const autor = session.user.name ?? session.user.email ?? null;

  try {
    const [row] = await db.$queryRaw<{ id: number }[]>`
      INSERT INTO cliente_historico
        (cliente_id, tipo, titulo, descricao, data_acao, autor, visivel_portal)
      VALUES (${clienteId}, ${tipo}, ${titulo}, ${body.descricao?.trim() || null},
              COALESCE(${body.dataAcao ?? null}::date, CURRENT_DATE), ${autor}, ${visivel})
      RETURNING id`;
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /api/historico falhou:", err);
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
