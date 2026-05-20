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
