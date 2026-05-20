// Consulta saldo de contas Google Ads via API REST v17
// MCC (Manager Account) → sub-conta de cada cliente
// Saldo real vem de AccountBudget: approved_spending_limit - amount_served

const GADS_VERSION = "v17";
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
  accessToken: string
): Promise<Record<string, unknown>[]> {
  const mccId = (process.env.GOOGLE_ADS_MCC_ID ?? "").replace(/-/g, "");
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

// ─── Principal ───────────────────────────────────────────────────────────────

export async function consultarSaldoGoogle(
  rawCustomerId: string
): Promise<GoogleAdsResult> {
  // Aceita "123-456-7890" ou "1234567890"
  const customerId = rawCustomerId.replace(/-/g, "");

  try {
    const accessToken = await getAccessToken();

    // 1. Busca AccountBudgets aprovados (conta pré-paga tem orçamentos)
    const budgetRows = await gaqlSearch(
      customerId,
      `SELECT
         customer.currency_code,
         account_budget.approved_spending_limit_micros,
         account_budget.amount_served_micros,
         account_budget.status
       FROM account_budget
       WHERE account_budget.status = 'APPROVED'`,
      accessToken
    );

    type BudgetRow = {
      customer?: { currencyCode?: string };
      accountBudget?: {
        approvedSpendingLimitMicros?: string | number;
        amountServedMicros?: string | number;
      };
    };

    if (budgetRows.length > 0) {
      const moeda =
        (budgetRows[0] as BudgetRow)?.customer?.currencyCode ?? "BRL";

      // Soma todos os orçamentos aprovados (geralmente 1)
      let totalApproved = 0n;
      let totalServed = 0n;
      for (const row of budgetRows as BudgetRow[]) {
        totalApproved += BigInt(
          row.accountBudget?.approvedSpendingLimitMicros ?? 0
        );
        totalServed += BigInt(row.accountBudget?.amountServedMicros ?? 0);
      }

      const balanceMicros = totalApproved - totalServed;
      const saldoRestante = Math.max(0, Number(balanceMicros) / 1_000_000);

      return { saldoRestante, tipoConta: "pre_paga", moeda, erro: null };
    }

    // 2. Sem AccountBudget → provável conta pós-paga; verifica moeda
    const customerRows = await gaqlSearch(
      customerId,
      `SELECT customer.currency_code FROM customer LIMIT 1`,
      accessToken
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
