// Sincroniza métricas de campanhas e anúncios Meta Ads direto nas tabelas
// fb_meta_insights e fb_meta_insights_ads.
// Substitui os workflows n8n [SYNC-META-MÉTRICAS] e [SYNC-META-MÉTRICAS-ADS].

import { db } from "@/lib/db";

const GRAPH_VERSION = "v21.0";

type Action = { action_type: string; value: string };

function getAction(actions: Action[], ...types: string[]): number {
  for (const t of types) {
    const a = actions.find((x) => x.action_type === t);
    if (a) return parseFloat(a.value) || 0;
  }
  return 0;
}

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

const ALL_STATUSES = ["ACTIVE","PAUSED","DELETED","ARCHIVED","CAMPAIGN_PAUSED","ADSET_PAUSED","DISAPPROVED","PENDING_REVIEW","PREAPPROVED","PENDING_BILLING_INFO","WITH_ISSUES","IN_PROCESS"];

async function fetchInsights(
  accountId: string,
  level: "campaign" | "ad",
  fields: string,
  from: string,
  to: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const statusField = level === "campaign" ? "campaign.effective_status" : "ad.effective_status";
  const filtering = JSON.stringify([{ field: statusField, operator: "IN", value: ALL_STATUSES }]);

  let nextUrl: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights` +
    `?level=${level}&time_increment=1` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: from, until: to }))}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&filtering=${encodeURIComponent(filtering)}` +
    `&limit=500`;

  const all: Record<string, unknown>[] = [];
  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(`Meta API ${level}: ${json.error?.message ?? res.status}`);
    }
    all.push(...((json.data as Record<string, unknown>[]) ?? []));
    nextUrl = (json.paging?.next as string) ?? null;
  }
  return all;
}

export type MetaMetricasSyncResult = {
  total: number;
  sucesso: number;
  falhou: number;
  linhasInseridas: number;
  duracaoMs: number;
  erros: { cliente: string; erro: string }[];
};

export async function sincronizarMetricasMeta(
  from: string,
  to: string,
): Promise<MetaMetricasSyncResult> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

  const inicio = Date.now();
  const erros: { cliente: string; erro: string }[] = [];
  let sucesso = 0, falhou = 0, linhasInseridas = 0;

  const contas = await db.clienteAtivo.findMany({
    where: { ativo: true, metaAdAccountId: { not: null } },
    select: {
      metaAdAccountId: true,
      cliente: { select: { n8nClientKey: true, nome: true } },
    },
  });

  const contasValidas = contas.filter((c) => c.cliente?.n8nClientKey);

  for (const conta of contasValidas) {
    const accountId = conta.metaAdAccountId!;
    const clientKey = conta.cliente!.n8nClientKey!;
    const nome = conta.cliente!.nome ?? clientKey;

    try {
      // ── Campanhas ────────────────────────────────────────────────────────
      const campanhas = await fetchInsights(
        accountId, "campaign",
        "campaign_id,campaign_name,objective,spend,reach,impressions,clicks,frequency,actions,date_start",
        from, to, token,
      );

      for (const c of campanhas) {
        const actions = (c.actions as Action[]) ?? [];
        const date = (c.date_start as string) ?? from;
        const convMsg      = getAction(actions, "onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d");
        const convPurchase = getAction(actions, "offsite_conversion.fb_pixel_purchase", "purchase");
        const convLink     = getAction(actions, "link_click");
        const convProfile  = getAction(actions, "page_engagement");

        await db.$executeRaw`
          INSERT INTO fb_meta_insights
            (client_key, date, account_id, campaign_id, campaign_name, objective,
             spend, reach, impressions, clicks, frequency,
             conv_msg_conversations, conv_purchase_count, conv_link_clicks, conv_profile_visits)
          VALUES
            (${clientKey}, ${date}::date, ${accountId},
             ${c.campaign_id as string}, ${c.campaign_name as string}, ${(c.objective as string) ?? null},
             ${toNum(c.spend)}, ${toNum(c.reach)}, ${toNum(c.impressions)}, ${toNum(c.clicks)},
             ${toNum(c.frequency)}, ${convMsg}, ${convPurchase}, ${convLink}, ${convProfile})
          ON CONFLICT (client_key, date, campaign_id) DO UPDATE SET
            account_id             = EXCLUDED.account_id,
            campaign_name          = EXCLUDED.campaign_name,
            objective              = EXCLUDED.objective,
            spend                  = EXCLUDED.spend,
            reach                  = EXCLUDED.reach,
            impressions            = EXCLUDED.impressions,
            clicks                 = EXCLUDED.clicks,
            frequency              = EXCLUDED.frequency,
            conv_msg_conversations = EXCLUDED.conv_msg_conversations,
            conv_purchase_count    = EXCLUDED.conv_purchase_count,
            conv_link_clicks       = EXCLUDED.conv_link_clicks,
            conv_profile_visits    = EXCLUDED.conv_profile_visits
        `;
        linhasInseridas++;
      }

      // ── Anúncios ─────────────────────────────────────────────────────────
      const anuncios = await fetchInsights(
        accountId, "ad",
        "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,objective,spend,reach,impressions,clicks,actions,date_start",
        from, to, token,
      );

      for (const a of anuncios) {
        const actions = (a.actions as Action[]) ?? [];
        const date = (a.date_start as string) ?? from;
        const convMsg      = getAction(actions, "onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d");
        const convPurchase = getAction(actions, "offsite_conversion.fb_pixel_purchase", "purchase");
        const convLink     = getAction(actions, "link_click");
        const convProfile  = getAction(actions, "page_engagement");

        await db.$executeRaw`
          INSERT INTO fb_meta_insights_ads
            (client_key, date, account_id, ad_id, ad_name, adset_id, adset_name,
             campaign_id, campaign_name, objective,
             spend, reach, impressions, clicks,
             conv_msg_conversations, conv_purchase_count, conv_link_clicks, conv_profile_visits)
          VALUES
            (${clientKey}, ${date}::date, ${accountId},
             ${a.ad_id as string}, ${a.ad_name as string},
             ${a.adset_id as string}, ${a.adset_name as string},
             ${a.campaign_id as string}, ${a.campaign_name as string}, ${(a.objective as string) ?? null},
             ${toNum(a.spend)}, ${toNum(a.reach)}, ${toNum(a.impressions)}, ${toNum(a.clicks)},
             ${convMsg}, ${convPurchase}, ${convLink}, ${convProfile})
          ON CONFLICT (client_key, date, ad_id) DO UPDATE SET
            account_id             = EXCLUDED.account_id,
            ad_name                = EXCLUDED.ad_name,
            adset_id               = EXCLUDED.adset_id,
            adset_name             = EXCLUDED.adset_name,
            campaign_id            = EXCLUDED.campaign_id,
            campaign_name          = EXCLUDED.campaign_name,
            objective              = EXCLUDED.objective,
            spend                  = EXCLUDED.spend,
            reach                  = EXCLUDED.reach,
            impressions            = EXCLUDED.impressions,
            clicks                 = EXCLUDED.clicks,
            conv_msg_conversations = EXCLUDED.conv_msg_conversations,
            conv_purchase_count    = EXCLUDED.conv_purchase_count,
            conv_link_clicks       = EXCLUDED.conv_link_clicks,
            conv_profile_visits    = EXCLUDED.conv_profile_visits
        `;
        linhasInseridas++;
      }

      sucesso++;
    } catch (err) {
      falhou++;
      erros.push({ cliente: nome, erro: String(err) });
      console.error(`[SYNC-META-MÉTRICAS] ${nome}:`, err);
    }
  }

  return { total: contasValidas.length, sucesso, falhou, linhasInseridas, duracaoMs: Date.now() - inicio, erros };
}
