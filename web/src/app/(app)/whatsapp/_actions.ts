"use server";

import { db } from "@/lib/db";
import { evoHeaders, EVOLUTION_API_URL } from "@/lib/whatsapp-sessions";
import { revalidatePath } from "next/cache";

function plataformaWebhookUrl(): string | null {
  const base = process.env.AUTH_URL ?? "";
  if (!base) return null;
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  return secret
    ? `${base}/api/webhooks/evolution?secret=${secret}`
    : `${base}/api/webhooks/evolution`;
}

async function setEvolutionWebhook(instanceName: string, url: string) {
  return fetch(
    `${EVOLUTION_API_URL}/webhook/set/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      headers: { ...evoHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          events: ["MESSAGES_UPSERT"],
          webhookByEvents: false,
          webhookBase64: false,
        },
      }),
    }
  );
}

export async function configurarWebhookInstancia(
  instanceName: string,
  clienteId: number | null,
  n8nForwardUrl: string | null
): Promise<{ ok: true; urlAnterior: string | null } | { ok: false; erro: string }> {
  if (!EVOLUTION_API_URL) return { ok: false, erro: "EVOLUTION_API_URL não configurada." };

  const webhookUrl = plataformaWebhookUrl();
  if (!webhookUrl) return { ok: false, erro: "AUTH_URL não configurada no ambiente." };

  // Lê URL atual da Evolution para preservar como forward
  let urlAnterior: string | null = null;
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/webhook/find/${encodeURIComponent(instanceName)}`,
      { headers: evoHeaders(), cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      urlAnterior = data?.webhook?.url ?? data?.url ?? null;
    }
  } catch {}

  // Determina forward: usa o que foi passado, ou a URL anterior (se não for da plataforma)
  const forward =
    n8nForwardUrl?.trim() ||
    (urlAnterior && !urlAnterior.includes("/api/webhooks/evolution")
      ? urlAnterior
      : null);

  // Configura webhook na Evolution
  const setRes = await setEvolutionWebhook(instanceName, webhookUrl);
  if (!setRes.ok) {
    const err = await setRes.text().catch(() => String(setRes.status));
    return { ok: false, erro: `Erro Evolution API (${setRes.status}): ${err}` };
  }

  // Salva no banco se houver cliente vinculado
  if (clienteId) {
    await db.$executeRaw`
      UPDATE clientes
      SET n8n_webhook_forward_url = ${forward ?? null},
          atualizado_em = NOW()
      WHERE id = ${clienteId}
    `;
  }

  revalidatePath("/whatsapp");
  return { ok: true, urlAnterior };
}

export async function criarNovaInstancia(
  instanceName: string,
  clienteId: number | null,
  n8nForwardUrl: string | null
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const nome = instanceName.trim();
  if (!nome) return { ok: false, erro: "Nome da instância é obrigatório." };
  if (!EVOLUTION_API_URL) return { ok: false, erro: "EVOLUTION_API_URL não configurada." };

  const webhookUrl = plataformaWebhookUrl();
  if (!webhookUrl) return { ok: false, erro: "AUTH_URL não configurada no ambiente." };

  // Cria a instância na Evolution API
  const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: "POST",
    headers: { ...evoHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ instanceName: nome, integration: "WHATSAPP-BAILEYS" }),
  });

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => String(createRes.status));
    const isAlreadyExists =
      err.toLowerCase().includes("already") ||
      err.toLowerCase().includes("exists") ||
      createRes.status === 409;
    if (!isAlreadyExists) {
      return { ok: false, erro: `Erro ao criar instância (${createRes.status}): ${err}` };
    }
  }

  // Configura webhook
  await setEvolutionWebhook(nome, webhookUrl).catch(() => {});

  // Vincula ao cliente no banco
  if (clienteId) {
    const forward = n8nForwardUrl?.trim() || null;
    await db.$executeRaw`
      UPDATE clientes
      SET evolution_instance        = ${nome},
          n8n_webhook_forward_url   = ${forward},
          atualizado_em             = NOW()
      WHERE id = ${clienteId}
    `;
  }

  revalidatePath("/whatsapp");
  return { ok: true };
}
