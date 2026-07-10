import { db } from "@/lib/db";
import { TarefasBoard } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarefas" };

export default async function TarefasPage() {
  const clientes = await db.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return <TarefasBoard clientes={clientes} />;
}
