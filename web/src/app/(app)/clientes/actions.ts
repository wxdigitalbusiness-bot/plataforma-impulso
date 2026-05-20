"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const clienteSchema = z
  .object({
    nome: z.string().min(1, "Nome obrigatório"),
    empresa: z.string().min(1, "Empresa obrigatória"),

    // Meta Ads (opcional — vazio = cliente sem Meta Ads)
    metaAdAccountId: z.preprocess(
      (v) => (!v || String(v).trim() === "" ? null : String(v).trim()),
      z
        .string()
        .regex(/^act_\d+$/, "Use o formato act_<id_numerico>")
        .nullable()
    ),
    limiteMinimo: z.coerce.number().min(0).default(100),
    moeda: z.string().min(1).default("BRL"),
    receberAlertaSaldo: z.coerce.boolean(),

    // Google Ads (opcional — vazio = cliente sem Google Ads)
    googleAdCustomerId: z.preprocess(
      // remove traços (ex: "247-323-3407" → "2473233407") e converte vazio em null
      (v) => (!v || String(v).trim() === "" ? null : String(v).replace(/-/g, "").trim()),
      z
        .string()
        .regex(/^\d+$/, "Customer ID deve conter apenas números")
        .nullable()
    ),
    googleAdsMccId: z.preprocess(
      (v) => (!v || String(v).trim() === "" ? null : String(v).replace(/-/g, "").trim()),
      z
        .string()
        .regex(/^\d+$/, "MCC ID deve conter apenas números")
        .nullable()
    ),
    limiteMinimoGoogle: z.coerce.number().min(0).default(100),
    receberAlertaGoogle: z.coerce.boolean(),

    whatsappAlerta: z.preprocess(
      (v) => (!v || String(v).trim() === "" ? null : String(v).trim()),
      z.string().regex(/^\d{12,13}$/, "WhatsApp com DDI 55 sem espaços").nullable()
    ),
    ativo: z.coerce.boolean(),
  })
  .refine(
    (data) => !!data.metaAdAccountId || !!data.googleAdCustomerId,
    { message: "O cliente precisa ter ao menos Meta Ads ou Google Ads configurado." }
  );

function parseForm(formData: FormData) {
  return clienteSchema.parse({
    nome: formData.get("nome"),
    empresa: formData.get("empresa"),
    metaAdAccountId: formData.get("metaAdAccountId"),
    limiteMinimo: formData.get("limiteMinimo"),
    moeda: formData.get("moeda") || "BRL",
    receberAlertaSaldo: formData.get("receberAlertaSaldo") === "on",
    googleAdCustomerId: formData.get("googleAdCustomerId"),
    googleAdsMccId: formData.get("googleAdsMccId"),
    limiteMinimoGoogle: formData.get("limiteMinimoGoogle"),
    receberAlertaGoogle: formData.get("receberAlertaGoogle") === "on",
    whatsappAlerta: formData.get("whatsappAlerta"),
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarCliente(formData: FormData) {
  const data = parseForm(formData);
  await db.clienteAtivo.create({
    data: {
      nome: data.nome,
      empresa: data.empresa,
      metaAdAccountId: data.metaAdAccountId ?? null,
      limiteMinimo: data.limiteMinimo,
      moeda: data.moeda,
      receberAlertaSaldo: data.receberAlertaSaldo,
      googleAdCustomerId: data.googleAdCustomerId ?? null,
      googleAdsMccId: data.googleAdsMccId ?? null,
      limiteMinimoGoogle: data.limiteMinimoGoogle,
      receberAlertaGoogle: data.receberAlertaGoogle,
      whatsappAlerta: data.whatsappAlerta ?? null,
      ativo: data.ativo,
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
      nome: data.nome,
      empresa: data.empresa,
      metaAdAccountId: data.metaAdAccountId ?? null,
      limiteMinimo: data.limiteMinimo,
      moeda: data.moeda,
      receberAlertaSaldo: data.receberAlertaSaldo,
      googleAdCustomerId: data.googleAdCustomerId ?? null,
      googleAdsMccId: data.googleAdsMccId ?? null,
      limiteMinimoGoogle: data.limiteMinimoGoogle,
      receberAlertaGoogle: data.receberAlertaGoogle,
      whatsappAlerta: data.whatsappAlerta ?? null,
      ativo: data.ativo,
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
