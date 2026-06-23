// Envia uma mensagem de texto para o lead via Evolution API
// e registra em crm_mensagens como enviada pelo atendente.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EVOLUTION_API_URL, evoHeaders } from "@/lib/whatsapp-sessions";

type Params = { clienteId: string; leadId: string };

type LeadInfo = {
  lead_whatsapp: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json() as { texto: string };
  const texto = body?.texto?.trim();
  if (!texto) return NextResponse.json({ error: "texto é obrigatório" }, { status: 400 });

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { n8nClientKey: true, evolutionInstance: true },
  });

  if (!cliente?.n8nClientKey || !cliente.evolutionInstance) {
    return NextResponse.json({ error: "Cliente sem instância Evolution configurada" }, { status: 400 });
  }

  const clientKey = cliente.n8nClientKey;

  // Busca o telefone do lead
  const leads = await db.$queryRaw<LeadInfo[]>`
    SELECT lead_whatsapp
    FROM fb_leads
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
    LIMIT 1
  `;

  if (leads.length === 0) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const phone = leads[0].lead_whatsapp;
  // Evolution API espera o número no formato "<ddd><número>@s.whatsapp.net"
  const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;

  // Envia via Evolution API
  const evoRes = await fetch(
    `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(cliente.evolutionInstance)}`,
    {
      method: "POST",
      headers: { ...evoHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, text: texto }),
    }
  );

  if (!evoRes.ok) {
    const errText = await evoRes.text();
    return NextResponse.json({ error: "Falha ao enviar via Evolution", detail: errText }, { status: 502 });
  }

  const evoData = await evoRes.json() as { key?: { id?: string } };
  const evolutionMsgId = evoData?.key?.id ?? null;
  const agora = new Date();

  // Registra a mensagem enviada
  await db.$executeRaw`
    INSERT INTO crm_mensagens (lead_id, client_key, de, tipo, conteudo, evolution_msg_id, recebida_em)
    VALUES (${leadId}, ${clientKey}, 'atendente', 'text', ${texto}, ${evolutionMsgId}, ${agora})
    ON CONFLICT (evolution_msg_id) DO NOTHING
  `;

  return NextResponse.json({ ok: true, enviadoEm: agora });
}
