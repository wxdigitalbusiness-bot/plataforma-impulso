import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusBadge: Record<string, { label: string; cls: string }> = {
  rodando: { label: "Rodando", cls: "bg-blue-50 text-blue-700" },
  concluido: { label: "Concluído", cls: "bg-neutral-100 text-neutral-700" },
  abortado: { label: "Abortado", cls: "bg-neutral-100 text-neutral-500" },
  promovido: { label: "Promovido", cls: "bg-emerald-50 text-emerald-700" },
};

function formatDateBR(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default async function ExperimentosPage() {
  const experimentos = await db.botExperimentoAb.findMany({
    orderBy: [{ status: "asc" }, { dataInicio: "desc" }],
    take: 50,
  });

  const rodando = experimentos.filter((e) => e.status === "rodando").length;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experimentos A/B</h1>
          <p className="text-sm text-neutral-500">
            Testes de variações do prompt do bot. Aprovados via análise semanal.
          </p>
        </div>
        <Link href="/bot" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Voltar pro bot
        </Link>
      </header>

      {rodando > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>Lembrete:</strong> a v4 do bot (que faz o roteamento A/B real) ainda
          não foi publicada. Experimentos com status <strong>rodando</strong> estão registrados mas
          ainda não dividem leads. Quando a v4 for ao ar, o roteamento começa automaticamente.
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white">
        {experimentos.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">
            Nenhum experimento criado ainda. Aprove uma sugestão na análise semanal pra começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Modo</th>
                <th className="px-5 py-3 text-left">Métrica</th>
                <th className="px-5 py-3 text-right">Iniciado</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Vencedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {experimentos.map((e) => {
                const status = statusBadge[e.status] ?? { label: e.status, cls: "bg-neutral-100" };
                return (
                  <tr key={e.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-900">{e.nome}</p>
                      {e.hipotese && (
                        <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-neutral-500">
                          {e.hipotese}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{e.modoAlvo}</td>
                    <td className="px-5 py-3 text-neutral-700">{e.metricaAlvo}</td>
                    <td className="px-5 py-3 text-right text-xs text-neutral-500">
                      {formatDateBR(e.dataInicio)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">
                      {e.vencedor ? (
                        <span className="font-semibold text-emerald-700">{e.vencedor}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
