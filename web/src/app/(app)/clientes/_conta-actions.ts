"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ContaActionState = { erro: string } | null;

const contaSchema = z
  .object({
    clienteId: z.coerce.number().int().positive("Cliente obrigatório"),
    nome: z.string().trim().min(1, "Nome obrigatório"),

    // Meta Ads (opcional — vazio = conta sem Meta Ads)
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

    // Google Ads (opcional — vazio = conta sem Google Ads)
    googleAdCustomerId: z.preprocess(
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

    ativo: z.coerce.boolean(),
  })
  .refine(
    (data) => !!data.metaAdAccountId || !!data.googleAdCustomerId,
    { message: "A conta precisa ter ao menos Meta Ads ou Google Ads configurado." }
  );

function parseForm(formData: FormData) {
  const result = contaSchema.safeParse({
    clienteId: formData.get("clienteId"),
    nome: formData.get("nome"),
    metaAdAccountId: formData.get("metaAdAccountId"),
    limiteMinimo: formData.get("limiteMinimo"),
    moeda: formData.get("moeda") || "BRL",
    receberAlertaSaldo: formData.get("receberAlertaSaldo") === "on",
    googleAdCustomerId: formData.get("googleAdCustomerId"),
    googleAdsMccId: formData.get("googleAdsMccId"),
    limiteMinimoGoogle: formData.get("limiteMinimoGoogle"),
    receberAlertaGoogle: formData.get("receberAlertaGoogle") === "on",
    ativo: formData.get("ativo") === "on",
  });
  return result;
}

function erroUniqueConstraint(err: unknown): ContaActionState {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const fields = (err.meta?.target as string[] | undefined) ?? [];
    if (fields.some((f) => f.includes("meta")))
      return { erro: "Este Ad Account ID (Meta) já está cadastrado em outra conta." };
    if (fields.some((f) => f.includes("google")))
      return { erro: "Este Customer ID (Google) já está cadastrado em outra conta." };
    return { erro: "Um dos IDs informados já está vinculado a outra conta." };
  }
  throw err;
}

// Lê empresa+whatsapp do cliente parent para denormalizar em clientes_ativos.
// Compat com workflows legados que leem esses campos direto da tabela de conta.
async function dadosDoCliente(clienteId: number) {
  const c = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { empresa: true, whatsappAlerta: true },
  });
  return {
    empresa: c?.empresa ?? "",
    whatsappAlerta: c?.whatsappAlerta ?? null,
  };
}

export async function criarConta(
  _prevState: ContaActionState,
  formData: FormData,
): Promise<ContaActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success)
    return { erro: parsed.error.issues[0].message };

  const data = parsed.data;
  const parent = await dadosDoCliente(data.clienteId);

  try {
    await db.clienteAtivo.create({
      data: {
        clienteId: data.clienteId,
        nome: data.nome,
        empresa: parent.empresa,
        whatsappAlerta: parent.whatsappAlerta,
        metaAdAccountId: data.metaAdAccountId ?? null,
        limiteMinimo: data.limiteMinimo,
        moeda: data.moeda,
        receberAlertaSaldo: data.receberAlertaSaldo,
        googleAdCustomerId: data.googleAdCustomerId ?? null,
        googleAdsMccId: data.googleAdsMccId ?? null,
        limiteMinimoGoogle: data.limiteMinimoGoogle,
        receberAlertaGoogle: data.receberAlertaGoogle,
        ativo: data.ativo,
      },
    });
  } catch (err) {
    return erroUniqueConstraint(err);
  }

  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.clienteId}`);
  redirect(`/clientes/${data.clienteId}`);
}

export async function atualizarConta(
  contaId: number,
  _prevState: ContaActionState,
  formData: FormData,
): Promise<ContaActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success)
    return { erro: parsed.error.issues[0].message };

  const data = parsed.data;
  const parent = await dadosDoCliente(data.clienteId);

  try {
    await db.clienteAtivo.update({
      where: { id: contaId },
      data: {
        clienteId: data.clienteId,
        nome: data.nome,
        empresa: parent.empresa,
        whatsappAlerta: parent.whatsappAlerta,
        metaAdAccountId: data.metaAdAccountId ?? null,
        limiteMinimo: data.limiteMinimo,
        moeda: data.moeda,
        receberAlertaSaldo: data.receberAlertaSaldo,
        googleAdCustomerId: data.googleAdCustomerId ?? null,
        googleAdsMccId: data.googleAdsMccId ?? null,
        limiteMinimoGoogle: data.limiteMinimoGoogle,
        receberAlertaGoogle: data.receberAlertaGoogle,
        ativo: data.ativo,
      },
    });
  } catch (err) {
    return erroUniqueConstraint(err);
  }

  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.clienteId}`);
  redirect(`/clientes/${data.clienteId}`);
}

export async function excluirConta(clienteId: number, contaId: number) {
  await db.clienteAtivo.delete({ where: { id: contaId } });
  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}`);
}
