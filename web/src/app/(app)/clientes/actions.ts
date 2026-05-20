"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const clienteSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  empresa: z.string().min(1, "Empresa obrigatória"),
  metaAdAccountId: z
    .string()
    .min(1)
    .regex(/^act_\d+$/, "Use o formato act_<id_numerico>"),
  whatsappAlerta: z
    .string()
    .regex(/^\d{12,13}$/, "WhatsApp com DDI 55 sem espaços")
    .or(z.literal("").transform(() => null))
    .nullable()
    .optional(),
  limiteMinimo: z.coerce.number().min(0),
  moeda: z.string().min(1).default("BRL"),
  receberAlertaSaldo: z.coerce.boolean(),
  // Google Ads
  googleAdCustomerId: z
    .string()
    .regex(/^\d+$/, "Customer ID deve conter apenas números")
    .or(z.literal("").transform(() => null))
    .nullable()
    .optional(),
  limiteMinimoGoogle: z.coerce.number().min(0).default(100),
  receberAlertaGoogle: z.coerce.boolean(),
  ativo: z.coerce.boolean(),
});

function parseForm(formData: FormData) {
  return clienteSchema.parse({
    nome: formData.get("nome"),
    empresa: formData.get("empresa"),
    metaAdAccountId: formData.get("metaAdAccountId"),
    whatsappAlerta: formData.get("whatsappAlerta"),
    limiteMinimo: formData.get("limiteMinimo"),
    moeda: formData.get("moeda") || "BRL",
    receberAlertaSaldo: formData.get("receberAlertaSaldo") === "on",
    googleAdCustomerId: formData.get("googleAdCustomerId"),
    limiteMinimoGoogle: formData.get("limiteMinimoGoogle"),
    receberAlertaGoogle: formData.get("receberAlertaGoogle") === "on",
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarCliente(formData: FormData) {
  const data = parseForm(formData);
  await db.clienteAtivo.create({
    data: {
      ...data,
      whatsappAlerta: data.whatsappAlerta || null,
      googleAdCustomerId: data.googleAdCustomerId || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function atualizarCliente(id: number, formData: FormData) {
  const data = parseForm(formData);
  await db.clienteAtivo.update({
    where: { id },
    data: {
      ...data,
      whatsappAlerta: data.whatsappAlerta || null,
      googleAdCustomerId: data.googleAdCustomerId || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function excluirCliente(id: number) {
  await db.clienteAtivo.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect("/clientes");
}
