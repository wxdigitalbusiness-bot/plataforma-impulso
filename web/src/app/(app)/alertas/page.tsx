import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const alertas = await db.alertaSaldoLog.findMany({
    include: { cliente: true },
    orderBy: { enviadoEm: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de alertas</h1>
        <p className="text-sm text-neutral-500">
          Últimos 100 alertas enviados pelo workflow n8n
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Limite</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {alertas.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-neutral-600">
                  {a.enviadoEm.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{a.cliente.nome}</p>
                  <p className="text-xs text-neutral-500">{a.cliente.empresa}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium text-red-600">
                  R$ {Number(a.saldoNoMomento).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-neutral-600">
                  R$ {Number(a.limiteNoMomento).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">{a.whatsappDestino}</td>
                <td className="px-4 py-3">
                  {a.status === "enviado" ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      enviado
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      falhou
                    </span>
                  )}
                  {a.erro && (
                    <p className="mt-1 text-xs text-red-600">{a.erro}</p>
                  )}
                </td>
              </tr>
            ))}
            {alertas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-500">
                  Nenhum alerta enviado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
