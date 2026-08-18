"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const criarSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  descricao: z.string().trim().min(1, "Descrição obrigatória"),
  valor: z.coerce.number().positive("Valor precisa ser maior que zero"),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export async function criarFatura(
  input: { clienteId: number; descricao: string; valor: number; vencimento: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  await db.clienteFatura.create({
    data: {
      clienteId: parsed.data.clienteId,
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
      vencimento: new Date(parsed.data.vencimento + "T00:00:00Z"),
      criadoPor: session.user.email,
    },
  });

  revalidatePath(`/clientes/${parsed.data.clienteId}/faturamento`);
  return { ok: true };
}

export async function alternarPagamento(
  faturaId: number,
  pago: boolean,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const fatura = await db.clienteFatura.update({
    where: { id: faturaId },
    data: { pago, pagoEm: pago ? new Date() : null },
  });

  revalidatePath(`/clientes/${fatura.clienteId}/faturamento`);
  return { ok: true };
}

export async function excluirFatura(
  faturaId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const fatura = await db.clienteFatura.delete({ where: { id: faturaId } });
  revalidatePath(`/clientes/${fatura.clienteId}/faturamento`);
  return { ok: true };
}
