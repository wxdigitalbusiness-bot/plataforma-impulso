import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

async function resolveClientKey(clienteId: string) {
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return null;
  const c = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  return c?.n8nClientKey ?? null;
}

// POST — adiciona tag ao lead
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { tagId } = await req.json() as { tagId: string };
  const id = parseInt(tagId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Tag inválida" }, { status: 400 });

  await db.$executeRaw`
    INSERT INTO crm_lead_tags (lead_id, client_key, tag_id)
    VALUES (${leadId}, ${clientKey}, ${id})
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remove tag do lead
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { tagId } = await req.json() as { tagId: string };
  const id = parseInt(tagId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Tag inválida" }, { status: 400 });

  await db.$executeRaw`
    DELETE FROM crm_lead_tags
    WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey}) AND tag_id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
