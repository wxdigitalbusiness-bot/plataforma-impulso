import { db } from "@/lib/db";
import { listarHistorico } from "@/lib/historico";
import { HistoricoTimeline } from "@/components/historico/timeline";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const [entradas, clientes] = await Promise.all([
    listarHistorico(),
    db.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-neutral-500">
          O que foi feito para cada cliente, em ordem cronológica.
        </p>
      </header>

      <HistoricoTimeline entradas={entradas} clientes={clientes} />
    </div>
  );
}
