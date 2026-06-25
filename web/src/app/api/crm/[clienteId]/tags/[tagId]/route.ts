import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; tagId: string };

async function resolveClientKey(clienteId: string) {
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return null;
  const c = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  return c?.n8nClientKey ?? null;
}

// DELETE — remove uma tag (e todas as relações por cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, tagId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const id = parseInt(tagId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Tag inválida" }, { status: 400 });

  await db.$executeRaw`
    DELETE FROM crm_tags
    WHERE id = ${id} AND lower(client_key) = lower(${clientKey})
  `;

  return NextResponse.json({ ok: true });
}
