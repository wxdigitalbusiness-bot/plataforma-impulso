"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function alternarMostrarResultados(
  token: string,
  mostrar: boolean,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  await db.relatorioPublico.update({
    where: { token },
    data: { mostrarResultados: mostrar },
  });

  revalidatePath(`/r/${token}`);
  return { ok: true };
}

export async function definirOrigemResultados(
  token: string,
  origem: "todos" | "pago" | "organico",
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  await db.relatorioPublico.update({
    where: { token },
    data: { resultadosOrigem: origem },
  });

  revalidatePath(`/r/${token}`);
  return { ok: true };
}
