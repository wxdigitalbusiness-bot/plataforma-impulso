"use server";

import { db } from "@/lib/db";
import { evoHeaders, EVOLUTION_API_URL } from "@/lib/whatsapp-sessions";
import { revalidatePath } from "next/cache";

type ConfigResult =
  | { ok: true; urlAnterior: string | null; urlNova: string; forwardAtivo: boolean }
  | { ok: false; erro: string };

export async function configurarWebhookEvolution(clienteId: number): Promise<ConfigResult> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { evolutionInstance: true, n8nWebhookForwardUrl: true },
  });

  if (!cliente?.evolutionInstance) {
    return { ok: false, erro: "Instância Evolution não configurada para este cliente." };
  }

  if (!EVOLUTION_API_URL) {
    return { ok: false, erro: "EVOLUTION_API_URL não configurada no ambiente." };
  }

  const instance = cliente.evolutionInstance;
  const platformBase = process.env.AUTH_URL ?? "";
  if (!platformBase) return { ok: false, erro: "AUTH_URL não configurada no ambiente." };

  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const urlNova = secret
    ? `${platformBase}/api/webhooks/evolution?secret=${secret}`
    : `${platformBase}/api/webhooks/evolution`;

  // 1. Lê webhook atual para preservar a URL do n8n como forward
  let urlAnterior: string | null = null;
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/webhook/find/${encodeURIComponent(instance)}`,
      { headers: evoHeaders(), cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      // Evolution API v2: { webhook: { url } } ou direto { url }
      urlAnterior = data?.webhook?.url ?? data?.url ?? null;
    }
  } catch {
    // ignora — prossegue sem URL anterior
  }

  // 2. Configura o novo webhook na instância
  const setRes = await fetch(
    `${EVOLUTION_API_URL}/webhook/set/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      headers: { ...evoHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urlNova,
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT"],
      }),
    }
  );

  if (!setRes.ok) {
    const err = await setRes.text().catch(() => String(setRes.status));
    return { ok: false, erro: `Erro Evolution API (${setRes.status}): ${err}` };
  }

  // 3. Salva a URL do n8n como forward, a menos que já seja da plataforma
  const forwardUrl =
    urlAnterior && !urlAnterior.includes("/api/webhooks/evolution")
      ? urlAnterior
      : cliente.n8nWebhookForwardUrl;

  await db.$executeRaw`
    UPDATE clientes
    SET n8n_webhook_forward_url = ${forwardUrl ?? null},
        atualizado_em = NOW()
    WHERE id = ${clienteId}
  `;

  revalidatePath(`/clientes/${clienteId}/editar`);

  return {
    ok: true,
    urlAnterior,
    urlNova,
    forwardAtivo: !!forwardUrl,
  };
}
