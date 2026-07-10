"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPortalSession } from "@/lib/portal-session";

type PortalUserRow = {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  cliente_id: number;
  role: string;
  ativo: boolean;
};

type ClienteRow = {
  nome: string;
  n8n_client_key: string | null;
};

export async function loginPortal(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const senha = formData.get("senha") as string;

  if (!email || !senha) redirect("/portal/login?e=1");

  const rows = await db.$queryRaw<PortalUserRow[]>`
    SELECT id, nome, email, senha_hash, cliente_id, role, ativo
    FROM portal_usuarios
    WHERE email = ${email}
    LIMIT 1
  `;
  const user = rows[0];

  if (!user || !user.ativo) redirect("/portal/login?e=1");

  const ok = await compare(senha, user.senha_hash);
  if (!ok) redirect("/portal/login?e=1");

  const clientes = await db.$queryRaw<ClienteRow[]>`
    SELECT nome, n8n_client_key FROM clientes WHERE id = ${user.cliente_id} LIMIT 1
  `;
  const cliente = clientes[0];

  await createPortalSession({
    portalUserId: user.id,
    clienteId: user.cliente_id,
    clienteNome: cliente?.nome ?? "",
    clientKey: cliente?.n8n_client_key ?? null,
    email: user.email,
    role: user.role,
  });

  redirect("/portal");
}
