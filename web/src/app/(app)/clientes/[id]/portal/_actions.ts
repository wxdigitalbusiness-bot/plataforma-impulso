"use server";

import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

type CriarState = { error?: string; ok?: boolean } | null;

export async function criarPortalUsuario(clienteId: number, _prev: CriarState, formData: FormData): Promise<CriarState> {
  const nome  = formData.get("nome")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const senha = formData.get("senha")?.toString() ?? "";
  const role  = formData.get("role")?.toString() ?? "operador";

  if (!nome || !email || !senha) return { error: "Preencha todos os campos." };
  if (senha.length < 6) return { error: "Senha deve ter ao menos 6 caracteres." };

  const senhaHash = await hash(senha, 10);

  try {
    await db.portalUsuario.create({
      data: { nome, email, senhaHash, clienteId, role },
    });
  } catch {
    return { error: "E-mail já cadastrado." };
  }

  revalidatePath(`/clientes/${clienteId}/portal`);
  return { ok: true };
}

export async function togglePortalUsuario(usuarioId: number, ativo: boolean, clienteId: number) {
  await db.portalUsuario.update({
    where: { id: usuarioId },
    data: { ativo: !ativo },
  });
  revalidatePath(`/clientes/${clienteId}/portal`);
}

export async function resetSenhaPortalUsuario(usuarioId: number, clienteId: number, formData: FormData) {
  const senha = formData.get("senha")?.toString() ?? "";
  if (!senha || senha.length < 6) return;
  const senhaHash = await hash(senha, 10);
  await db.portalUsuario.update({ where: { id: usuarioId }, data: { senhaHash } });
  revalidatePath(`/clientes/${clienteId}/portal`);
}
