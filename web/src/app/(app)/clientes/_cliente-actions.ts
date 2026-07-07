"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { TIPOS_SERVICO_VALUES } from "./_servicos";

const nullable = (v: unknown) =>
  !v || String(v).trim() === "" ? null : String(v).trim();

const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  empresa: z.preprocess(nullable, z.string().nullable()),
  whatsappAlerta: z.preprocess(
    nullable,
    z.string().regex(/^\d{12,13}$/, "WhatsApp com DDI 55 sem espaços").nullable()
  ),
  tipoServico: z.preprocess(
    nullable,
    z.enum(TIPOS_SERVICO_VALUES as unknown as [string, ...string[]]).nullable()
  ),
  n8nClientKey: z.preprocess(
    (v) => (!v || String(v).trim() === "" ? null : String(v).trim().toLowerCase()),
    z.string().nullable()
  ),
  ativo: z.coerce.boolean(),
  // Meta CAPI
  pixelId:                  z.preprocess(nullable, z.string().nullable()),
  capiToken:                z.preprocess(nullable, z.string().nullable()),
  // Google Ads
  googleAdsCustomerId:                   z.preprocess(nullable, z.string().nullable()),
  googleConversionActionId:              z.preprocess(nullable, z.string().nullable()),
  googleConversionActionIdQualificado:   z.preprocess(nullable, z.string().nullable()),
});

function parseForm(formData: FormData) {
  return clienteSchema.parse({
    nome: formData.get("nome"),
    empresa: formData.get("empresa"),
    whatsappAlerta: formData.get("whatsappAlerta"),
    tipoServico: formData.get("tipoServico"),
    n8nClientKey: formData.get("n8nClientKey"),
    ativo: formData.get("ativo") === "on",
    pixelId:                  formData.get("pixelId"),
    capiToken:                formData.get("capiToken"),
    googleAdsCustomerId:                   formData.get("googleAdsCustomerId"),
    googleConversionActionId:              formData.get("googleConversionActionId"),
    googleConversionActionIdQualificado:   formData.get("googleConversionActionIdQualificado"),
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
      n8nClientKey: data.n8nClientKey,
      ativo: data.ativo,
      pixelId:                  data.pixelId,
      capiToken:                data.capiToken,
      googleAdsCustomerId:                   data.googleAdsCustomerId,
      googleConversionActionId:              data.googleConversionActionId,
      googleConversionActionIdQualificado:   data.googleConversionActionIdQualificado,
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
      n8nClientKey: data.n8nClientKey,
      ativo: data.ativo,
      pixelId:                  data.pixelId,
      capiToken:                data.capiToken,
      googleAdsCustomerId:                   data.googleAdsCustomerId,
      googleConversionActionId:              data.googleConversionActionId,
      googleConversionActionIdQualificado:   data.googleConversionActionIdQualificado,
    },
  });

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
  await db.cliente.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/clientes");
  redirect("/clientes");
}
