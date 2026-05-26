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
]);

export type MetaInsightsResultado = {
  adAccountId: string;
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;        // percentage 0..100
  cpc: number;        // moeda
  conversoes: number;
  moeda: string | null;
  erro: string | null;
};

export async function getInsightsMeta(
  adAccountId: string,
  datePreset: "last_7d" | "last_30d" | "this_month" = "last_7d",
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
    ["spend", "clicks", "impressions", "ctr", "cpc", "actions", "account_currency"].join(","),
  );
  url.searchParams.set("date_preset", datePreset);

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

  return {
    adAccountId,
    spend: toNumber(row.spend),
    impressoes: toNumber(row.impressions),
    cliques: toNumber(row.clicks),
    ctr: toNumber(row.ctr),
    cpc: toNumber(row.cpc),
    conversoes,
    moeda: (row.account_currency as string) ?? null,
    erro: null,
  };
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
