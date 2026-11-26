"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { uploadArquivo } from "@/lib/s3";

export type LinkItem = { label: string; url: string; ativo: boolean };

type Result = { ok: true } | { ok: false; erro: string };
type ResultComId = { ok: true; id: number } | { ok: false; erro: string };
type ResultComUrl = { ok: true; url: string } | { ok: false; erro: string };

const TAMANHO_MAX_FOTO = 5 * 1024 * 1024; // 5MB

export async function uploadFotoLinkPage(formData: FormData): Promise<ResultComUrl> {
  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Nenhum arquivo selecionado." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, erro: "Envie uma imagem (JPG, PNG, WebP)." };
  }
  if (file.size > TAMANHO_MAX_FOTO) {
    return { ok: false, erro: "Imagem muito grande — máximo 5MB." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] ?? "jpg";
    const path = `link-pages/foto-${Date.now()}-${gerarSlugAleatorio()}.${ext}`;
    const url = await uploadArquivo(path, buffer, file.type);
    return { ok: true, url };
  } catch (err) {
    console.error("[uploadFotoLinkPage]", err);
    return { ok: false, erro: "Falha ao enviar a imagem. Tente de novo." };
  }
}

function gerarSlugAleatorio(): string {
  return randomBytes(4).toString("hex");
}

function slugificar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function limparLinks(links: LinkItem[]) {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim(), ativo: l.ativo }))
    .filter((l) => l.label && l.url);
}

export async function criarLinkPage(input: {
  nome: string;
  clienteId: number | null;
  slugCustom: string;
  titulo: string;
  bio: string;
  fotoUrl: string;
  corFundo: string;
  links: LinkItem[];
}): Promise<ResultComId> {
  const nome = input.nome.trim();
  if (!nome) return { ok: false, erro: "Dê um nome pra esse QR Code." };

  let slug = slugificar(input.slugCustom) || gerarSlugAleatorio();
  const existente = await db.linkPage.findUnique({ where: { slug } });
  if (existente) slug = `${slug}-${gerarSlugAleatorio().slice(0, 4)}`;

  const page = await db.linkPage.create({
    data: {
      slug,
      nome,
      clienteId: input.clienteId,
      titulo: input.titulo.trim() || null,
      bio: input.bio.trim() || null,
      fotoUrl: input.fotoUrl.trim() || null,
      corFundo: input.corFundo.trim() || null,
      links: limparLinks(input.links),
    },
  });

  revalidatePath("/qrcodes");
  return { ok: true, id: page.id };
}

export async function atualizarLinkPage(
  id: number,
  input: {
    nome: string;
    clienteId: number | null;
    titulo: string;
    bio: string;
    fotoUrl: string;
    corFundo: string;
    links: LinkItem[];
    ativo: boolean;
  },
): Promise<Result> {
  const nome = input.nome.trim();
  if (!nome) return { ok: false, erro: "Dê um nome pra esse QR Code." };

  await db.linkPage.update({
    where: { id },
    data: {
      nome,
      clienteId: input.clienteId,
      titulo: input.titulo.trim() || null,
      bio: input.bio.trim() || null,
      fotoUrl: input.fotoUrl.trim() || null,
      corFundo: input.corFundo.trim() || null,
      links: limparLinks(input.links),
      ativo: input.ativo,
    },
  });

  revalidatePath("/qrcodes");
  revalidatePath(`/qrcodes/${id}/editar`);
  return { ok: true };
}

export async function excluirLinkPage(id: number): Promise<void> {
  await db.linkPage.delete({ where: { id } });
  revalidatePath("/qrcodes");
  redirect("/qrcodes");
}
