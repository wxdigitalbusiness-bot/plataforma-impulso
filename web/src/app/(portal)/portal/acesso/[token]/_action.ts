"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPortalSession } from "@/lib/portal-session";

type Row = {
  id: number;
  nome: string | null;
  email: string | null;
  cliente_id: number;
  ativo: boolean;
  token_expira_em: Date | null;
};

export type CompletarAcessoResult = { ok: true } | { ok: false; erro: string };

export async function completarAcesso(
  token: string,
  input: { nome?: string; email?: string; senha: string },
): Promise<CompletarAcessoResult> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT id, nome, email, cliente_id, ativo, token_expira_em
    FROM portal_usuarios
    WHERE token = ${token}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) return { ok: false, erro: "Link inválido." };
  if (!user.ativo) return { ok: false, erro: "Esse acesso foi desativado pela agência." };
  if (!user.token_expira_em || user.token_expira_em.getTime() < Date.now()) {
    return { ok: false, erro: "Link expirado. Peça pra agência reenviar o convite." };
  }

  if (input.senha.length < 6) return { ok: false, erro: "A senha precisa ter pelo menos 6 caracteres." };

  const pendente = !user.nome;
  let nome = user.nome;
  let email = user.email;

  if (pendente) {
    nome = (input.nome ?? "").trim();
    email = (input.email ?? "").trim().toLowerCase();
    if (!nome || !email) return { ok: false, erro: "Preencha nome e email." };

    const existing = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM portal_usuarios WHERE email = ${email} AND id != ${user.id} LIMIT 1
    `;
    if (existing.length > 0) return { ok: false, erro: "Esse email já está em uso." };
  }

  const senhaHash = await hash(input.senha, 10);

  await db.$executeRaw`
    UPDATE portal_usuarios
    SET nome = ${nome}, email = ${email}, senha_hash = ${senhaHash}, token = NULL, token_expira_em = NULL
    WHERE id = ${user.id}
  `;

  const cliente = await db.cliente.findUnique({
    where: { id: user.cliente_id },
    select: { nome: true, n8nClientKey: true },
  });

  await createPortalSession({
    portalUserId: user.id,
    clienteId: user.cliente_id,
    clienteNome: cliente?.nome ?? "",
    clientKey: cliente?.n8nClientKey ?? null,
    email: email ?? "",
    role: "operador",
  });

  redirect("/portal");
}
