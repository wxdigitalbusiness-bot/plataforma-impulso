"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadArquivo, deletarArquivo, pathFromUrl } from "@/lib/s3";

const TAMANHO_MAX = 15 * 1024 * 1024; // 15MB — mesmo limite do bodySizeLimit em next.config.ts

export async function enviarDocumento(
  clienteId: number,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, erro: "Não autenticado." };

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Nenhum arquivo selecionado." };
  }
  if (file.size > TAMANHO_MAX) {
    return { ok: false, erro: "Arquivo muito grande — máximo 15MB." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `clientes/${clienteId}/documentos/${Date.now()}-${file.name}`;
    const url = await uploadArquivo(path, buffer, file.type || "application/octet-stream");

    await db.clienteDocumento.create({
      data: {
        clienteId,
        nome: file.name,
        url,
        tamanho: file.size,
        tipo: file.type || "application/octet-stream",
        enviadoPor: session.user.email,
      },
    });
    revalidatePath(`/clientes/${clienteId}/documentos`);
    return { ok: true };
  } catch (err) {
    console.error("[enviarDocumento]", err);
    return { ok: false, erro: "Falha ao enviar o arquivo. Tente de novo." };
  }
}

export async function excluirDocumento(
  documentoId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const doc = await db.clienteDocumento.findUnique({ where: { id: documentoId } });
  if (!doc) return { ok: false, erro: "Documento não encontrado." };

  const path = pathFromUrl(doc.url);
  if (path) {
    try {
      await deletarArquivo(path);
    } catch (err) {
      console.error("[excluirDocumento] falha ao apagar do S3:", err);
    }
  }

  await db.clienteDocumento.delete({ where: { id: documentoId } });
  revalidatePath(`/clientes/${doc.clienteId}/documentos`);
  return { ok: true };
}
