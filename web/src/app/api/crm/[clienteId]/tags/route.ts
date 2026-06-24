import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string };

async function resolveClientKey(clienteId: string) {
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return null;
  const c = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  return c?.n8nClientKey ?? null;
}

// GET — lista todas as tags do cliente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const tags = await db.$queryRaw<Array<{ id: bigint; nome: string; cor: string; criado_em: string }>>`
    SELECT id, nome, cor, criado_em
    FROM crm_tags
    WHERE lower(client_key) = lower(${clientKey})
    ORDER BY nome
  `;

  return NextResponse.json({ tags: tags.map((t) => ({ ...t, id: t.id.toString() })) });
}

// POST — cria nova tag
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json() as { nome: string; cor: string };
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const cor = body.cor?.trim() || "#6366f1";
  const nome = body.nome.trim();

  const result = await db.$queryRaw<Array<{ id: bigint; nome: string; cor: string }>>`
    INSERT INTO crm_tags (client_key, nome, cor)
    VALUES (${clientKey}, ${nome}, ${cor})
    ON CONFLICT (client_key, nome) DO UPDATE SET cor = EXCLUDED.cor
    RETURNING id, nome, cor
  `;

  return NextResponse.json({ tag: { ...result[0], id: result[0].id.toString() } }, { status: 201 });
}
