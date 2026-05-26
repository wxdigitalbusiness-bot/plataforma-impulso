"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { TIPOS_SERVICO_VALUES } from "./_servicos";

const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  empresa: z.preprocess(
    (v) => (!v || String(v).trim() === "" ? null : String(v).trim()),
    z.string().nullable()
  ),
  whatsappAlerta: z.preprocess(
    (v) => (!v || String(v).trim() === "" ? null : String(v).trim()),
    z.string().regex(/^\d{12,13}$/, "WhatsApp com DDI 55 sem espaços").nullable()
  ),
  tipoServico: z.preprocess(
    (v) => (!v || String(v).trim() === "" ? null : String(v).trim()),
    z.enum(TIPOS_SERVICO_VALUES as unknown as [string, ...string[]]).nullable()
  ),
  ativo: z.coerce.boolean(),
});

function parseForm(formData: FormData) {
  return clienteSchema.parse({
    nome: formData.get("nome"),
    empresa: formData.get("empresa"),
    whatsappAlerta: formData.get("whatsappAlerta"),
    tipoServico: formData.get("tipoServico"),
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarCliente(formData: FormData) {
  const data = parseForm(formData);
  const cliente = await db.cliente.create({
    data: {
      nome: data.nome,
      empresa: data.empresa,
      whatsappAlerta: data.whatsappAlerta,
      tipoServico: data.tipoServico,
      ativo: data.ativo,
    },
  });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function atualizarCliente(id: number, formData: FormData) {
  const data = parseForm(formData);
  await db.cliente.update({
    where: { id },
    data: {
      nome: data.nome,
      empresa: data.empresa,
      whatsappAlerta: data.whatsappAlerta,
      tipoServico: data.tipoServico,
      ativo: data.ativo,
    },
  });

  // Backward-compat: propagar valores pras contas (workflows legados leem de
  // clientes_ativos.empresa/whatsapp_alerta). Os workflows atualizados leem do
  // parent via JOIN, mas mantemos a sincronia até a migração completa.
  await db.clienteAtivo.updateMany({
    where: { clienteId: id },
    data: {
      empresa: data.empresa ?? "",
      whatsappAlerta: data.whatsappAlerta,
    },
  });

  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function excluirCliente(id: number) {
  // ON DELETE SET NULL na FK preserva as contas (cliente_id vira NULL)
  await db.cliente.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect("/clientes");
}
