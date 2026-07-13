import { db } from "@/lib/db";
import { TarefasBoard } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarefas" };

export default async function TarefasPage() {
  const [clientes, admins, clientesResp] = await Promise.all([
    db.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    db.usuario.findMany({
      where: { ativo: true },
      select: { nome: true },
      orderBy: { nome: "asc" },
    }),
    db.cliente.findMany({
      where: { ativo: true },
      select: { nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <TarefasBoard
      clientes={clientes}
      responsaveis={{ admins, clientes: clientesResp }}
    />
  );
}
