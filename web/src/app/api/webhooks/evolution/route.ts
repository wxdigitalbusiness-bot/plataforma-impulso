// Recebe todos os webhooks da Evolution API.
// Filtra eventos messages.upsert, identifica o cliente pelo nome da instância,
// faz upsert do lead em fb_leads e armazena a mensagem em crm_mensagens.
// Sempre retorna 200 para que a Evolution API não reenvie o evento.

import { NextRequest, NextResponse } from "next/server";
import { parseEvolutionWebhook } from "@/lib/evolution-webhook";
import { upsertCrmLead } from "@/lib/crm-lead";
import { db } from "@/lib/db";

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (WEBHOOK_SECRET) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const parsed = parseEvolutionWebhook(body);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Localiza o cliente pela instância Evolution
  const cliente = await db.cliente.findUnique({
    where: { evolutionInstance: parsed.instance },
    select: { id: true, nome: true, n8nClientKey: true },
  });

  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: "instance_not_mapped" });
  }

  const clientKey = cliente.n8nClientKey;
  const leadId = parsed.phone;

  // Mensagens enviadas pelo negócio (fromMe): grava como 'atendente', sem criar lead
  if (parsed.fromMe) {
    await db.$executeRaw`
      INSERT INTO crm_mensagens (
        lead_id, client_key, de, tipo, conteudo, media_url, evolution_msg_id, recebida_em
      ) VALUES (
        ${leadId},
        ${clientKey},
        'atendente',
        ${parsed.tipo},
        ${parsed.conteudo},
        ${parsed.mediaUrl},
        ${parsed.evolutionMsgId},
        ${parsed.recebidaEm}
      )
      ON CONFLICT (evolution_msg_id) DO NOTHING
    `;
    return NextResponse.json({ ok: true, fromMe: true });
  }

  // Mensagem do lead: upsert do lead + grava mensagem + atribuição Google
  const { leadId: upsertedId } = await upsertCrmLead({
    phone: parsed.phone,
    clientKey,
    clientName: cliente.nome,
    pushName: parsed.pushName,
    adId: parsed.adId,
    ctwaClid: parsed.ctwaClid,
    sourceApp: parsed.sourceApp,
    recebidaEm: parsed.recebidaEm,
  });

  await db.$executeRaw`
    INSERT INTO crm_mensagens (
      lead_id, client_key, de, tipo, conteudo, media_url, evolution_msg_id, recebida_em
    ) VALUES (
      ${upsertedId},
      ${clientKey},
      'lead',
      ${parsed.tipo},
      ${parsed.conteudo},
      ${parsed.mediaUrl},
      ${parsed.evolutionMsgId},
      ${parsed.recebidaEm}
    )
    ON CONFLICT (evolution_msg_id) DO NOTHING
  `;

  // Atribuição Google por janela de 30 min
  const atribuido = await db.$executeRaw`
    UPDATE google_attribution
    SET lead_id = ${upsertedId}, vinculado_em = NOW()
    WHERE id = (
      SELECT id FROM google_attribution
      WHERE client_key = ${clientKey}
        AND lead_id IS NULL
        AND criado_em > NOW() - INTERVAL '30 minutes'
      ORDER BY criado_em DESC
      LIMIT 1
    )
  `;
  if (atribuido) {
    await db.$executeRaw`
      UPDATE fb_leads fl
      SET
        google_code = COALESCE(fl.google_code, ga.code),
        gclid       = COALESCE(fl.gclid,       ga.gclid),
        wbraid      = COALESCE(fl.wbraid,      ga.wbraid),
        gbraid      = COALESCE(fl.gbraid,      ga.gbraid),
        utm_source  = COALESCE(fl.utm_source,  ga.utm_source)
      FROM google_attribution ga
      WHERE ga.lead_id = ${upsertedId}
        AND ga.client_key = ${clientKey}
        AND fl.lead_id = ${upsertedId}
    `;
  }

  return NextResponse.json({ ok: true, leadId: upsertedId, clientKey });
}
