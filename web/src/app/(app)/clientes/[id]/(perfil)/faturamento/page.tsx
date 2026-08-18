import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NovaFatura } from "./_nova-fatura";
import { FaturaRowActions } from "./_fatura-row-actions";
import { VisibilidadePortalToggle } from "../_visibilidade-toggle";

export const dynamic = "force-dynamic";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// vencimento é @db.Date (sem hora) — formata em UTC pra não recuar um dia
// no fuso local (o valor guardado já é a data pretendida, sem componente de hora).
function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

type Props = { params: Promise<{ id: string }> };

export default async function FaturamentoClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const [cliente, faturas] = await Promise.all([
    db.cliente.findUnique({ where: { id: clienteId }, select: { portalMostrarFaturamento: true } }),
    db.clienteFatura.findMany({
      where: { clienteId },
      orderBy: { vencimento: "desc" },
    }),
  ]);
  if (!cliente) notFound();

  const hoje = new Date();
  const linhas = faturas.map((f) => {
    const valor = Number(f.valor);
    const atrasada = !f.pago && f.vencimento < hoje;
    const status: "pago" | "atrasado" | "pendente" = f.pago ? "pago" : atrasada ? "atrasado" : "pendente";
    return { ...f, valor, status };
  });

  const totalPendente = linhas.filter((f) => f.status !== "pago").reduce((s, f) => s + f.valor, 0);
  const totalAtrasado = linhas.filter((f) => f.status === "atrasado").reduce((s, f) => s + f.valor, 0);
  const totalPago = linhas.filter((f) => f.status === "pago").reduce((s, f) => s + f.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Faturamento</h2>
        <div className="flex items-center gap-3">
          <VisibilidadePortalToggle
            clienteId={clienteId}
            aba="faturamento"
            visivelInicial={cliente.portalMostrarFaturamento}
          />
          <NovaFatura clienteId={clienteId} />
        </div>
      </div>

      {faturas.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Em aberto</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{fmtBRL(totalPendente)}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600">Atrasado</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{fmtBRL(totalAtrasado)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Pago</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{fmtBRL(totalPago)}</p>
          </div>
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nenhuma fatura registrada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {linhas.map((f) => (
                <tr key={f.id.toString()} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{f.descricao}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                    {fmtDate(f.vencimento)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-800">{fmtBRL(f.valor)}</td>
                  <td className="px-4 py-2.5">
                    {f.status === "pago" && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        pago
                      </span>
                    )}
                    {f.status === "atrasado" && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        atrasado
                      </span>
                    )}
                    {f.status === "pendente" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <FaturaRowActions faturaId={Number(f.id)} pago={f.pago} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
