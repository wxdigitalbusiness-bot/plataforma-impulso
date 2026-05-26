// Funções puras de consulta à Meta Graph API.
//
// FONTE DA VERDADE:
//   - `funding_source_details.display_string`: texto tipo "Saldo disponivel (R$389,50 BRL)"
//   - `funding_source_details.type === 20`: conta pre-paga (Wallet/PIX)
//   - Outros types = pos-paga (cartao, fatura, etc).
//
// Esta lib nao mantem cache — o cache vive no Postgres (colunas ultimo_* em clientes_ativos),
// populado pelo workflow n8n [SYNC] Atualizar Saldos Meta Ads ou pelo server action de refresh.

export type TipoConta = "pre_paga" | "pos_paga" | "indefinido";

export type MetaAdAccountBalance = {
  adAccountId: string;
  nome: string | null;
  saldoRestante: number | null;
  tipoConta: TipoConta;
  metodoPagamentoLabel: string | null;
  currency: string | null;
  amountSpent: number;
  isPrepayAccount: boolean;
  accountStatus: number | null;
  erro: string | null;
};

const GRAPH_API_VERSION = "v19.0";

export async function consultarSaldoMeta(adAccountId: string): Promise<MetaAdAccountBalance> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return makeResult(adAccountId, { erro: "META_ACCESS_TOKEN nao configurado" });
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}`);
  url.searchParams.set(
    "fields",
    [
      "name",
      "currency",
      "amount_spent",
      "is_prepay_account",
      "account_status",
      "funding_source_details",
    ].join(","),
  );

  let json: Record<string, unknown> = {};
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    json = await res.json();

    if (!res.ok || json.error) {
      const err = json.error as { message?: string; code?: number } | undefined;
      const erro = err?.code
        ? `Meta ${err.code}: ${err.message ?? "erro"}`
        : err?.message ?? `HTTP ${res.status}`;
      return makeResult(adAccountId, { erro });
    }
  } catch (err) {
    const erro = err instanceof Error ? err.message : "Falha de rede";
    return makeResult(adAccountId, { erro });
  }

  const fundingDetails = json.funding_source_details as
    | { type?: number; display_string?: string }
    | undefined;
  const fundingType = fundingDetails?.type;
  const displayString = fundingDetails?.display_string ?? null;

  const ehSaldoWallet = fundingType === 20;
  const tipoConta: TipoConta = ehSaldoWallet
    ? "pre_paga"
    : fundingType === undefined
      ? "indefinido"
      : "pos_paga";

  const saldoRestante = ehSaldoWallet ? parseSaldoFromDisplayString(displayString) : null;

  return {
    adAccountId,
    nome: (json.name as string) ?? null,
    saldoRestante,
    tipoConta,
    metodoPagamentoLabel: displayString,
    currency: (json.currency as string) ?? null,
    amountSpent: toNumber(json.amount_spent),
    isPrepayAccount: Boolean(json.is_prepay_account),
    accountStatus: (json.account_status as number) ?? null,
    erro: null,
  };
}

// ─── Labels em português ─────────────────────────────────────────────────────

export const OBJETIVO_PT: Record<string, string> = {
  // Objetivos novos (Outcome-based)
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Geração de leads",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_APP_PROMOTION: "Promoção de app",
  // Objetivos legados
  CONVERSIONS: "Conversões",
  LEAD_GENERATION: "Geração de leads",
  LINK_CLICKS: "Tráfego",
  BRAND_AWARENESS: "Reconhecimento",
  REACH: "Alcance",
  VIDEO_VIEWS: "Visualizações de vídeo",
  POST_ENGAGEMENT: "Engajamento",
  PAGE_LIKES: "Curtidas na página",
  MESSAGES: "Mensagens",
  APP_INSTALLS: "Instalações de app",
  EVENT_RESPONSES: "Respostas a eventos",
  PRODUCT_CATALOG_SALES: "Vendas do catálogo",
  STORE_VISITS: "Visitas à loja",
};

export const DESTINO_PT: Record<string, string> = {
  WEBSITE: "Site",
  APP: "Aplicativo",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  INSTAGRAM_PROFILE: "Instagram",
  FACEBOOK_PAGE: "Página do Facebook",
  PHONE_CALL: "Ligação",
  ON_AD: "No anúncio",
  ON_POST: "No post",
  INSTAGRAM_DIRECT: "Instagram Direct",
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER: "DM (Insta/Messenger)",
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: "DM + WhatsApp",
  MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: "Instagram + WhatsApp",
  MESSAGING_MESSENGER_WHATSAPP: "Messenger + WhatsApp",
};

// ─── Insights (Performance) ──────────────────────────────────────────────────
//
// Endpoint: /{ad_account_id}/insights?fields=spend,clicks,impressions,ctr,cpc,actions&date_preset=last_7d
//
// CTR e CPC vêm já calculados pelo Meta:
//   - ctr é percentage (ex: "3.69" significa 3.69%)
//   - cpc é em moeda da conta (ex: "0.27" BRL)
//
// Conversions: o Meta retorna `actions` como array de { action_type, value }.
// Contamos como "conversões" os action_types abaixo (lista pode ser expandida):
const ACTION_TYPES_CONVERSAO = new Set([
  "purchase",
  "lead",
  "complete_registration",
  "submit_application",
  "schedule",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.fb_pixel_purchase",
  "offsite_conversion.fb_pixel_complete_registration",
  // Mensagens / WhatsApp
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
  "onsite_conversion.messaging_block",
]);

// Mapa: action_type → label em PT-BR para exibição no dashboard
const ACTION_TIPO_LABEL: Record<string, string> = {
  purchase: "Compras",
  "offsite_conversion.fb_pixel_purchase": "Compras",
  lead: "Leads",
  "offsite_conversion.fb_pixel_lead": "Leads",
  "onsite_conversion.lead_grouped": "Leads",
  complete_registration: "Cadastros",
  "offsite_conversion.fb_pixel_complete_registration": "Cadastros",
  submit_application: "Candidaturas",
  schedule: "Agendamentos",
  "onsite_conversion.messaging_conversation_started_7d": "Conversas",
  "onsite_conversion.messaging_first_reply": "Conversas iniciadas",
  "onsite_conversion.messaging_block": "Conversas",
};

function tipoResultadoLabel(
  actions: Array<{ action_type: string; value: string }>,
  cliques: number,
): string {
  // Encontra o action_type com maior valor entre os rastreados
  let bestType = "";
  let bestCount = 0;
  for (const a of actions) {
    if (ACTION_TYPES_CONVERSAO.has(a.action_type)) {
      const v = toNumber(a.value);
      if (v > bestCount) {
        bestCount = v;
        bestType = a.action_type;
      }
    }
  }
  if (bestType) return ACTION_TIPO_LABEL[bestType] ?? "Conversões";
  // Sem ações de conversão → campanha de tráfego ou alcance
  return cliques > 0 ? "Cliques no link" : "Impressões";
}

export type MetaInsightsResultado = {
  adAccountId: string;
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;           // percentage 0..100
  cpc: number;           // moeda
  conversoes: number;
  reach: number;         // pessoas únicas alcançadas
  frequencia: number;    // impressoes / reach
  tipoResultado: string; // label PT-BR do resultado dominante
  moeda: string | null;
  erro: string | null;
};

export async function getInsightsMeta(
  adAccountId: string,
  from: string,   // ISO date YYYY-MM-DD
  to: string,     // ISO date YYYY-MM-DD
): Promise<MetaInsightsResultado> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return makeInsightsResult(adAccountId, "META_ACCESS_TOKEN nao configurado");
  }

  const url = new URL(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/insights`,
  );
  url.searchParams.set(
    "fields",
    ["spend", "clicks", "impressions", "reach", "ctr", "cpc", "actions", "account_currency"].join(","),
  );
  url.searchParams.set("time_range", JSON.stringify({ since: from, until: to }));

  let json: Record<string, unknown> = {};
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    json = await res.json();

    if (!res.ok || json.error) {
      const err = json.error as { message?: string; code?: number } | undefined;
      const erro = err?.code
        ? `Meta ${err.code}: ${err.message ?? "erro"}`
        : err?.message ?? `HTTP ${res.status}`;
      return makeInsightsResult(adAccountId, erro);
    }
  } catch (err) {
    return makeInsightsResult(
      adAccountId,
      err instanceof Error ? err.message : "Falha de rede",
    );
  }

  const data = (json.data as Array<Record<string, unknown>>) ?? [];
  if (data.length === 0) {
    // Conta sem dados no período (ex.: pausada). Não é erro.
    return makeInsightsResult(adAccountId, null);
  }

  const row = data[0];
  const actions = (row.actions as Array<{ action_type: string; value: string }>) ?? [];
  const conversoes = actions
    .filter((a) => ACTION_TYPES_CONVERSAO.has(a.action_type))
    .reduce((sum, a) => sum + toNumber(a.value), 0);

  const reach = toNumber(row.reach);

  return {
    adAccountId,
    spend: toNumber(row.spend),
    impressoes: toNumber(row.impressions),
    cliques: toNumber(row.clicks),
    ctr: toNumber(row.ctr),
    cpc: toNumber(row.cpc),
    conversoes,
    reach,
    frequencia: reach > 0
      ? Math.round((toNumber(row.impressions) / reach) * 100) / 100
      : 0,
    tipoResultado: tipoResultadoLabel(actions, toNumber(row.clicks)),
    moeda: (row.account_currency as string) ?? null,
    erro: null,
  };
}

// ─── Insights por Campanha (detalhe) ─────────────────────────────────────────
//
// Busca campanhas ativas/pausadas com objetivo, destino de conversão e
// métricas do período. Uma chamada só (campaigns edge com insights subfield).

export type CampanhaMetrics = {
  campanhaId: string;
  nome: string;
  objetivo: string;         // label em PT-BR
  objetivoRaw: string;
  destinoConversao: string | null;  // label em PT-BR
  destinoRaw: string | null;
  status: string;
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversoes: number;
  taxaConversao: number;
  erro: string | null;
};

export async function getInsightsCampanhasMeta(
  adAccountId: string,
  from: string,   // ISO date YYYY-MM-DD
  to: string,     // ISO date YYYY-MM-DD
): Promise<CampanhaMetrics[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const insightFields = [
      "spend",
      "impressions",
      "clicks",
      "ctr",
      "cpc",
      "actions",
    ].join(",");

    const url = new URL(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/campaigns`,
    );
    url.searchParams.set(
      "fields",
      `id,name,objective,destination_type,status,insights{${insightFields}}`,
    );
    // time_range no nível raiz é propagado para o sub-edge insights
    url.searchParams.set("time_range", JSON.stringify({ since: from, until: to }));
    url.searchParams.set(
      "filtering",
      JSON.stringify([
        {
          field: "effective_status",
          operator: "IN",
          value: ["ACTIVE", "PAUSED"],
        },
      ]),
    );
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok || json.error) return [];

    const campaigns = (json.data as Record<string, unknown>[]) ?? [];

    return campaigns
      .map((c): CampanhaMetrics => {
        const insightsData = (
          c.insights as { data?: Record<string, unknown>[] } | undefined
        )?.data?.[0];

        const actions =
          (insightsData?.actions as Array<{
            action_type: string;
            value: string;
          }>) ?? [];
        const conversoes = actions
          .filter((a) => ACTION_TYPES_CONVERSAO.has(a.action_type))
          .reduce((sum, a) => sum + toNumber(a.value), 0);

        const cliques = toNumber(insightsData?.clicks);
        const spend = toNumber(insightsData?.spend);
        const objetivoRaw = (c.objective as string) ?? "";
        const destinoRaw = (c.destination_type as string) ?? null;

        return {
          campanhaId: c.id as string,
          nome: c.name as string,
          objetivo: OBJETIVO_PT[objetivoRaw] ?? objetivoRaw,
          objetivoRaw,
          destinoConversao: destinoRaw
            ? (DESTINO_PT[destinoRaw] ?? destinoRaw)
            : null,
          destinoRaw,
          status: c.status as string,
          spend,
          impressoes: toNumber(insightsData?.impressions),
          cliques,
          ctr: toNumber(insightsData?.ctr),
          cpc: toNumber(insightsData?.cpc),
          conversoes: Math.round(conversoes * 100) / 100,
          taxaConversao:
            cliques > 0
              ? Math.round((conversoes / cliques) * 100 * 100) / 100
              : 0,
          erro: null,
        };
      })
      .filter((c) => c.spend > 0 || c.impressoes > 0);
  } catch (err) {
    console.error("[META] getInsightsCampanhasMeta:", err);
    return [];
  }
}

function makeInsightsResult(
  adAccountId: string,
  erro: string | null,
): MetaInsightsResultado {
  return {
    adAccountId,
    spend: 0,
    impressoes: 0,
    cliques: 0,
    ctr: 0,
    cpc: 0,
    conversoes: 0,
    reach: 0,
    frequencia: 0,
    tipoResultado: "",
    moeda: null,
    erro,
  };
}

// ─── Helpers (mantidos abaixo) ───────────────────────────────────────────────

export function parseSaldoFromDisplayString(s: string | null | undefined): number | null {
  if (!s) return null;
  const match = s.match(/[R$$€£]\s*([\d.,]+)/);
  if (!match) return null;
  let num = match[1];
  const hasComma = num.includes(",");
  const hasDot = num.includes(".");
  if (hasComma && hasDot) num = num.replace(/\./g, "").replace(",", ".");
  else if (hasComma) num = num.replace(",", ".");
  const val = parseFloat(num);
  return Number.isFinite(val) ? val : null;
}

function makeResult(
  adAccountId: string,
  overrides: Partial<MetaAdAccountBalance> = {},
): MetaAdAccountBalance {
  return {
    adAccountId,
    nome: null,
    saldoRestante: null,
    tipoConta: "indefinido",
    metodoPagamentoLabel: null,
    currency: null,
    amountSpent: 0,
    isPrepayAccount: false,
    accountStatus: null,
    erro: null,
    ...overrides,
  };
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
