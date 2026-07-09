"use server";

import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { signPortalToken, portalCookieOptions, PORTAL_COOKIE } from "@/lib/portal-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginPortal(_: unknown, formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const senha = formData.get("senha")?.toString() ?? "";

  if (!email || !senha) return { error: "Preencha e-mail e senha." };

  const usuario = await db.portalUsuario.findUnique({
    where: { email, ativo: true },
    include: { cliente: { select: { id: true, nome: true } } },
  });

  if (!usuario || !(await compare(senha, usuario.senhaHash))) {
    return { error: "E-mail ou senha incorretos." };
  }

  const token = signPortalToken({
    usuarioId:   usuario.id,
    clienteId:   usuario.clienteId,
    role:        usuario.role as "admin" | "operador" | "visualizador",
    nome:        usuario.nome,
    clienteNome: usuario.cliente.nome,
  });

  const jar = await cookies();
  jar.set(PORTAL_COOKIE, token, portalCookieOptions());

  redirect("/portal/kanban");
}

export async function logoutPortal() {
  const jar = await cookies();
  jar.delete(PORTAL_COOKIE);
  redirect("/portal/login");
}
