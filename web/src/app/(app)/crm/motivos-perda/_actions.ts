"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getClientKey(clienteId: number): Promise<string | null> {
  const c = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { n8nClientKey: true },
  });
  return c?.n8nClientKey ?? null;
}

export async function adicionarMotivo(
  clienteId: number,
  motivo: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  motivo = motivo.trim();
  if (!motivo) return { ok: false, erro: "Digite o motivo." };
  if (motivo.length > 120) return { ok: false, erro: "Máximo de 120 caracteres." };

  const clientKey = await getClientKey(clienteId);
  if (!clientKey) return { ok: false, erro: "Cliente não encontrado." };

  try {
    await db.$executeRaw`
      INSERT INTO crm_motivos_perda (client_key, motivo)
      VALUES (${clientKey}, ${motivo})
      ON CONFLICT (client_key, motivo) DO NOTHING
    `;
  } catch {
    return { ok: false, erro: "Erro ao salvar motivo." };
  }

  revalidatePath("/crm/motivos-perda");
  return { ok: true };
}

export async function removerMotivo(
  motivoId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  await db.$executeRaw`DELETE FROM crm_motivos_perda WHERE id = ${motivoId}`;
  revalidatePath("/crm/motivos-perda");
  return { ok: true };
}
