// Integração com o Facebook Conversions API (CAPI).
// Disparado quando um lead chega à etapa "concluido" e possui ctwa_clid.
// O ctwa_clid (Click-to-WhatsApp Click ID) permite ao Meta atribuir a conversão
// ao anúncio original sem precisar de pixel no site ou cookies.

import crypto from "node:crypto";

const GRAPH_API_VERSION = "v19.0";

export type CapiEventInput = {
  pixelId: string;
  capiToken: string;
  phone: string;       // somente dígitos, será hasheado em SHA-256
  ctwaClid: string;
  eventName?: string;  // default: "Purchase"
  currency?: string;   // default: "BRL"
  value?: number;      // default: 0
  eventTime?: number;  // Unix timestamp — default: now
};

export type CapiEventResult =
  | { ok: true; fbTraceId: string }
  | { ok: false; error: string };

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// Normaliza telefone para E.164 sem "+" (padrão exigido pelo Meta)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Se não começa com código de país, assume Brasil (+55)
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function fireCapiEvent(input: CapiEventInput): Promise<CapiEventResult> {
  const {
    pixelId,
    capiToken,
    phone,
    ctwaClid,
    eventName = "Purchase",
    currency = "BRL",
    value = 0,
    eventTime = Math.floor(Date.now() / 1000),
  } = input;

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        // "other" = conversão fora da web (WhatsApp, presencial, etc.)
        action_source: "other",
        user_data: {
          ph: [sha256(normalizePhone(phone))],
          ctwa_clid: ctwaClid,
        },
        custom_data: {
          currency,
          value,
        },
      },
    ],
    access_token: capiToken,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (json?.error as Record<string, unknown>)?.message as string ?? res.statusText;
      return { ok: false, error: errMsg };
    }

    return { ok: true, fbTraceId: (json.events_received as string) ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
