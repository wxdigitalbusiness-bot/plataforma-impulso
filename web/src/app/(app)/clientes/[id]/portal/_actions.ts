"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gerarToken } from "@/lib/relatorios";
import { enviarWhatsappPara } from "@/lib/cron-alert";

const TOKEN_VALIDADE_DIAS = 3;

type Result = { ok: true } | { ok: false; erro: string };

function tokenExpiraEm(): Date {
  return new Date(Date.now() + TOKEN_VALIDADE_DIAS * 24 * 60 * 60 * 1000);
}

function linkAcesso(token: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base}/portal/acesso/${token}`;
}

export async function convidarPortalUsuario(clienteId: number, telefoneInput: string): Promise<Result> {
  const telefoneDigits = telefoneInput.replace(/\D/g, "");
  if (!telefoneDigits) return { ok: false, erro: "Informe o WhatsApp." };
  const telefone = telefoneDigits.startsWith("55") ? telefoneDigits : `55${telefoneDigits}`;

  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const token = gerarToken();
  await db.$executeRaw`
    INSERT INTO portal_usuarios (telefone, token, token_expira_em, cliente_id, role, ativo)
    VALUES (${telefone}, ${token}, ${tokenExpiraEm()}, ${clienteId}, 'operador', true)
  `;

  const texto =
    `👋 Olá! A agência Impulso criou seu acesso ao portal de *${cliente.nome}*.\n\n` +
    `Clique no link abaixo pra criar seu nome, email e senha:\n${linkAcesso(token)}\n\n` +
    `O link expira em ${TOKEN_VALIDADE_DIAS} dias.`;
  const enviado = await enviarWhatsappPara(telefone, texto);

  revalidatePath(`/clientes/${clienteId}/portal`);
  return enviado
    ? { ok: true }
    : { ok: false, erro: "Acesso criado, mas falhou o envio do WhatsApp. Tente reenviar o convite." };
}

/** Reenvia o link de acesso — serve tanto pra concluir um convite pendente quanto pra redefinir senha. */
export async function reenviarConvite(id: number, clienteId: number): Promise<Result> {
  const rows = await db.$queryRaw<{ telefone: string | null; nome: string | null }[]>`
    SELECT telefone, nome FROM portal_usuarios WHERE id = ${id} LIMIT 1
  `;
  const user = rows[0];
  if (!user?.telefone) return { ok: false, erro: "Usuário sem WhatsApp cadastrado." };

  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  const token = gerarToken();
  await db.$executeRaw`
    UPDATE portal_usuarios SET token = ${token}, token_expira_em = ${tokenExpiraEm()} WHERE id = ${id}
  `;

  const texto = user.nome
    ? `🔑 A agência Impulso solicitou a redefinição da sua senha no portal de *${cliente?.nome}*.\n\nClique pra escolher uma nova senha:\n${linkAcesso(token)}\n\nO link expira em ${TOKEN_VALIDADE_DIAS} dias.`
    : `👋 Lembrete: seu acesso ao portal de *${cliente?.nome}* ainda não foi concluído.\n\nClique no link pra criar seu nome, email e senha:\n${linkAcesso(token)}\n\nO link expira em ${TOKEN_VALIDADE_DIAS} dias.`;
  const enviado = await enviarWhatsappPara(user.telefone, texto);

  revalidatePath(`/clientes/${clienteId}/portal`);
  return enviado ? { ok: true } : { ok: false, erro: "Falha ao enviar o WhatsApp." };
}

export async function togglePortalUsuario(id: number, clienteId: number, ativoAtual: boolean): Promise<void> {
  await db.$executeRaw`
    UPDATE portal_usuarios SET ativo = ${!ativoAtual} WHERE id = ${id}
  `;
  revalidatePath(`/clientes/${clienteId}/portal`);
}
