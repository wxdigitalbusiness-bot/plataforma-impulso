// Recebe todos os webhooks da Evolution API.
// Filtra eventos messages.upsert, identifica o cliente pelo nome da instância,
// faz upsert do lead em fb_leads e armazena a mensagem em crm_mensagens.
// Sempre retorna 200 para que a Evolution API não reenvie o evento.

import { NextRequest, NextResponse } from "next/server";
import { parseEvolutionWebhook } from "@/lib/evolution-webhook";
import { upsertCrmLead } from "@/lib/crm-lead";
import { db } from "@/lib/db";

// Token de segurança opcional — configure EVOLUTION_WEBHOOK_SECRET no .env
// e adicione ?secret=<valor> na URL do webhook na Evolution API.
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // Verificação de secret (se configurado)
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

  // DEBUG TEMPORÁRIO — remover após diagnóstico
  console.log("[evo-webhook] body recebido:", JSON.stringify(body).slice(0, 500));

  const parsed = parseEvolutionWebhook(body);
  // Evento ignorado (não é messages.upsert ou é mensagem própria)
  if (!parsed) {
    console.log("[evo-webhook] ignorado — event:", body?.event, "fromMe:", body?.data?.key?.fromMe);
    return NextResponse.json({ ok: true, skipped: true });
  }

  console.log("[evo-webhook] parsed — instance:", parsed.instance, "phone:", parsed.phone);

  // Localiza o cliente pela instância Evolution
  const cliente = await db.cliente.findUnique({
    where: { evolutionInstance: parsed.instance },
    select: { id: true, nome: true, n8nClientKey: true },
  });

  console.log("[evo-webhook] cliente encontrado:", cliente ? `id=${cliente.id} key=${cliente.n8nClientKey}` : "NÃO ENCONTRADO para instância: " + parsed.instance);

  if (!cliente?.n8nClientKey) {
    // Instância não mapeada a nenhum cliente — ignora silenciosamente
    return NextResponse.json({ ok: true, skipped: true, reason: "instance_not_mapped" });
  }

  const clientKey = cliente.n8nClientKey;

  // Upsert do lead em fb_leads
  const { leadId } = await upsertCrmLead({
    phone: parsed.phone,
    clientKey,
    clientName: cliente.nome,
    pushName: parsed.pushName,
    adId: parsed.adId,
    ctwaClid: parsed.ctwaClid,
    sourceApp: parsed.sourceApp,
    recebidaEm: parsed.recebidaEm,
  });

  // Insere mensagem em crm_mensagens (ON CONFLICT DO NOTHING evita duplicatas)
  await db.$executeRaw`
    INSERT INTO crm_mensagens (
      lead_id, client_key, de, tipo, conteudo, media_url, evolution_msg_id, recebida_em
    ) VALUES (
      ${leadId},
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

  // Atribuição Google por janela de tempo: vincula o clique mais recente não atribuído
  // do mesmo cliente nos últimos 30 minutos (mesma lógica usada por ferramentas como Datalitcs).
  const atribuido = await db.$executeRaw`
    UPDATE google_attribution
    SET lead_id = ${leadId}, vinculado_em = NOW()
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
    // Copia gclid/wbraid/gbraid para o lead (primeira ocorrência vence)
    await db.$executeRaw`
      UPDATE fb_leads fl
      SET
        google_code = COALESCE(fl.google_code, ga.code),
        gclid       = COALESCE(fl.gclid,       ga.gclid),
        wbraid      = COALESCE(fl.wbraid,      ga.wbraid),
        gbraid      = COALESCE(fl.gbraid,      ga.gbraid)
      FROM google_attribution ga
      WHERE ga.lead_id = ${leadId}
        AND ga.client_key = ${clientKey}
        AND fl.lead_id = ${leadId}
    `;
  }

  return NextResponse.json({ ok: true, leadId, clientKey });
}
