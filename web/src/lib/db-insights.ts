/**
 * db-insights.ts
 *
 * Queries diretas nas tabelas populadas pelos workflows n8n:
 *  - fb_meta_insights       → métricas diárias de Meta Ads por conta/cliente
 *  - fb_meta_insights_ads   → métricas diárias de Meta Ads por anúncio
 *  - impulso.lead_current   → estado atual de cada lead do CRM
 *
 * Essas tabelas NÃO estão no Prisma schema (são "legadas" do n8n).
 * Usamos $queryRaw com tagged template literals para segurança.
 *
 * Correspondência de chaves:
 *  Cliente.n8nClientKey  ↔  fb_meta_insights.client_key
 *                        ↔  impulso.lead_current.client_key
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Funil CRM de um cliente para um período */
export type CrmFunil = {
  clientKey: string;
  totalLeads: number;       // novos leads criados no período
  qualificados: number;     // leads com current_stage_id = 'qualified'
  perdidos: number;         // leads com current_stage_id = 'lost'
  concluidos: number;       // leads com current_stage_id = 'completed'
  semAtribuicao: number;    // leads sem ad_id (WhatsApp direto, orgânico, etc.)
  comAtribuicao: number;    // leads com ad_id (originados de anúncio)
};

/** Leads por campanha Meta Ads (via ad_id → campaign) */
export type LeadCampanha = {
  campanhaId: string;
  campanhaNome: string;
  leads: number;
};

/** Métricas Meta Ads do banco (substitui chamada à API quando disponível) */
export type MetaInsightsDB = {
  spend: number;
  reach: number;
  convMsgConversations: number;  // messaging_conversation_started_7d acumulado
  convPurchaseCount: number;     // compras
  convLinkClicks: number;        // cliques em links
  tipoResultado: string;         // label PT-BR determinado a partir dos dados
};

// ─── CRM: funil de um cliente ────────────────────────────────────────────────

export async function getCrmFunil(
  clientKey: string,
  from: string,   // ISO date YYYY-MM-DD
  to: string,     // ISO date YYYY-MM-DD
): Promise<CrmFunil> {
  type Row = {
    total_leads: bigint | number;
    qualificados: bigint | number;
    perdidos: bigint | number;
    concluidos: bigint | number;
    sem_atribuicao: bigint | number;
    com_atribuicao: bigint | number;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        COUNT(*)                                                        AS total_leads,
        COUNT(*) FILTER (WHERE current_stage_id = 'qualified')         AS qualificados,
        COUNT(*) FILTER (WHERE current_stage_id = 'lost')              AS perdidos,
        COUNT(*) FILTER (WHERE current_stage_id = 'completed')         AS concluidos,
        COUNT(*) FILTER (
          WHERE ad_id IS NULL
             OR trim(ad_id::text) = ''
             OR trim(ad_id::text) = 'null'
        )                                                               AS sem_atribuicao,
        COUNT(*) FILTER (
          WHERE ad_id IS NOT NULL
            AND trim(ad_id::text) <> ''
            AND trim(ad_id::text) <> 'null'
        )                                                               AS com_atribuicao
      FROM impulso.lead_current
      WHERE lower(client_key) = lower(${clientKey})
        AND created_at_crm::date BETWEEN ${from}::date AND ${to}::date
    `;

    const r = rows[0];
    if (!r) return emptyFunil(clientKey);
    return {
      clientKey,
      totalLeads: toInt(r.total_leads),
      qualificados: toInt(r.qualificados),
      perdidos: toInt(r.perdidos),
      concluidos: toInt(r.concluidos),
      semAtribuicao: toInt(r.sem_atribuicao),
      comAtribuicao: toInt(r.com_atribuicao),
    };
  } catch (err) {
    console.error("[DB] getCrmFunil:", err);
    return emptyFunil(clientKey);
  }
}

/** Retorna funil CRM para vários clientKeys de uma vez (uma query só). */
export async function getCrmFunilMultiplos(
  clientKeys: string[],
  from: string,
  to: string,
): Promise<Map<string, CrmFunil>> {
  if (clientKeys.length === 0) return new Map();

  type Row = {
    client_key_lower: string;
    total_leads: bigint | number;
    qualificados: bigint | number;
    perdidos: bigint | number;
    concluidos: bigint | number;
    sem_atribuicao: bigint | number;
    com_atribuicao: bigint | number;
  };

  // Montar lista de placeholders (sem interpolação direta de arrays no $queryRaw)
  const lowerKeys = clientKeys.map((k) => k.toLowerCase());

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        lower(client_key)                                               AS client_key_lower,
        COUNT(*)                                                        AS total_leads,
        COUNT(*) FILTER (WHERE current_stage_id = 'qualified')         AS qualificados,
        COUNT(*) FILTER (WHERE current_stage_id = 'lost')              AS perdidos,
        COUNT(*) FILTER (WHERE current_stage_id = 'completed')         AS concluidos,
        COUNT(*) FILTER (
          WHERE ad_id IS NULL
             OR trim(ad_id::text) = ''
             OR trim(ad_id::text) = 'null'
        )                                                               AS sem_atribuicao,
        COUNT(*) FILTER (
          WHERE ad_id IS NOT NULL
            AND trim(ad_id::text) <> ''
            AND trim(ad_id::text) <> 'null'
        )                                                               AS com_atribuicao
      FROM impulso.lead_current
      WHERE lower(client_key) = ANY(${lowerKeys})
        AND created_at_crm::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY lower(client_key)
    `;

    const result = new Map<string, CrmFunil>();
    for (const r of rows) {
      const key = r.client_key_lower;
      result.set(key, {
        clientKey: key,
        totalLeads: toInt(r.total_leads),
        qualificados: toInt(r.qualificados),
        perdidos: toInt(r.perdidos),
        concluidos: toInt(r.concluidos),
        semAtribuicao: toInt(r.sem_atribuicao),
        comAtribuicao: toInt(r.com_atribuicao),
      });
    }
    return result;
  } catch (err) {
    console.error("[DB] getCrmFunilMultiplos:", err);
    return new Map();
  }
}

// ─── Leads por campanha ───────────────────────────────────────────────────────

/**
 * Retorna quantos leads de cada campanha vieram para este cliente no período.
 * Faz join de impulso.lead_current.ad_id com fb_meta_insights_ads.ad_id
 * para resolver qual campanha gerou cada lead.
 */
export async function getCrmLeadsPorCampanha(
  clientKey: string,
  from: string,
  to: string,
): Promise<LeadCampanha[]> {
  type Row = {
    campaign_id: string;
    campaign_name: string;
    leads: bigint | number;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        COALESCE(acm.campaign_id, 'sem_campanha')   AS campaign_id,
        COALESCE(acm.campaign_name, 'Sem atribuição de campanha') AS campaign_name,
        COUNT(*)                                    AS leads
      FROM impulso.lead_current lc
      LEFT JOIN (
        SELECT DISTINCT
          lower(client_key)  AS ck,
          trim(ad_id::text)  AS ad_id,
          campaign_id,
          campaign_name
        FROM fb_meta_insights_ads
        WHERE lower(client_key) = lower(${clientKey})
          AND ad_id IS NOT NULL
          AND trim(ad_id::text) <> ''
          AND trim(ad_id::text) <> 'null'
      ) acm
        ON acm.ck  = lower(lc.client_key)
       AND acm.ad_id = trim(lc.ad_id::text)
      WHERE lower(lc.client_key) = lower(${clientKey})
        AND lc.ad_id IS NOT NULL
        AND trim(lc.ad_id::text) <> ''
        AND trim(lc.ad_id::text) <> 'null'
        AND lc.created_at_crm::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY
        COALESCE(acm.campaign_id, 'sem_campanha'),
        COALESCE(acm.campaign_name, 'Sem atribuição de campanha')
      ORDER BY leads DESC, campaign_name
    `;

    return rows.map((r) => ({
      campanhaId: r.campaign_id,
      campanhaNome: r.campaign_name,
      leads: toInt(r.leads),
    }));
  } catch (err) {
    console.error("[DB] getCrmLeadsPorCampanha:", err);
    return [];
  }
}

// ─── Meta Ads do banco ────────────────────────────────────────────────────────

/**
 * Retorna métricas Meta Ads direto do banco (fb_meta_insights).
 * Mais rápido e sem rate limit. Usa os dados que o workflow SYNC já salvou.
 */
export async function getMetaInsightsDB(
  clientKey: string,
  from: string,
  to: string,
): Promise<MetaInsightsDB> {
  type Row = {
    spend: number | string;
    reach: number | string;
    conv_msg_conversations: number | string;
    conv_purchase_count: number | string;
    conv_link_clicks: number | string;
    conv_profile_visits: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        COALESCE(SUM(spend), 0)                   AS spend,
        COALESCE(SUM(reach), 0)                   AS reach,
        COALESCE(SUM(conv_msg_conversations), 0)  AS conv_msg_conversations,
        COALESCE(SUM(conv_purchase_count), 0)     AS conv_purchase_count,
        COALESCE(SUM(conv_link_clicks), 0)        AS conv_link_clicks,
        COALESCE(SUM(conv_profile_visits), 0)     AS conv_profile_visits
      FROM fb_meta_insights
      WHERE lower(client_key) = lower(${clientKey})
        AND date::date BETWEEN ${from}::date AND ${to}::date
    `;

    const r = rows[0];
    if (!r) return emptyMetaInsightsDB();

    const msgConvs    = toFloat(r.conv_msg_conversations);
    const purchases   = toFloat(r.conv_purchase_count);
    const linkClicks  = toFloat(r.conv_link_clicks);
    const profVisits  = toFloat(r.conv_profile_visits);

    // Mesma hierarquia do relatório semanal
    let tipoResultado: string;
    if (purchases > 0)       tipoResultado = "Compras";
    else if (msgConvs > 0)   tipoResultado = "Conversas iniciadas";
    else if (linkClicks > 0) tipoResultado = "Cliques no link";
    else if (profVisits > 0) tipoResultado = "Visitas ao perfil";
    else                     tipoResultado = "";

    return {
      spend: toFloat(r.spend),
      reach: toFloat(r.reach),
      convMsgConversations: msgConvs,
      convPurchaseCount: purchases,
      convLinkClicks: linkClicks,
      tipoResultado,
    };
  } catch (err) {
    console.error("[DB] getMetaInsightsDB:", err);
    return emptyMetaInsightsDB();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toInt(v: bigint | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  return Math.round(Number(v));
}

function toFloat(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function emptyFunil(clientKey: string): CrmFunil {
  return {
    clientKey,
    totalLeads: 0,
    qualificados: 0,
    perdidos: 0,
    concluidos: 0,
    semAtribuicao: 0,
    comAtribuicao: 0,
  };
}

function emptyMetaInsightsDB(): MetaInsightsDB {
  return {
    spend: 0,
    reach: 0,
    convMsgConversations: 0,
    convPurchaseCount: 0,
    convLinkClicks: 0,
    tipoResultado: "",
  };
}
