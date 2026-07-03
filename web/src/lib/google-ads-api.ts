// Consulta saldo de contas Google Ads via API REST v20
// MCC (Manager Account) → sub-conta de cada cliente
// Saldo real vem de AccountBudget: adjusted_spending_limit - amount_served × 1.10
// (adjusted = approved + créditos promocionais; ×1.10 = tributos BR: ISS 5% + PIS/COFINS ~4%)

const GADS_VERSION = "v21";
const GADS_BASE = `https://googleads.googleapis.com/${GADS_VERSION}`;

export type GoogleAdsResult = {
  saldoRestante: number | null;
  tipoConta: "pre_paga" | "pos_paga" | "indefinido";
  moeda: string;
  erro: string | null;
};

// ─── OAuth2: troca refresh_token por access_token ───────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google OAuth2 falhou: ${data?.error_description ?? JSON.stringify(data)}`
    );
  }
  return data.access_token as string;
}

// ─── GAQL search helper ──────────────────────────────────────────────────────

async function gaqlSearch(
  customerId: string,
  query: string,
  accessToken: string,
  mccId: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${GADS_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      ...(mccId ? { "login-customer-id": mccId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query.replace(/\s+/g, " ").trim() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { error?: { message?: string } })?.error?.message ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return (data.results ?? []) as Record<string, unknown>[];
}

// ─── Insights (Performance) ──────────────────────────────────────────────────
//
// GAQL agrega métricas do `customer` no período. Em micros pra dinheiro.
//   metrics.cost_micros        → spend (dividir por 1_000_000)
//   metrics.clicks             → cliques
//   metrics.impressions        → impressões
//   metrics.ctr                → 0..1 (multiplicar por 100 pra %)
//   metrics.average_cpc        → micros, dividir por 1M
//   metrics.conversions        → decimal (pode ser fracionário se conversões com peso)

export type GoogleInsightsResultado = {
  customerId: string;
  spend: number;
  impressoes: number;
  cliques: number;
  ctr: number;        // percentage 0..100
  cpc: number;
  conversoes: number;
  moeda: string;
  erro: string | null;
};

export async function getInsightsGoogle(
  rawCustomerId: string,
  rawMccId: string | null,
  from: string,   // ISO date YYYY-MM-DD
  to: string,     // ISO date YYYY-MM-DD
): Promise<GoogleInsightsResultado> {
  const customerId = rawCustomerId.replace(/-/g, "");
  const loginCustomerId = rawMccId
    ? rawMccId.replace(/-/g, "")
    : customerId;

  const periodoWhere = `segments.date BETWEEN '${from}' AND '${to}'`;

  try {
    const accessToken = await getAccessToken();

    const rows = await gaqlSearch(
      customerId,
      `SELECT
         customer.currency_code,
         metrics.cost_micros,
         metrics.clicks,
         metrics.impressions,
         metrics.ctr,
         metrics.average_cpc,
         metrics.conversions
       FROM customer
       WHERE ${periodoWhere}`,
      accessToken,
      loginCustomerId,
    );

    type Row = {
      customer?: { currencyCode?: string };
      metrics?: {
        costMicros?: string | number;
        clicks?: string | number;
        impressions?: string | number;
        ctr?: string | number;
        averageCpc?: string | number;
        conversions?: string | number;
      };
    };

    if (rows.length === 0) {
      return {
        customerId,
        spend: 0,
        impressoes: 0,
        cliques: 0,
        ctr: 0,
        cpc: 0,
        conversoes: 0,
        moeda: "BRL",
        erro: null,
      };
    }

    // Pode vir 1 linha (agregado) ou N (uma por dia). Soma defensiva.
    let totalCost = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;
    let moeda = "BRL";

    for (const row of rows as Row[]) {
      moeda = row.customer?.currencyCode ?? moeda;
      totalCost += Number(row.metrics?.costMicros ?? 0);
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalConversions += Number(row.metrics?.conversions ?? 0);
    }

    const spend = totalCost / 1_000_000;
    const ctrCalc = totalImpressions > 0
      ? (totalClicks / totalImpressions) * 100
      : 0;
    const cpcCalc = totalClicks > 0 ? spend / totalClicks : 0;

    return {
      customerId,
      spend: Math.round(spend * 100) / 100,
      impressoes: totalImpressions,
      cliques: totalClicks,
      ctr: Math.round(ctrCalc * 100) / 100,
      cpc: Math.round(cpcCalc * 100) / 100,
      conversoes: Math.round(totalConversions * 100) / 100,
      moeda,
      erro: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      customerId,
      spend: 0,
      impressoes: 0,
      cliques: 0,
      ctr: 0,
      cpc: 0,
      conversoes: 0,
      moeda: "BRL",
      erro: msg,
    };
  }
}

// ─── Principal ───────────────────────────────────────────────────────────────

export async function consultarSaldoGoogle(
  rawCustomerId: string,
  rawMccId?: string | null   // null = acessar a conta diretamente (sem MCC)
): Promise<GoogleAdsResult> {
  // Aceita "123-456-7890" ou "1234567890"
  const customerId = rawCustomerId.replace(/-/g, "");
  // Se o cliente tem MCC específico → usa o MCC; senão → loga como a própria conta
  // (igual ao workflow n8n: nunca assume o MCC padrão para contas sem MCC configurado)
  const loginCustomerId = rawMccId
    ? rawMccId.replace(/-/g, "")
    : customerId;

  try {
    const accessToken = await getAccessToken();

    // Taxa de tributos do Google Ads no Brasil: ISS (5%) + PIS/COFINS (~4%) ≈ 10%
    // amountServedMicros = custo líquido SEM impostos.
    // adjustedSpendingLimitMicros = approved + créditos promocionais.
    // Fórmula: saldo = adjusted - served × 1.10
    const TAX_RATE = 0.10;

    // 1. Busca AccountBudgets aprovados (conta pré-paga tem orçamentos)
    const budgetRows = await gaqlSearch(
      customerId,
      `SELECT
         customer.currency_code,
         account_budget.approved_spending_limit_micros,
         account_budget.adjusted_spending_limit_micros,
         account_budget.amount_served_micros
       FROM account_budget
       WHERE account_budget.status = 'APPROVED'`,
      accessToken,
      loginCustomerId
    );

    type BudgetRow = {
      customer?: { currencyCode?: string };
      accountBudget?: {
        approvedSpendingLimitMicros?: string | number;
        adjustedSpendingLimitMicros?: string | number;
        amountServedMicros?: string | number;
      };
    };

    if (budgetRows.length > 0) {
      const moeda =
        (budgetRows[0] as BudgetRow)?.customer?.currencyCode ?? "BRL";

      // Verifica se algum budget tem limite pré-pago (approved > 0)
      const temLimitePrepago = (budgetRows as BudgetRow[]).some(
        (row) => Number(row.accountBudget?.approvedSpendingLimitMicros ?? 0) > 0
      );

      if (!temLimitePrepago) {
        return { saldoRestante: null, tipoConta: "pos_paga", moeda, erro: null };
      }

      let totalAdjusted = 0;
      let totalServed = 0;
      for (const row of budgetRows as BudgetRow[]) {
        const b = row.accountBudget;
        // Usa adjustedSpendingLimitMicros se disponível, senão approvedSpendingLimitMicros
        const limit = Number(b?.adjustedSpendingLimitMicros ?? b?.approvedSpendingLimitMicros ?? 0);
        totalAdjusted += limit;
        totalServed += Number(b?.amountServedMicros ?? 0);
      }

      // Desconta tributos e garante mínimo 0
      const raw = (totalAdjusted - totalServed * (1 + TAX_RATE)) / 1_000_000;
      const saldoRestante = Math.max(0, Math.round(raw * 100) / 100);

      return { saldoRestante, tipoConta: "pre_paga", moeda, erro: null };
    }

    // 2. Sem AccountBudget → provável conta pós-paga; verifica moeda
    const customerRows = await gaqlSearch(
      customerId,
      `SELECT customer.currency_code FROM customer LIMIT 1`,
      accessToken,
      loginCustomerId
    );

    type CustomerRow = { customer?: { currencyCode?: string } };
    const moeda =
      (customerRows[0] as CustomerRow)?.customer?.currencyCode ?? "BRL";

    return { saldoRestante: null, tipoConta: "pos_paga", moeda, erro: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      saldoRestante: null,
      tipoConta: "indefinido",
      moeda: "BRL",
      erro: msg,
    };
  }
}
