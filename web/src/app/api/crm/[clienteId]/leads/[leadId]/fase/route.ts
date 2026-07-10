// Atualiza a fase de um lead e dispara conversões:
// - "qualificado" → Google Ads (lead qualificado)
// - "concluido"   → Meta CAPI + Google Ads (lead convertido)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fireCapiEvent } from "@/lib/capi";
import { fireGoogleConversion } from "@/lib/google-ads";

type Params = { clienteId: string; leadId: string };

type LeadCrm = {
  lead_whatsapp: string;
  fase: string;
  ctwa_clid: string | null;
  gclid: string | null;
  wbraid: string | null;
  gbraid: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clienteId, leadId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json() as { fase: string; faseLabel: string; motivoPerda?: string };
  const { fase, faseLabel, motivoPerda } = body;
  if (!fase || !faseLabel) {
    return NextResponse.json({ error: "fase e faseLabel são obrigatórios" }, { status: 400 });
  }

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: {
      n8nClientKey:                        true,
      pixelId:                             true,
      capiToken:                           true,
      googleAdsCustomerId:                 true,
      googleConversionActionId:            true,
      googleConversionActionIdQualificado: true,
    },
  });

  if (!cliente?.n8nClientKey) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const clientKey = cliente.n8nClientKey;

  const leads = await db.$queryRaw<LeadCrm[]>`
    SELECT lead_whatsapp, fase, ctwa_clid, gclid, wbraid, gbraid
    FROM fb_leads
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
    LIMIT 1
  `;

  if (leads.length === 0) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const lead = leads[0];

  await db.$executeRaw`
    UPDATE fb_leads
    SET fase = ${faseLabel},
        motivo_perda = CASE WHEN ${fase} = 'perdido' THEN ${motivoPerda ?? null} ELSE motivo_perda END
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
  `;

  // Fecha etapa anterior no histórico e abre a nova
  await db.$executeRaw`
    UPDATE crm_historico_etapas
    SET saiu_em = NOW()
    WHERE lead_id = ${leadId}
      AND lower(client_key) = lower(${clientKey})
      AND saiu_em IS NULL
  `;
  await db.$executeRaw`
    INSERT INTO crm_historico_etapas (lead_id, client_key, etapa, tipo, entrou_em)
    VALUES (${leadId}, ${clientKey}, ${faseLabel}, 'transicao', NOW())
  `;

  const etapaConfig = await db.clienteCrmWebhook.findFirst({
    where: { clienteId: id, etapa: fase },
    select: { tipoConversao: true },
  });
  const ehConcluido   = etapaConfig?.tipoConversao === "concluido";
  const ehQualificado = etapaConfig?.tipoConversao === "qualificado";
  const hasGoogleClick = lead.gclid || lead.wbraid || lead.gbraid;

  // ── Meta CAPI (só em concluído) ────────────────────────────────────────────
  let capiResult: { ok: boolean; detail?: string } | null = null;
  if (ehConcluido && cliente.pixelId && cliente.capiToken) {
    const result = await fireCapiEvent({
      pixelId:   cliente.pixelId,
      capiToken: cliente.capiToken,
      phone:     lead.lead_whatsapp,
      ctwaClid:  lead.ctwa_clid ?? undefined,
    });
    capiResult = result.ok ? { ok: true } : { ok: false, detail: result.error };
    // Persiste resultado para exibir no painel do lead
    const capiStatusVal = result.ok ? "ok" : "erro";
    await db.$executeRaw`
      UPDATE fb_leads
      SET capi_status = ${capiStatusVal}, capi_enviado_em = NOW()
      WHERE lead_id = ${leadId}
        AND lower(client_key) = lower(${clientKey})
    `;
  }

  // ── Google Ads Offline Conversions ─────────────────────────────────────────
  let googleResult: { ok: boolean; detail?: string } | null = null;

  if (hasGoogleClick && cliente.googleAdsCustomerId) {
    const actionId = ehConcluido
      ? cliente.googleConversionActionId
      : ehQualificado
        ? cliente.googleConversionActionIdQualificado
        : null;

    if (actionId) {
      const result = await fireGoogleConversion({
        customerId:         cliente.googleAdsCustomerId,
        conversionActionId: actionId,
        gclid:  lead.gclid,
        wbraid: lead.wbraid,
        gbraid: lead.gbraid,
      });
      googleResult = result.ok ? { ok: true } : { ok: false, detail: result.error };
      const gconvStatus = result.ok ? "ok" : "erro";
      await db.$executeRaw`
        UPDATE fb_leads
        SET gconv_status = ${gconvStatus}, gconv_enviado_em = NOW()
        WHERE lead_id = ${leadId}
          AND lower(client_key) = lower(${clientKey})
      `;
    }
  }

  return NextResponse.json({ ok: true, capiResult, googleResult });
}
