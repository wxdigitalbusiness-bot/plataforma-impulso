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
  clienteId: number | null
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!EVOLUTION_API_URL) return { ok: false, erro: "EVOLUTION_API_URL não configurada." };

  const webhookUrl = plataformaWebhookUrl();
  if (!webhookUrl) return { ok: false, erro: "AUTH_URL não configurada no ambiente." };

  const setRes = await setEvolutionWebhook(instanceName, webhookUrl);
  if (!setRes.ok) {
    const err = await setRes.text().catch(() => String(setRes.status));
    return { ok: false, erro: `Erro Evolution API (${setRes.status}): ${err}` };
  }

  if (clienteId) {
    await db.$executeRaw`
      UPDATE clientes SET atualizado_em = NOW() WHERE id = ${clienteId}
    `;
  }

  revalidatePath("/whatsapp");
  return { ok: true };
}

export async function criarNovaInstancia(
  instanceName: string,
  clienteId: number | null
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const nome = instanceName.trim();
  if (!nome) return { ok: false, erro: "Nome da instância é obrigatório." };
  if (!EVOLUTION_API_URL) return { ok: false, erro: "EVOLUTION_API_URL não configurada." };

  const webhookUrl = plataformaWebhookUrl();
  if (!webhookUrl) return { ok: false, erro: "AUTH_URL não configurada no ambiente." };

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

  await setEvolutionWebhook(nome, webhookUrl).catch(() => {});

  if (clienteId) {
    await db.$executeRaw`
      UPDATE clientes
      SET evolution_instance = ${nome}, atualizado_em = NOW()
      WHERE id = ${clienteId}
    `;
  }

  revalidatePath("/whatsapp");
  return { ok: true };
}
