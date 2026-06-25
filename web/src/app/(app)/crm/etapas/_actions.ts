"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function slugificar(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export async function adicionarEtapa(
  clienteId: number,
  label: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  label = label.trim();
  if (label.length < 2) return { ok: false, erro: "Nome mínimo de 2 caracteres." };
  if (label.length > 60) return { ok: false, erro: "Nome máximo de 60 caracteres." };

  const slug = slugificar(label);
  if (!slug) return { ok: false, erro: "Nome inválido (use letras ou números)." };

  const existente = await db.clienteCrmWebhook.findUnique({
    where: { clienteId_etapa: { clienteId, etapa: slug } },
  });
  if (existente) return { ok: false, erro: `Já existe uma etapa "${existente.etapaLabel}".` };

  // Cria etapa extra sem n8n (plataforma própria)
  const placeholder = `platform-${clienteId}-${slug}-${Date.now()}`;
  await db.clienteCrmWebhook.create({
    data: {
      clienteId,
      etapa: slug,
      etapaLabel: label,
      ehExtra: true,
      webhookPath: placeholder,
      webhookUrl: "",
      n8nWorkflowId: placeholder,
    },
  });

  revalidatePath("/crm/etapas");
  return { ok: true };
}

export async function removerEtapa(
  webhookId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const wh = await db.clienteCrmWebhook.findUnique({
    where: { id: BigInt(webhookId) },
    select: { id: true, ehExtra: true, etapaLabel: true },
  });
  if (!wh) return { ok: false, erro: "Etapa não encontrada." };
  if (!wh.ehExtra) return { ok: false, erro: "Etapas base não podem ser removidas." };

  await db.clienteCrmWebhook.delete({ where: { id: wh.id } });
  revalidatePath("/crm/etapas");
  return { ok: true };
}
