import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { listarHistorico } from "@/lib/historico";
import { HistoricoTimeline } from "@/components/historico/timeline";
import { VisibilidadePortalToggle } from "../_visibilidade-toggle";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ClienteHistoricoPage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, portalMostrarHistorico: true },
  });
  if (!cliente) notFound();

  const entradas = await listarHistorico(clienteId);
  const noPortal = entradas.filter((e) => e.visivel_portal).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/clientes/${cliente.id}`} className="text-xs text-neutral-500 hover:underline">
            ← {cliente.nome}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Histórico</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {entradas.length === 0
              ? "Nenhum registro ainda."
              : `${entradas.length} ${entradas.length === 1 ? "registro" : "registros"} · ${noPortal} ${noPortal === 1 ? "visível" : "visíveis"} no portal`}
          </p>
        </div>
        <VisibilidadePortalToggle
          clienteId={cliente.id}
          aba="historico"
          visivelInicial={cliente.portalMostrarHistorico}
        />
      </header>

      <HistoricoTimeline
        entradas={entradas}
        clientes={[cliente]}
        clienteFixoId={cliente.id}
      />
    </div>
  );
}
