// Recebe todos os webhooks da Evolution API.
// Filtra eventos messages.upsert, identifica o cliente pelo nome da instância,
// faz upsert do lead em fb_leads e armazena a mensagem em crm_mensagens.
// Sempre retorna 200 para que a Evolution API não reenvie o evento.

import { NextRequest, NextResponse } from "next/server";
import { parseEvolutionWebhook } from "@/lib/evolution-webhook";
import { upsertCrmLead } from "@/lib/crm-lead";
import { db } from "@/lib/db";

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

// ── Log helper ────────────────────────────────────────────────────────────────

type LogData = {
  instance: string | null;
  eventType: string | null;
  status: string;
  motivoSkip: string | null;
  rawBody: unknown;
  phone: string | null;
  pushName: string | null;
  fromMe: boolean | null;
  adId: string | null;
  ctwaClid: string | null;
  sourceApp: string | null;
  tipoMsg: string | null;
  conteudo: string | null;
  clientKey: string | null;
  leadId: string | null;
  erroMsg: string | null;
};

async function logWebhookEvent(data: LogData) {
  try {
    const raw = JSON.stringify(data.rawBody ?? null);
    await db.$executeRaw`
      INSERT INTO webhook_events (
        instance, event_type, status, motivo_skip, raw_body,
        phone, push_name, from_me, ad_id, ctwa_clid, source_app,
        tipo_msg, conteudo, client_key, lead_id, erro_msg
      ) VALUES (
        ${data.instance}, ${data.eventType}, ${data.status}, ${data.motivoSkip},
        ${raw}::jsonb,
        ${data.phone}, ${data.pushName}, ${data.fromMe},
        ${data.adId}, ${data.ctwaClid}, ${data.sourceApp},
        ${data.tipoMsg}, ${data.conteudo}, ${data.clientKey},
        ${data.leadId}, ${data.erroMsg}
      )
    `;
  } catch (err) {
    console.error("[webhook-log]", err);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verificação de secret antes de qualquer log (401 não é evento CRM)
  if (WEBHOOK_SECRET) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const log: LogData = {
    instance: null, eventType: null, status: "ignorado", motivoSkip: null,
    rawBody: null, phone: null, pushName: null, fromMe: null,
    adId: null, ctwaClid: null, sourceApp: null,
    tipoMsg: null, conteudo: null, clientKey: null, leadId: null, erroMsg: null,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      body = await req.json();
      log.rawBody = body;
      log.instance = body?.instance ?? null;
      log.eventType = body?.event ?? null;
    } catch {
      log.motivoSkip = "json_parse_error";
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const parsed = parseEvolutionWebhook(body);
    if (!parsed) {
      log.motivoSkip = "parse_null";
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Preenche campos extraídos pelo parser
    log.phone     = parsed.phone;
    log.pushName  = parsed.pushName;
    log.fromMe    = parsed.fromMe;
    log.adId      = parsed.adId;
    log.ctwaClid  = parsed.ctwaClid;
    log.sourceApp = parsed.sourceApp;
    log.tipoMsg   = parsed.tipo;
    log.conteudo  = parsed.conteudo;

    // Localiza o cliente pela instância Evolution
    const cliente = await db.cliente.findUnique({
      where: { evolutionInstance: parsed.instance },
      select: { id: true, nome: true, n8nClientKey: true, n8nWebhookForwardUrl: true },
    });

    if (!cliente?.n8nClientKey) {
      log.motivoSkip = "instance_not_mapped";
      return NextResponse.json({ ok: true, skipped: true, reason: "instance_not_mapped" });
    }

    // Encaminha para o n8n (fire-and-forget) para manter fluxos legados funcionando
    if (cliente.n8nWebhookForwardUrl) {
      fetch(cliente.n8nWebhookForwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    const clientKey = cliente.n8nClientKey;
    const leadId    = parsed.phone;
    log.clientKey   = clientKey;
    log.leadId      = leadId;

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
      log.status = "fromMe";
      return NextResponse.json({ ok: true, fromMe: true });
    }

    // Mensagem do lead: upsert do lead + grava mensagem + atribuição Google
    const { leadId: upsertedId, isNew } = await upsertCrmLead({
      phone: parsed.phone,
      clientKey,
      clientName: cliente.nome,
      pushName: parsed.pushName,
      adId: parsed.adId,
      ctwaClid: parsed.ctwaClid,
      sourceApp: parsed.sourceApp,
      adTitle: parsed.adTitle,
      adBody: parsed.adBody,
      adMediaUrl: parsed.adMediaUrl,
      recebidaEm: parsed.recebidaEm,
    });

    log.leadId = upsertedId;

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

    // Atribuição Google por janela de 30 min — só para leads novos (first-touch)
    if (!isNew) {
      log.status = "processado";
      return NextResponse.json({ ok: true, leadId: upsertedId, clientKey });
    }

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
          google_code  = COALESCE(fl.google_code,  ga.code),
          gclid        = COALESCE(fl.gclid,        ga.gclid),
          wbraid       = COALESCE(fl.wbraid,       ga.wbraid),
          gbraid       = COALESCE(fl.gbraid,       ga.gbraid),
          utm_source   = COALESCE(fl.utm_source,   ga.utm_source),
          utm_campaign = COALESCE(fl.utm_campaign, ga.utm_campaign),
          utm_medium   = COALESCE(fl.utm_medium,   ga.utm_medium),
          utm_term     = COALESCE(fl.utm_term,     ga.utm_term),
          utm_content  = COALESCE(fl.utm_content,  ga.utm_content)
        FROM google_attribution ga
        WHERE ga.lead_id = ${upsertedId}
          AND ga.client_key = ${clientKey}
          AND fl.lead_id = ${upsertedId}
      `;
    }

    log.status = "processado";
    return NextResponse.json({ ok: true, leadId: upsertedId, clientKey });

  } catch (err) {
    log.status  = "erro";
    log.erroMsg = String(err);
    console.error("[evolution-webhook]", err);
    return NextResponse.json({ ok: true });
  } finally {
    // Registra o evento sempre (exceto 401)
    await logWebhookEvent(log);
  }
}
