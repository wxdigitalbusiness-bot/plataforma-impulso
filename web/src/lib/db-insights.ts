/**
 * db-insights.ts
 *
 * Queries diretas nas tabelas populadas pelos workflows n8n:
 *  - fb_meta_insights       → métricas diárias de Meta Ads por campanha/cliente
 *  - fb_meta_insights_ads   → métricas diárias de Meta Ads por anúncio
 *  - google_ads_insights    → métricas diárias de Google Ads por campanha/cliente
 *  - impulso.lead_current   → estado atual de cada lead do CRM
 *
 * Essas tabelas NÃO estão no Prisma schema (são populadas pelo n8n).
 * Usamos $queryRaw com tagged template literals para segurança.
 *
 * Correspondência de chaves:
 *  Cliente.n8nClientKey  ↔  fb_meta_insights.client_key
 *                        ↔  google_ads_insights.client_key
 *                        ↔  impulso.lead_current.client_key
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Funil CRM de um cliente para um período */
export type CrmFunil = {
  clientKey: string;
  totalLeads: number;
  qualificados: number;
  perdidos: number;
  concluidos: number;
  semAtribuicao: number;
  comAtribuicao: number;
};

/** Leads por campanha Meta Ads (via ad_id → campaign) */
export type LeadCampanha = {
  campanhaId: string;
  campanhaNome: string;
  leads: number;
};

/** Métricas Meta Ads do banco — agregadas por client_key + período */
export type MetaInsightsDB = {
  spend: number;
  reach: number;
  impressoes: number;
  cliques: number;
  conversoes: number;               // = conv_purchase_count + conv_msg_conversations
  convMsgConversations: number;
  convPurchaseCount: number;
  convLinkClicks: number;
  tipoResultado: string;
};

/** Métricas Google Ads do banco — agregadas por client_key + período */
export type GoogleInsightsDB = {
  spend: number;
  impressoes: number;
  cliques: number;
  conversoes: number;
};

/** Métricas de um conjunto de anúncios Meta (agregado do período) */
export type MetaAdsetDB = {
  adsetId: string;
  adsetNome: string;
  campanhaId: string;
  campanhaNome: string;
  objective: string | null;
  spend: number;
  impressoes: number;
  cliques: number;
  reach: number;
  convMsgConversations: number;
  convPurchaseCount: number;
  convLinkClicks: number;
  convProfileVisits: number;
  conversoes: number;
  tipoResultado: string;
};

/** Métricas de um anúncio Meta (agregado do período) */
export type MetaAdDB = {
  adId: string;
  adNome: string;
  adsetId: string;
  campanhaId: string;
  campanhaNome: string;
  objective: string | null;
  spend: number;
  impressoes: number;
  cliques: number;
  reach: number;
  convMsgConversations: number;
  convPurchaseCount: number;
  convLinkClicks: number;
  convProfileVisits: number;
  conversoes: number;
  tipoResultado: string;
};

// ─── Helpers públicos ─────────────────────────────────────────────────────────

export function emptyMetaInsightsDB(): MetaInsightsDB {
  return {
    spend: 0, reach: 0, impressoes: 0, cliques: 0, conversoes: 0,
    convMsgConversations: 0, convPurchaseCount: 0, convLinkClicks: 0,
    tipoResultado: "",
  };
}

export function emptyGoogleInsightsDB(): GoogleInsightsDB {
  return { spend: 0, impressoes: 0, cliques: 0, conversoes: 0 };
}

// ─── CRM: funil de um cliente ─────────────────────────────────────────────────

export async function getCrmFunil(
  clientKey: string,
  from: string,
  to: string,
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
      totalLeads:    toInt(r.total_leads),
      qualificados:  toInt(r.qualificados),
      perdidos:      toInt(r.perdidos),
      concluidos:    toInt(r.concluidos),
      semAtribuicao: toInt(r.sem_atribuicao),
      comAtribuicao: toInt(r.com_atribuicao),
    };
  } catch (err) {
    console.error("[DB] getCrmFunil:", err);
    return emptyFunil(clientKey);
  }
}

export async function getCrmFunilMultiplos(
  clientKeys: string[],
  from: string,
  to: string,
): Promise<Map<string, CrmFunil>> {
  if (clientKeys.length === 0) return new Map();

  const lowerKeys = clientKeys.map((k) => k.toLowerCase());

  type Row = {
    client_key_lower: string;
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
      result.set(r.client_key_lower, {
        clientKey:     r.client_key_lower,
        totalLeads:    toInt(r.total_leads),
        qualificados:  toInt(r.qualificados),
        perdidos:      toInt(r.perdidos),
        concluidos:    toInt(r.concluidos),
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
        COALESCE(acm.campaign_id, 'sem_campanha')                      AS campaign_id,
        COALESCE(acm.campaign_name, 'Sem atribuição de campanha')       AS campaign_name,
        COUNT(*)                                                         AS leads
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
        ON acm.ck    = lower(lc.client_key)
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
      campanhaId:   r.campaign_id,
      campanhaNome: r.campaign_name,
      leads:        toInt(r.leads),
    }));
  } catch (err) {
    console.error("[DB] getCrmLeadsPorCampanha:", err);
    return [];
  }
}

// ─── Meta Ads: cliente único ──────────────────────────────────────────────────

export async function getMetaInsightsDB(
  clientKey: string,
  from: string,
  to: string,
): Promise<MetaInsightsDB> {
  type Row = {
    spend: number | string;
    reach: number | string;
    impressions: number | string;
    clicks: number | string;
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
        COALESCE(SUM(impressions), 0)             AS impressions,
        COALESCE(SUM(clicks), 0)                  AS clicks,
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
    return rowToMetaInsightsDB(r);
  } catch (err) {
    console.error("[DB] getMetaInsightsDB:", err);
    return emptyMetaInsightsDB();
  }
}

// ─── Meta Ads: batch (múltiplos clientes) ────────────────────────────────────

export async function getMetaInsightsDBMultiplos(
  clientKeys: string[],
  from: string,
  to: string,
): Promise<Map<string, MetaInsightsDB>> {
  if (clientKeys.length === 0) return new Map();

  const lowerKeys = clientKeys.map((k) => k.toLowerCase());

  type Row = {
    client_key_lower: string;
    spend: number | string;
    reach: number | string;
    impressions: number | string;
    clicks: number | string;
    conv_msg_conversations: number | string;
    conv_purchase_count: number | string;
    conv_link_clicks: number | string;
    conv_profile_visits: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        lower(client_key)                         AS client_key_lower,
        COALESCE(SUM(spend), 0)                   AS spend,
        COALESCE(SUM(reach), 0)                   AS reach,
        COALESCE(SUM(impressions), 0)             AS impressions,
        COALESCE(SUM(clicks), 0)                  AS clicks,
        COALESCE(SUM(conv_msg_conversations), 0)  AS conv_msg_conversations,
        COALESCE(SUM(conv_purchase_count), 0)     AS conv_purchase_count,
        COALESCE(SUM(conv_link_clicks), 0)        AS conv_link_clicks,
        COALESCE(SUM(conv_profile_visits), 0)     AS conv_profile_visits
      FROM fb_meta_insights
      WHERE lower(client_key) = ANY(${lowerKeys})
        AND date::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY lower(client_key)
    `;

    const result = new Map<string, MetaInsightsDB>();
    for (const r of rows) {
      result.set(r.client_key_lower, rowToMetaInsightsDB(r));
    }
    return result;
  } catch (err) {
    console.error("[DB] getMetaInsightsDBMultiplos:", err);
    return new Map();
  }
}

// ─── Meta Ads: campanhas de um cliente (página individual) ───────────────────

export type MetaCampanhaDB = {
  campanhaId: string;
  campanhaNome: string;
  objective: string | null;
  spend: number;
  impressoes: number;
  cliques: number;
  reach: number;
  frequencia: number;
  ctr: number;
  cpc: number;
  convMsgConversations: number;
  convPurchaseCount: number;
  convLinkClicks: number;
  convProfileVisits: number;
  conversoes: number;       // resultado principal (escolhido por objective)
  tipoResultado: string;
};

export async function getMetaInsightsPorCampanhaDB(
  clientKey: string,
  from: string,
  to: string,
): Promise<MetaCampanhaDB[]> {
  type Row = {
    campaign_id: string;
    campaign_name: string;
    objective: string | null;
    spend: number | string;
    reach: number | string;
    impressions: number | string;
    clicks: number | string;
    conv_msg: number | string;
    conv_purchase: number | string;
    conv_link: number | string;
    conv_profile: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        campaign_id,
        MAX(campaign_name)                        AS campaign_name,
        MAX(objective)                            AS objective,
        COALESCE(SUM(spend), 0)                   AS spend,
        COALESCE(SUM(reach), 0)                   AS reach,
        COALESCE(SUM(impressions), 0)             AS impressions,
        COALESCE(SUM(clicks), 0)                  AS clicks,
        COALESCE(SUM(conv_msg_conversations), 0)  AS conv_msg,
        COALESCE(SUM(conv_purchase_count), 0)     AS conv_purchase,
        COALESCE(SUM(conv_link_clicks), 0)        AS conv_link,
        COALESCE(SUM(conv_profile_visits), 0)     AS conv_profile
      FROM fb_meta_insights
      WHERE lower(client_key) = lower(${clientKey})
        AND date::date BETWEEN ${from}::date AND ${to}::date
        AND campaign_id IS NOT NULL
      GROUP BY campaign_id
      ORDER BY SUM(spend) DESC
    `;

    return rows.map((r) => {
      const spend      = toFloat(r.spend);
      const impressoes = toFloat(r.impressions);
      const cliques    = toFloat(r.clicks);
      const reach      = toFloat(r.reach);
      const convMsg    = toFloat(r.conv_msg);
      const convPurch  = toFloat(r.conv_purchase);
      const convLink   = toFloat(r.conv_link);
      const convProf   = toFloat(r.conv_profile);

      const { tipoResultado, conversoes } = derivarResultadoPrincipal(
        r.objective, r.campaign_name ?? "", convPurch, convMsg, convLink,
      );

      return {
        campanhaId:          r.campaign_id,
        campanhaNome:        r.campaign_name ?? "",
        objective:           r.objective ?? null,
        spend,
        impressoes,
        cliques,
        reach,
        frequencia:          reach > 0 ? round2(impressoes / reach) : 0,
        ctr:                 impressoes > 0 ? round2((cliques / impressoes) * 100) : 0,
        cpc:                 cliques > 0 ? round2(spend / cliques) : 0,
        convMsgConversations: convMsg,
        convPurchaseCount:   convPurch,
        convLinkClicks:      convLink,
        convProfileVisits:   convProf,
        conversoes,
        tipoResultado,
      };
    });
  } catch (err) {
    console.error("[DB] getMetaInsightsPorCampanhaDB:", err);
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type MetricaConv = "purchase" | "msg" | "link";

const LABEL_METRICA: Record<MetricaConv, string> = {
  purchase: "Compras",
  msg:      "Conversas iniciadas",
  link:     "Cliques no link",
};

/** Detecta se o destino da campanha de tráfego é o perfil do Instagram pelo nome. */
function nomeIndicaTrafegoParaPerfil(campanhaNome: string): boolean {
  const n = (campanhaNome ?? "").toLowerCase();
  return n.includes("perfil") || n.includes("profile") || /\binstagram\b|\big\b/.test(n);
}

/**
 * Escolhe a métrica principal de acordo com o objective da campanha.
 * Quando objective é null ou desconhecido, faz fallback para prioridade legada.
 *
 * IMPORTANTE: page_engagement (column conv_profile_visits) NÃO é usado mais —
 * ele agrega likes/saves/reactions e não corresponde ao que Ads Manager
 * chama de "Visitas ao perfil". Pra campanhas LINK_CLICKS direcionadas ao
 * perfil IG, o número correto é o `link_click` (campo conv_link_clicks).
 */
function metricaPorObjective(
  objective: string | null,
  convPurch: number,
  convMsg: number,
  convLink: number,
): MetricaConv | null {
  const obj = (objective ?? "").toUpperCase();

  if (obj === "OUTCOME_SALES" || obj === "CONVERSIONS" || obj === "PRODUCT_CATALOG_SALES") {
    return "purchase";
  }
  if (obj === "OUTCOME_MESSAGES" || obj === "MESSAGES") {
    return "msg";
  }
  if (
    obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS" || obj === "WEBSITE_CLICKS" ||
    obj === "OUTCOME_ENGAGEMENT" || obj === "POST_ENGAGEMENT" || obj === "PAGE_LIKES" || obj === "EVENT_RESPONSES"
  ) {
    return "link";
  }

  // Fallback (objective null/desconhecido): purchase > msg > link.
  if (convPurch > 0) return "purchase";
  if (convMsg   > 0) return "msg";
  if (convLink  > 0) return "link";
  return null;
}

function valorMetrica(
  m: MetricaConv | null,
  convPurch: number,
  convMsg: number,
  convLink: number,
): number {
  switch (m) {
    case "purchase": return convPurch;
    case "msg":      return convMsg;
    case "link":     return convLink;
    default:         return 0;
  }
}

/** Label final levando em conta heurística de "tráfego ao perfil" pelo nome. */
function labelFinal(m: MetricaConv, objective: string | null, campanhaNome: string): string {
  const obj = (objective ?? "").toUpperCase();
  const ehTrafego = obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS" || obj === "WEBSITE_CLICKS";
  if (m === "link" && ehTrafego && nomeIndicaTrafegoParaPerfil(campanhaNome)) {
    return "Visitas ao perfil";
  }
  return LABEL_METRICA[m];
}

/** Resultado principal escolhido pelo objective (com fallback). */
function derivarResultadoPrincipal(
  objective: string | null,
  campanhaNome: string,
  convPurch: number,
  convMsg: number,
  convLink: number,
): { tipoResultado: string; conversoes: number; metricaPrincipal: MetricaConv | null } {
  const m = metricaPorObjective(objective, convPurch, convMsg, convLink);
  if (m === null) return { tipoResultado: "", conversoes: 0, metricaPrincipal: null };
  return {
    tipoResultado:    labelFinal(m, objective, campanhaNome),
    conversoes:       valorMetrica(m, convPurch, convMsg, convLink),
    metricaPrincipal: m,
  };
}

// ─── Google Ads: batch (múltiplos clientes) ───────────────────────────────────

export async function getGoogleInsightsDBMultiplos(
  clientKeys: string[],
  from: string,
  to: string,
): Promise<Map<string, GoogleInsightsDB>> {
  if (clientKeys.length === 0) return new Map();

  const lowerKeys = clientKeys.map((k) => k.toLowerCase());

  type Row = {
    client_key_lower: string;
    spend: number | string;
    impressions: number | string;
    clicks: number | string;
    conversions: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        lower(client_key)             AS client_key_lower,
        COALESCE(SUM(spend), 0)       AS spend,
        COALESCE(SUM(impressions), 0) AS impressions,
        COALESCE(SUM(clicks), 0)      AS clicks,
        COALESCE(SUM(conversions), 0) AS conversions
      FROM google_ads_insights
      WHERE lower(client_key) = ANY(${lowerKeys})
        AND date::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY lower(client_key)
    `;

    const result = new Map<string, GoogleInsightsDB>();
    for (const r of rows) {
      result.set(r.client_key_lower, {
        spend:     toFloat(r.spend),
        impressoes: toFloat(r.impressions),
        cliques:   toFloat(r.clicks),
        conversoes: toFloat(r.conversions),
      });
    }
    return result;
  } catch (err) {
    console.error("[DB] getGoogleInsightsDBMultiplos:", err);
    return new Map();
  }
}

// ─── Google Ads: por customer_id (página individual) ─────────────────────────

export async function getGoogleInsightsDBPorCustomerIds(
  customerIds: string[],
  from: string,
  to: string,
): Promise<Map<string, GoogleInsightsDB>> {
  if (customerIds.length === 0) return new Map();

  const cleanIds = customerIds.map((id) => id.replace(/-/g, ""));

  type Row = {
    customer_id: string;
    spend: number | string;
    impressions: number | string;
    clicks: number | string;
    conversions: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        customer_id,
        COALESCE(SUM(spend), 0)       AS spend,
        COALESCE(SUM(impressions), 0) AS impressions,
        COALESCE(SUM(clicks), 0)      AS clicks,
        COALESCE(SUM(conversions), 0) AS conversions
      FROM google_ads_insights
      WHERE customer_id = ANY(${cleanIds})
        AND date::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY customer_id
    `;

    const result = new Map<string, GoogleInsightsDB>();
    for (const r of rows) {
      result.set(r.customer_id, {
        spend:     toFloat(r.spend),
        impressoes: toFloat(r.impressions),
        cliques:   toFloat(r.clicks),
        conversoes: toFloat(r.conversions),
      });
    }
    return result;
  } catch (err) {
    console.error("[DB] getGoogleInsightsDBPorCustomerIds:", err);
    return new Map();
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

type MetaRow = {
  spend: number | string;
  reach: number | string;
  impressions: number | string;
  clicks: number | string;
  conv_msg_conversations: number | string;
  conv_purchase_count: number | string;
  conv_link_clicks: number | string;
  conv_profile_visits: number | string;
};

function rowToMetaInsightsDB(r: MetaRow): MetaInsightsDB {
  const msgConvs   = toFloat(r.conv_msg_conversations);
  const purchases  = toFloat(r.conv_purchase_count);
  const linkClicks = toFloat(r.conv_link_clicks);
  const profVisits = toFloat(r.conv_profile_visits);

  let tipoResultado: string;
  if (purchases > 0)       tipoResultado = "Compras";
  else if (msgConvs > 0)   tipoResultado = "Conversas iniciadas";
  else if (linkClicks > 0) tipoResultado = "Cliques no link";
  else if (profVisits > 0) tipoResultado = "Visitas ao perfil";
  else                     tipoResultado = "";

  return {
    spend:               toFloat(r.spend),
    reach:               toFloat(r.reach),
    impressoes:          toFloat(r.impressions),
    cliques:             toFloat(r.clicks),
    conversoes:          purchases + msgConvs,
    convMsgConversations: msgConvs,
    convPurchaseCount:   purchases,
    convLinkClicks:      linkClicks,
    tipoResultado,
  };
}

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
    clientKey, totalLeads: 0, qualificados: 0, perdidos: 0,
    concluidos: 0, semAtribuicao: 0, comAtribuicao: 0,
  };
}

// ─── Meta Ads: conjuntos de anúncios (adsets) ─────────────────────────────────

/**
 * Retorna métricas por conjunto de anúncio agregadas no período.
 * Fonte: fb_meta_insights_ads (agrupado por adset_id).
 */
export async function getMetaAdsetsDB(
  clientKey: string,
  from: string,
  to: string,
): Promise<MetaAdsetDB[]> {
  type Row = {
    adset_id: string;
    adset_name: string;
    campaign_id: string;
    campaign_name: string | null;
    objective: string | null;
    spend: number | string;
    impressions: number | string;
    clicks: number | string;
    reach: number | string;
    conv_msg: number | string;
    conv_purchase: number | string;
    conv_link: number | string;
    conv_profile: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        adset_id,
        MAX(adset_name)                           AS adset_name,
        MAX(campaign_id)                          AS campaign_id,
        MAX(campaign_name)                        AS campaign_name,
        MAX(objective)                            AS objective,
        COALESCE(SUM(spend), 0)                   AS spend,
        COALESCE(SUM(impressions), 0)             AS impressions,
        COALESCE(SUM(clicks), 0)                  AS clicks,
        COALESCE(SUM(reach), 0)                   AS reach,
        COALESCE(SUM(conv_msg_conversations), 0)  AS conv_msg,
        COALESCE(SUM(conv_purchase_count), 0)     AS conv_purchase,
        COALESCE(SUM(conv_link_clicks), 0)        AS conv_link,
        COALESCE(SUM(conv_profile_visits), 0)     AS conv_profile
      FROM fb_meta_insights_ads
      WHERE lower(client_key) = lower(${clientKey})
        AND date::date BETWEEN ${from}::date AND ${to}::date
        AND adset_id IS NOT NULL
      GROUP BY adset_id
      ORDER BY SUM(spend) DESC
    `;

    return rows.map((r) => {
      const convMsg   = toFloat(r.conv_msg);
      const convPurch = toFloat(r.conv_purchase);
      const convLink  = toFloat(r.conv_link);
      const convProf  = toFloat(r.conv_profile);
      const campNome  = r.campaign_name ?? "";
      const { tipoResultado, conversoes } = derivarResultadoPrincipal(
        r.objective, campNome, convPurch, convMsg, convLink,
      );

      return {
        adsetId:              r.adset_id,
        adsetNome:            r.adset_name ?? r.adset_id,
        campanhaId:           r.campaign_id ?? "",
        campanhaNome:         campNome,
        objective:            r.objective ?? null,
        spend:                toFloat(r.spend),
        impressoes:           toFloat(r.impressions),
        cliques:              toFloat(r.clicks),
        reach:                toFloat(r.reach),
        convMsgConversations: convMsg,
        convPurchaseCount:    convPurch,
        convLinkClicks:       convLink,
        convProfileVisits:    convProf,
        conversoes,
        tipoResultado,
      };
    });
  } catch (err) {
    console.error("[DB] getMetaAdsetsDB:", err);
    return [];
  }
}

// ─── Meta Ads: anúncios ───────────────────────────────────────────────────────

/**
 * Retorna métricas por anúncio agregadas no período.
 * Fonte: fb_meta_insights_ads (agrupado por ad_id).
 */
export async function getMetaAdsDB(
  clientKey: string,
  from: string,
  to: string,
): Promise<MetaAdDB[]> {
  type Row = {
    ad_id: string;
    ad_name: string;
    adset_id: string;
    campaign_id: string;
    campaign_name: string | null;
    objective: string | null;
    spend: number | string;
    impressions: number | string;
    clicks: number | string;
    reach: number | string;
    conv_msg: number | string;
    conv_purchase: number | string;
    conv_link: number | string;
    conv_profile: number | string;
  };

  try {
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        ad_id,
        MAX(ad_name)                              AS ad_name,
        MAX(adset_id)                             AS adset_id,
        MAX(campaign_id)                          AS campaign_id,
        MAX(campaign_name)                        AS campaign_name,
        MAX(objective)                            AS objective,
        COALESCE(SUM(spend), 0)                   AS spend,
        COALESCE(SUM(impressions), 0)             AS impressions,
        COALESCE(SUM(clicks), 0)                  AS clicks,
        COALESCE(SUM(reach), 0)                   AS reach,
        COALESCE(SUM(conv_msg_conversations), 0)  AS conv_msg,
        COALESCE(SUM(conv_purchase_count), 0)     AS conv_purchase,
        COALESCE(SUM(conv_link_clicks), 0)        AS conv_link,
        COALESCE(SUM(conv_profile_visits), 0)     AS conv_profile
      FROM fb_meta_insights_ads
      WHERE lower(client_key) = lower(${clientKey})
        AND date::date BETWEEN ${from}::date AND ${to}::date
        AND ad_id IS NOT NULL
      GROUP BY ad_id
      ORDER BY SUM(spend) DESC
    `;

    return rows.map((r) => {
      const convMsg   = toFloat(r.conv_msg);
      const convPurch = toFloat(r.conv_purchase);
      const convLink  = toFloat(r.conv_link);
      const convProf  = toFloat(r.conv_profile);
      const campNome  = r.campaign_name ?? "";
      const { tipoResultado, conversoes } = derivarResultadoPrincipal(
        r.objective, campNome, convPurch, convMsg, convLink,
      );

      return {
        adId:                 r.ad_id,
        adNome:               r.ad_name ?? r.ad_id,
        adsetId:              r.adset_id ?? "",
        campanhaId:           r.campaign_id ?? "",
        campanhaNome:         campNome,
        objective:            r.objective ?? null,
        spend:                toFloat(r.spend),
        impressoes:           toFloat(r.impressions),
        cliques:              toFloat(r.clicks),
        reach:                toFloat(r.reach),
        convMsgConversations: convMsg,
        convPurchaseCount:    convPurch,
        convLinkClicks:       convLink,
        convProfileVisits:    convProf,
        conversoes,
        tipoResultado,
      };
    });
  } catch (err) {
    console.error("[DB] getMetaAdsDB:", err);
    return [];
  }
}
