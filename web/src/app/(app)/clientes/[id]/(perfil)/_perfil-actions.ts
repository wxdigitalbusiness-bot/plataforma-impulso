"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadArquivo } from "@/lib/s3";

const TAMANHO_MAX = 5 * 1024 * 1024; // 5MB

export async function trocarFotoCliente(
  clienteId: number,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Nenhum arquivo selecionado." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, erro: "Envie uma imagem (JPG, PNG, WebP)." };
  }
  if (file.size > TAMANHO_MAX) {
    return { ok: false, erro: "Imagem muito grande — máximo 5MB." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] ?? "jpg";
    const path = `clientes/${clienteId}/foto-${Date.now()}.${ext}`;
    const url = await uploadArquivo(path, buffer, file.type);

    await db.cliente.update({ where: { id: clienteId }, data: { fotoUrl: url } });
    revalidatePath(`/clientes/${clienteId}`);
    return { ok: true, url };
  } catch (err) {
    console.error("[trocarFotoCliente]", err);
    return { ok: false, erro: "Falha ao enviar a imagem. Tente de novo." };
  }
}
