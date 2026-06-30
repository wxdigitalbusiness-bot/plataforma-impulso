import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string };

const MOTIVOS_PADRAO = [
  "Preço acima do esperado",
  "Comprou com concorrente",
  "Sem interesse no momento",
  "Não respondeu",
  "Orçamento insuficiente",
  "Não era o perfil ideal",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true },
  });
  if (!cliente?.n8nClientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  type MotivoRow = { id: number; label: string };
  const custom = await db.$queryRaw<MotivoRow[]>`
    SELECT id, label FROM crm_motivos_perda
    WHERE client_key = ${cliente.n8nClientKey} AND ativo = true
    ORDER BY criado_em ASC
  `;

  const motivos = [
    ...MOTIVOS_PADRAO.map((label) => ({ id: `padrao:${label}`, label, padrao: true })),
    ...custom.map((m) => ({ id: String(m.id), label: m.label, padrao: false })),
  ];

  return NextResponse.json({ motivos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true },
  });
  if (!cliente?.n8nClientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json() as { label: string };
  const label = body.label?.trim();
  if (!label) return NextResponse.json({ error: "label obrigatório" }, { status: 400 });

  type MotivoRow = { id: number; label: string };
  const rows = await db.$queryRaw<MotivoRow[]>`
    INSERT INTO crm_motivos_perda (client_key, label)
    VALUES (${cliente.n8nClientKey}, ${label})
    ON CONFLICT (client_key, label) DO UPDATE SET ativo = true
    RETURNING id, label
  `;

  return NextResponse.json({ motivo: { id: String(rows[0].id), label: rows[0].label, padrao: false } });
}
