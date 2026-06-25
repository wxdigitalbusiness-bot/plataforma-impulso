import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { clienteId: string; leadId: string };

async function resolveClientKey(clienteId: string) {
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return null;
  const c = await db.cliente.findUnique({ where: { id }, select: { n8nClientKey: true } });
  return c?.n8nClientKey ?? null;
}

// GET — detalhes completos do lead (observações, valor, tags, atribuição)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const [leads, tags, atribuicao] = await Promise.all([
    db.$queryRaw<Array<{
      observacoes: string | null;
      valor_negociacao: number | null;
      utm_source: string | null;
    }>>`
      SELECT observacoes, valor_negociacao::float AS valor_negociacao, utm_source
      FROM fb_leads
      WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey})
      LIMIT 1
    `,

    db.$queryRaw<Array<{ id: bigint; nome: string; cor: string }>>`
      SELECT t.id, t.nome, t.cor
      FROM crm_tags t
      JOIN crm_lead_tags lt ON lt.tag_id = t.id
      WHERE lt.lead_id = ${leadId} AND lower(lt.client_key) = lower(${clientKey})
      ORDER BY t.nome
    `,

    db.$queryRaw<Array<{
      utm_source: string | null; utm_medium: string | null;
      utm_campaign: string | null; utm_content: string | null; utm_term: string | null;
      gclid: string | null;
    }>>`
      SELECT utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid
      FROM google_attribution
      WHERE lead_id = ${leadId} AND client_key = ${clientKey}
      ORDER BY vinculado_em DESC
      LIMIT 1
    `,
  ]);

  if (!leads.length) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  return NextResponse.json({
    detalhes: leads[0],
    tags: tags.map((t) => ({ ...t, id: t.id.toString() })),
    atribuicao: atribuicao[0] ?? null,
  });
}

// PATCH — atualiza observações e valor de negociação
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json() as { observacoes?: string | null; valor_negociacao?: number | null };

  await db.$executeRaw`
    UPDATE fb_leads
    SET
      observacoes      = ${body.observacoes ?? null},
      valor_negociacao = ${body.valor_negociacao ?? null}
    WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey})
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remove lead + mensagens + atribuições
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const clientKey = await resolveClientKey(clienteId);
  if (!clientKey) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  await db.$executeRaw`DELETE FROM crm_mensagens WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey})`;
  await db.$executeRaw`DELETE FROM crm_lead_tags WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey})`;
  await db.$executeRaw`UPDATE google_attribution SET lead_id = NULL, vinculado_em = NULL WHERE lead_id = ${leadId} AND client_key = ${clientKey}`;
  await db.$executeRaw`DELETE FROM fb_leads WHERE lead_id = ${leadId} AND lower(client_key) = lower(${clientKey})`;

  return NextResponse.json({ ok: true });
}
