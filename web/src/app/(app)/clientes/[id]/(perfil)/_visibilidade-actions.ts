"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type AbaPortal =
  | "dashboard"
  | "crm"
  | "relatorios"
  | "resultados"
  | "historico"
  | "documentos"
  | "faturamento";

export async function alternarVisibilidadePortal(
  clienteId: number,
  aba: AbaPortal,
  valor: boolean,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado." };

  const data =
    aba === "dashboard"   ? { portalMostrarDashboard: valor }   :
    aba === "crm"         ? { portalMostrarCrm: valor }         :
    aba === "relatorios"  ? { portalMostrarRelatorios: valor }  :
    aba === "resultados"  ? { portalMostrarResultados: valor }  :
    aba === "historico"   ? { portalMostrarHistorico: valor }   :
    aba === "documentos"  ? { portalMostrarDocumentos: valor }  :
                             { portalMostrarFaturamento: valor };

  await db.cliente.update({ where: { id: clienteId }, data });
  revalidatePath(`/clientes/${clienteId}`, "layout");
  return { ok: true };
}
