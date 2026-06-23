// Envia conversão offline para o Google Ads Conversion API (uploadClickConversions).
// Funciona com gclid (desktop/Android) e wbraid/gbraid (iOS privacy-safe).
// Requer variáveis de ambiente:
//   GOOGLE_ADS_DEVELOPER_TOKEN
//   GOOGLE_ADS_CLIENT_ID
//   GOOGLE_ADS_CLIENT_SECRET
//   GOOGLE_ADS_REFRESH_TOKEN

type FireGoogleConversionInput = {
  customerId: string;           // Google Ads Customer ID (sem hífens)
  conversionActionId: string;   // ID numérico da ConversionAction
  gclid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  conversionTime?: Date;
  value?: number;
};

type GoogleConversionResult =
  | { ok: true; partialFailure: boolean }
  | { ok: false; error: string };

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google OAuth falhou: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

function toGoogleDateTime(date: Date): string {
  // Formato: "2024-01-15 14:30:00+00:00"
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "+00:00");
}

export async function fireGoogleConversion(
  input: FireGoogleConversionInput
): Promise<GoogleConversionResult> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) return { ok: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado" };

  const clickId = input.gclid ?? input.wbraid ?? input.gbraid;
  if (!clickId) return { ok: false, error: "Nenhum click ID disponível (gclid/wbraid/gbraid)" };

  const customerId = input.customerId.replace(/-/g, "");
  const conversionAction = `customers/${customerId}/conversionActions/${input.conversionActionId}`;
  const conversionDateTime = toGoogleDateTime(input.conversionTime ?? new Date());

  // Monta o objeto de conversão com o tipo de click ID correto
  const conversion: Record<string, unknown> = {
    conversionAction,
    conversionDateTime,
    conversionValue: input.value ?? 1.0,
    currencyCode: "BRL",
  };

  if (input.gclid)   conversion.gclid   = input.gclid;
  else if (input.wbraid) conversion.wbraid = input.wbraid;
  else if (input.gbraid) conversion.gbraid = input.gbraid;

  try {
    const accessToken = await getAccessToken();

    const headers: Record<string, string> = {
      Authorization:     `Bearer ${accessToken}`,
      "developer-token": devToken,
      "Content-Type":    "application/json",
    };

    // MCC (Manager Account) — necessário para acessar contas de clientes
    const mccId = process.env.GOOGLE_ADS_MCC_ID;
    if (mccId) headers["login-customer-id"] = mccId.replace(/-/g, "");

    const res = await fetch(
      `https://googleads.googleapis.com/v24/customers/${customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          conversions: [conversion],
          partialFailure: true,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      return { ok: false, error: JSON.stringify(json) };
    }

    const hasFailure = Array.isArray(json.partialFailureError?.details) &&
      json.partialFailureError.details.length > 0;

    return { ok: true, partialFailure: hasFailure };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
