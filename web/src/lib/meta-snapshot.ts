// Fetch ao vivo da Meta Marketing API pra montar um snapshot fiel do gerenciador.
// Usado pelo server action que gera relatórios públicos — captura reach deduplicado
// no período (em vez de SUM(reach) diário, que inflaciona) e o campo `results`
// (que dá "Visitas ao perfil = 1.176" igualzinho ao Ads Manager).

const API_VERSION = "v21.0";

const EFFECTIVE_STATUSES = [
  "ACTIVE","PAUSED","DELETED","ARCHIVED","CAMPAIGN_PAUSED","ADSET_PAUSED",
  "DISAPPROVED","PENDING_REVIEW","PREAPPROVED","PENDING_BILLING_INFO",
  "WITH_ISSUES","IN_PROCESS",
];

// ─── Tipos do snapshot ────────────────────────────────────────────────────────

export type ResultadoMeta = {
  indicator: string;         // "profile_visit_view", "actions:link_click", etc
  label: string;             // "Visitas ao perfil", "Cliques no link", etc
  valor: number;
  custoPorResultado: number; // R$ por resultado
};

/** Métricas secundárias relevantes (conversas, cliques, compras, leads) que
 * NÃO foram escolhidas como resultado principal pelo Meta. */
export type Secundaria = {
  label: string;
  valor: number;
};

export type CampanhaSnapshot = {
  campaignId: string;
  campaignName: string;
  objective: string | null;
  effectiveStatus: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpp: number;
  frequency: number;
  resultado: ResultadoMeta | null;
  secundarias: Secundaria[];
};

export type AdsetSnapshot = {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  objective: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpp: number;
  frequency: number;
  resultado: ResultadoMeta | null;
  secundarias: Secundaria[];
};

export type AdSnapshot = {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  objective: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpp: number;
  frequency: number;
  resultado: ResultadoMeta | null;
  secundarias: Secundaria[];
};

export type InstagramSnapshot = {
  igAccountId: string;
  username: string;
  /** Total de seguidores no último dia do período. Null se a métrica não voltar. */
  seguidoresFinal: number | null;
  /** Total de seguidores no primeiro dia do período. */
  seguidoresInicial: number | null;
  /** Delta no período (final - inicial). Pode ser negativo se perdeu seguidores. */
  novosSeguidores: number | null;
  /** Visitas ao perfil totais no período (orgânico + pago). */
  visitasPerfil: number | null;
};

export type Snapshot = {
  geradoEm: string; // ISO
  periodo: { from: string; to: string };
  contas: string[]; // ad_account_ids consultados
  campanhas: CampanhaSnapshot[];
  adsets: AdsetSnapshot[];
  ads: AdSnapshot[];
  /** Métricas da conta do Instagram (orgânico + pago). Null se sem permissão. */
  instagram: InstagramSnapshot[] | null;
};

// ─── Labels para os indicators ────────────────────────────────────────────────

const INDICATOR_LABEL: Record<string, string> = {
  "profile_visit_view":                                            "Visitas ao perfil",
  "actions:onsite_conversion.messaging_conversation_started_7d":   "Conversas iniciadas",
  "actions:link_click":                                            "Cliques no link",
  "actions:omni_purchase":                                         "Compras",
  "actions:offsite_conversion.fb_pixel_purchase":                  "Compras",
  "actions:page_engagement":                                       "Engajamento na página",
  "actions:post_engagement":                                       "Engajamento no post",
  "actions:like":                                                  "Curtidas",
  "actions:post_reaction":                                         "Reações",
  "actions:post_save":                                             "Salvamentos",
  "actions:comment":                                               "Comentários",
  "actions:lead":                                                  "Leads",
  "actions:landing_page_view":                                     "Visualizações da página",
  "actions:video_view":                                            "Visualizações de vídeo",
  "actions:app_install":                                           "Instalações do app",
  "reach":                                                         "Alcance",
  "impressions":                                                   "Impressões",
};

function labelDoIndicator(indicator: string): string {
  return INDICATOR_LABEL[indicator] ?? indicator;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type RawResultsItem = { indicator: string; values?: Array<{ value: string | number }> };
type RawAction      = { action_type: string; value: string | number };

function parseResultado(
  results: RawResultsItem[] | undefined,
  costPerResult: RawResultsItem[] | undefined,
): ResultadoMeta | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const top = results[0];
  const v = top.values?.[0]?.value;
  if (v === undefined || v === null) return null;
  const valor = toNum(v);
  if (valor <= 0) return null;

  const custoEntry = costPerResult?.find((c) => c.indicator === top.indicator);
  const custoRaw   = custoEntry?.values?.[0]?.value;
  const custo      = custoRaw !== undefined ? round2(toNum(custoRaw)) : 0;

  return {
    indicator:        top.indicator,
    label:            labelDoIndicator(top.indicator),
    valor:            Math.round(valor),
    custoPorResultado: custo,
  };
}

/**
 * Extrai métricas SECUNDÁRIAS relevantes de actions[] — conversas, cliques,
 * compras, leads. Filtra pelo action_type que importa pro relatório.
 * O resultado principal (já capturado em `results`) é excluído pra não duplicar.
 */
function parseSecundarias(
  actions: RawAction[] | undefined,
  indicatorPrincipal: string | null,
): Secundaria[] {
  if (!Array.isArray(actions) || actions.length === 0) return [];

  // Mapeamento action_type → label e ordem de relevância.
  // O `like` action_type vem do catálogo oficial Meta descrito como:
  // "The number of followers of your Facebook Page, attributed to your ads"
  // (sim, é mal-nomeado — na verdade é "novos seguidores", não like de post)
  const MAPA: Array<{ types: string[]; label: string; indicator: string }> = [
    {
      types:     ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
      label:     "Compras",
      indicator: "actions:omni_purchase",
    },
    {
      types:     ["lead", "onsite_conversion.lead_grouped"],
      label:     "Leads",
      indicator: "actions:lead",
    },
    {
      types:     ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"],
      label:     "Conversas iniciadas",
      indicator: "actions:onsite_conversion.messaging_conversation_started_7d",
    },
    {
      types:     ["link_click"],
      label:     "Cliques no link",
      indicator: "actions:link_click",
    },
    {
      types:     ["landing_page_view"],
      label:     "Visualizações da página",
      indicator: "actions:landing_page_view",
    },
  ];

  const out: Secundaria[] = [];
  for (const m of MAPA) {
    // Não duplica o resultado principal
    if (m.indicator === indicatorPrincipal) continue;
    let total = 0;
    for (const t of m.types) {
      const found = actions.find((a) => a.action_type === t);
      if (found) { total += toNum(found.value); break; }
    }
    if (total > 0) out.push({ label: m.label, valor: Math.round(total) });
  }
  return out;
}

// ─── Fetch Marketing API ──────────────────────────────────────────────────────

async function fetchInsights(
  adAccountId: string,
  level: "campaign" | "adset" | "ad",
  from: string,
  to: string,
  token: string,
): Promise<RawRow[]> {
  // Campos: incluímos os campos comuns + os específicos por nível.
  // Nota: a Marketing API rejeita pedir campos como ad_id/adset_id no level errado;
  // os campos abaixo são seguros pros 3 níveis.
  const fields = [
    "campaign_id", "campaign_name", "objective",
    ...(level === "adset" || level === "ad" ? ["adset_id", "adset_name"] : []),
    ...(level === "ad"                       ? ["ad_id",    "ad_name"]    : []),
    "spend", "reach", "impressions", "clicks", "frequency", "cpp",
    "results", "cost_per_result", "actions",
  ].join(",");

  const filterField =
    level === "ad"     ? "ad.effective_status" :
    level === "adset"  ? "adset.effective_status" :
                         "campaign.effective_status";

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set("level", level);
  url.searchParams.set("time_range", JSON.stringify({ since: from, until: to }));
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "500");
  url.searchParams.set("filtering", JSON.stringify([{
    field: filterField, operator: "IN", value: EFFECTIVE_STATUSES,
  }]));
  url.searchParams.set("access_token", token);

  const out: RawRow[] = [];
  let next: string | null = url.toString();
  while (next) {
    const r: Response = await fetch(next);
    const j = (await r.json()) as { data?: RawRow[]; paging?: { next?: string }; error?: { message: string } };
    if (j.error) throw new Error(`Meta API (${level}): ${j.error.message}`);
    out.push(...(j.data ?? []));
    next = j.paging?.next ?? null;
  }
  return out;
}

type RawRow = {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  spend?: string | number;
  reach?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  frequency?: string | number;
  cpp?: string | number;
  results?: RawResultsItem[];
  cost_per_result?: RawResultsItem[];
  actions?: RawAction[];
};

function mapBase(r: RawRow) {
  const spend       = round2(toNum(r.spend));
  const reach       = Math.round(toNum(r.reach));
  const impressions = Math.round(toNum(r.impressions));
  const clicks      = Math.round(toNum(r.clicks));
  const frequency   = round2(toNum(r.frequency));
  const cpp         = round2(toNum(r.cpp));
  const ctr         = impressions > 0 ? round2((clicks / impressions) * 100) : 0;
  const cpc         = clicks > 0 ? round2(spend / clicks) : 0;
  return { spend, reach, impressions, clicks, frequency, cpp, ctr, cpc };
}

// ─── Instagram Business Insights ──────────────────────────────────────────────

type IgInsightsValue = { value: number | string; end_time?: string };
type IgInsightsResponse = {
  data?: Array<{ name: string; period: string; values: IgInsightsValue[] }>;
  error?: { message: string; code?: number };
};

/**
 * Busca métricas da conta IG vinculada à conta de ads:
 *   - follower_count → delta do período = novos seguidores (orgânico + pago)
 *   - profile_views   → visitas totais ao perfil no período
 *
 * Requer permissões `instagram_basic` + `instagram_manage_insights` no token.
 * Se permissão estiver faltando, retorna null silenciosamente.
 */
async function fetchIgInsights(
  adAccountId: string,
  from: string,
  to: string,
  token: string,
): Promise<InstagramSnapshot[] | null> {
  // 1. Descobre as contas IG vinculadas à conta de ads
  const igDiscovery = new URL(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/instagram_accounts`);
  igDiscovery.searchParams.set("fields", "id,username");
  igDiscovery.searchParams.set("access_token", token);
  const igResp = await (await fetch(igDiscovery)).json() as {
    data?: Array<{ id: string; username: string }>;
    error?: { message: string };
  };
  if (igResp.error || !igResp.data || igResp.data.length === 0) {
    if (igResp.error) console.warn(`[IG insights] discovery failed: ${igResp.error.message}`);
    return null;
  }

  const out: InstagramSnapshot[] = [];

  // Helper pra "clamp" o range no limite de 30 dias da IG follower_count API.
  // A IG só permite consultar follower_count nos últimos 30 dias (excluindo hoje).
  function clampFollowerRange(): { since: string; until: string } | null {
    const hoje    = new Date();
    const limite  = new Date(hoje); limite.setUTCDate(hoje.getUTCDate() - 30);
    const ontem   = new Date(hoje); ontem.setUTCDate(hoje.getUTCDate() - 1);
    const fromMs  = Math.max(new Date(from + "T00:00:00Z").getTime(), limite.getTime());
    const toMs    = Math.min(new Date(to   + "T23:59:59Z").getTime(), ontem.getTime());
    if (fromMs > toMs) return null; // período inteiro fora dos últimos 30d
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { since: fmt(new Date(fromMs)), until: fmt(new Date(toMs)) };
  }

  for (const ig of igResp.data) {
    // 2a. follower_count → legacy time_series (limite 30d da Meta)
    const followerRange = clampFollowerRange();
    let fr: IgInsightsResponse | { error: { message: string } } = { error: { message: "período fora da janela de 30 dias da Meta" } };
    if (followerRange) {
      const followerUrl = new URL(`https://graph.facebook.com/${API_VERSION}/${ig.id}/insights`);
      followerUrl.searchParams.set("metric", "follower_count");
      followerUrl.searchParams.set("period", "day");
      followerUrl.searchParams.set("since", followerRange.since);
      followerUrl.searchParams.set("until", followerRange.until);
      followerUrl.searchParams.set("access_token", token);
      fr = await (await fetch(followerUrl)).json() as IgInsightsResponse;
    }

    if ("error" in fr && fr.error) {
      console.warn(`[IG insights] follower_count @${ig.username}: ${fr.error.message}`);
      // Não retorna ainda — ainda tentamos profile_views que é independente
    }

    // 2b. profile_views → novo formato (metric_type=total_value, valor agregado do período)
    const profileUrl = new URL(`https://graph.facebook.com/${API_VERSION}/${ig.id}/insights`);
    profileUrl.searchParams.set("metric", "profile_views");
    profileUrl.searchParams.set("metric_type", "total_value");
    profileUrl.searchParams.set("period", "day");
    profileUrl.searchParams.set("since", from);
    profileUrl.searchParams.set("until", to);
    profileUrl.searchParams.set("access_token", token);
    const pr = await (await fetch(profileUrl)).json() as {
      data?: Array<{ name: string; total_value?: { value: number | string } }>;
      error?: { message: string };
    };

    const followerMetric = "data" in fr ? fr.data?.find((m) => m.name === "follower_count") : undefined;

    // follower_count: a IG API retorna o follower_count como "gained on that day" (delta) ou
    // como total acumulado dependendo da conta/versão. Heurística runtime:
    //   - maxValor < 1000 → delta diário (soma)
    //   - maxValor >= 1000 → total acumulado (último - primeiro)
    let seguidoresInicial: number | null = null;
    let seguidoresFinal:   number | null = null;
    let novosSeguidores:   number | null = null;
    if (followerMetric && followerMetric.values.length > 0) {
      const valores = followerMetric.values.map((v) => toNum(v.value));
      const maxValor = Math.max(...valores);
      const ehDelta = maxValor < 1000;
      if (ehDelta) {
        novosSeguidores = valores.reduce((s, v) => s + v, 0);
      } else {
        seguidoresInicial = Math.round(valores[0]);
        seguidoresFinal   = Math.round(valores[valores.length - 1]);
        novosSeguidores   = seguidoresFinal - seguidoresInicial;
      }
    }

    let visitasPerfil: number | null = null;
    if (!pr.error) {
      const profileMetric = pr.data?.find((m) => m.name === "profile_views");
      if (profileMetric?.total_value) {
        visitasPerfil = Math.round(toNum(profileMetric.total_value.value));
      }
    } else {
      console.warn(`[IG insights] profile_views @${ig.username}: ${pr.error.message}`);
    }

    out.push({
      igAccountId:       ig.id,
      username:          ig.username,
      seguidoresInicial,
      seguidoresFinal,
      novosSeguidores,
      visitasPerfil,
    });
  }

  return out;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function gerarSnapshotMeta(
  adAccountIds: string[],
  from: string,
  to: string,
  token: string,
): Promise<Snapshot> {
  const campanhas: CampanhaSnapshot[] = [];
  const adsets:    AdsetSnapshot[]    = [];
  const ads:       AdSnapshot[]       = [];

  for (const rawId of adAccountIds) {
    const id = rawId.startsWith("act_") ? rawId : `act_${rawId}`;

    const [rowsC, rowsAS, rowsAd] = await Promise.all([
      fetchInsights(id, "campaign", from, to, token),
      fetchInsights(id, "adset",    from, to, token),
      fetchInsights(id, "ad",       from, to, token),
    ]);

    for (const r of rowsC) {
      const resultado   = parseResultado(r.results, r.cost_per_result);
      const secundarias = parseSecundarias(r.actions, resultado?.indicator ?? null);
      campanhas.push({
        campaignId:      r.campaign_id ?? "",
        campaignName:    r.campaign_name ?? "",
        objective:       r.objective ?? null,
        effectiveStatus: null,
        ...mapBase(r),
        resultado,
        secundarias,
      });
    }
    for (const r of rowsAS) {
      const resultado   = parseResultado(r.results, r.cost_per_result);
      const secundarias = parseSecundarias(r.actions, resultado?.indicator ?? null);
      adsets.push({
        adsetId:      r.adset_id ?? "",
        adsetName:    r.adset_name ?? "",
        campaignId:   r.campaign_id ?? "",
        campaignName: r.campaign_name ?? "",
        objective:    r.objective ?? null,
        ...mapBase(r),
        resultado,
        secundarias,
      });
    }
    for (const r of rowsAd) {
      const resultado   = parseResultado(r.results, r.cost_per_result);
      const secundarias = parseSecundarias(r.actions, resultado?.indicator ?? null);
      ads.push({
        adId:         r.ad_id ?? "",
        adName:       r.ad_name ?? "",
        adsetId:      r.adset_id ?? "",
        adsetName:    r.adset_name ?? "",
        campaignId:   r.campaign_id ?? "",
        campaignName: r.campaign_name ?? "",
        objective:    r.objective ?? null,
        ...mapBase(r),
        resultado,
        secundarias,
      });
    }
  }

  // Ordena por spend desc
  campanhas.sort((a, b) => b.spend - a.spend);
  adsets.sort((a, b)    => b.spend - a.spend);
  ads.sort((a, b)       => b.spend - a.spend);

  // Busca métricas IG (orgânico + pago) em paralelo, com fallback gracioso
  const igPorConta: InstagramSnapshot[] = [];
  for (const rawId of adAccountIds) {
    const id = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
    try {
      const data = await fetchIgInsights(id, from, to, token);
      if (data) igPorConta.push(...data);
    } catch (err) {
      console.warn(`[gerarSnapshotMeta] IG insights skipped for ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  return {
    geradoEm: new Date().toISOString(),
    periodo:  { from, to },
    contas:   adAccountIds,
    campanhas, adsets, ads,
    instagram: igPorConta.length > 0 ? igPorConta : null,
  };
}
