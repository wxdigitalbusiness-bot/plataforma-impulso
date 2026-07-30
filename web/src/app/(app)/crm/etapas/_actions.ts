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

  const ultima = await db.clienteCrmWebhook.findFirst({
    where: { clienteId },
    orderBy: { posicao: "desc" },
    select: { posicao: true },
  });

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
      posicao: (ultima?.posicao ?? 0) + 1,
    },
  });

  revalidatePath("/crm/etapas");
  return { ok: true };
}

export async function salvarTipoConversao(
  webhookId: number,
  tipo: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const allowed = ["", "qualificado", "concluido"];
  if (!allowed.includes(tipo)) return { ok: false, erro: "Tipo inválido." };

  await db.clienteCrmWebhook.update({
    where: { id: BigInt(webhookId) },
    data:  { tipoConversao: tipo || null },
  });

  revalidatePath("/crm/etapas");
  return { ok: true };
}

export async function moverEtapa(
  clienteId: number,
  webhookId: number,
  direcao: "cima" | "baixo",
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const lista = await db.clienteCrmWebhook.findMany({
    where: { clienteId },
    orderBy: { posicao: "asc" },
    select: { id: true, posicao: true },
  });

  const idx = lista.findIndex((e) => Number(e.id) === webhookId);
  if (idx === -1) return { ok: false, erro: "Etapa não encontrada." };

  const vizinhoIdx = direcao === "cima" ? idx - 1 : idx + 1;
  if (vizinhoIdx < 0 || vizinhoIdx >= lista.length) return { ok: true }; // já está na ponta

  const atual = lista[idx];
  const vizinho = lista[vizinhoIdx];

  await db.$transaction([
    db.clienteCrmWebhook.update({ where: { id: atual.id }, data: { posicao: vizinho.posicao } }),
    db.clienteCrmWebhook.update({ where: { id: vizinho.id }, data: { posicao: atual.posicao } }),
  ]);

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
