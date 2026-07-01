"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

function gerarSlug() {
  return randomBytes(5).toString("hex"); // 10 chars hex
}

export async function criarLink(
  clienteId: number,
  nome: string,
  waNumero: string,
  mensagem: string
) {
  nome = nome.trim();
  waNumero = waNumero.trim().replace(/\D/g, "");
  mensagem = mensagem.trim();

  if (!nome || !waNumero) return { ok: false, erro: "Nome e número são obrigatórios." };

  let slug = gerarSlug();
  // retry se colidir (raro)
  for (let i = 0; i < 3; i++) {
    try {
      await db.$executeRaw`
        INSERT INTO crm_whatsapp_links (cliente_id, nome, wa_numero, mensagem, slug)
        VALUES (${clienteId}, ${nome}, ${waNumero}, ${mensagem}, ${slug})
      `;
      revalidatePath("/crm/whatsapp");
      return { ok: true };
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("unique")) {
        slug = gerarSlug();
      } else {
        return { ok: false, erro: "Erro ao criar link." };
      }
    }
  }
  return { ok: false, erro: "Erro ao gerar link único. Tente novamente." };
}

export async function atualizarLink(
  id: number,
  nome: string,
  waNumero: string,
  mensagem: string
) {
  nome = nome.trim();
  waNumero = waNumero.trim().replace(/\D/g, "");
  mensagem = mensagem.trim();

  if (!nome || !waNumero) return { ok: false, erro: "Nome e número são obrigatórios." };

  try {
    await db.$executeRaw`
      UPDATE crm_whatsapp_links
      SET nome = ${nome}, wa_numero = ${waNumero}, mensagem = ${mensagem}
      WHERE id = ${id}
    `;
    revalidatePath("/crm/whatsapp");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Erro ao atualizar link." };
  }
}

export async function alternarAtivo(id: number, ativo: boolean) {
  await db.$executeRaw`
    UPDATE crm_whatsapp_links SET ativo = ${ativo} WHERE id = ${id}
  `;
  revalidatePath("/crm/whatsapp");
  return { ok: true };
}

export async function removerLink(id: number) {
  await db.$executeRaw`DELETE FROM crm_whatsapp_links WHERE id = ${id}`;
  revalidatePath("/crm/whatsapp");
  return { ok: true };
}
