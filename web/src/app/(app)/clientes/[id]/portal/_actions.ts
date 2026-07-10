"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function criarPortalUsuario(formData: FormData) {
  const clienteId = Number(formData.get("cliente_id"));
  const nome = (formData.get("nome") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const senha = formData.get("senha") as string;

  if (!nome || !email || !senha || senha.length < 6) return;

  const senhaHash = await hash(senha, 10);

  const existing = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM portal_usuarios WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) return;

  await db.$executeRaw`
    INSERT INTO portal_usuarios (nome, email, senha_hash, cliente_id, role, ativo)
    VALUES (${nome}, ${email}, ${senhaHash}, ${clienteId}, 'operador', true)
  `;

  revalidatePath(`/clientes/${clienteId}/portal`);
}

export async function togglePortalUsuario(formData: FormData) {
  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "1";
  const clienteId = Number(formData.get("cliente_id"));

  await db.$executeRaw`
    UPDATE portal_usuarios SET ativo = ${!ativo} WHERE id = ${id}
  `;

  revalidatePath(`/clientes/${clienteId}/portal`);
}
