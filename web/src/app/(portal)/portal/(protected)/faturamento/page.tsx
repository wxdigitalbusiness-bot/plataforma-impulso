import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function PortalFaturamentoPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const faturas = await db.clienteFatura.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { vencimento: "desc" },
  });

  const hoje = new Date();
  const linhas = faturas.map((f) => {
    const valor = Number(f.valor);
    const atrasada = !f.pago && f.vencimento < hoje;
    const status: "pago" | "atrasado" | "pendente" = f.pago ? "pago" : atrasada ? "atrasado" : "pendente";
    return { ...f, valor, status };
  });

  const totalPendente = linhas.filter((f) => f.status !== "pago").reduce((s, f) => s + f.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Faturamento</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Cobranças da agência referentes ao seu contrato.</p>
      </div>

      {linhas.length > 0 && totalPendente > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Total em aberto</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{fmtBRL(totalPendente)}</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
