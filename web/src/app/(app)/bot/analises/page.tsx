import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPct(taxa: number | null | undefined): string {
  if (taxa === null || taxa === undefined) return "—";
  return `${(taxa * 100).toFixed(1)}%`;
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  em_revisao: { label: "Em revisão", cls: "bg-blue-50 text-blue-700" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-50 text-emerald-700" },
  rejeitada: { label: "Rejeitada", cls: "bg-neutral-100 text-neutral-600" },
  aplicada: { label: "Aplicada", cls: "bg-violet-50 text-violet-700" },
};

export default async function AnalisesListaPage() {
  const analises = await db.botAnaliseSemanal.findMany({
    orderBy: { periodoInicio: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Análises semanais</h1>
          <p className="text-sm text-neutral-500">
            Relatórios gerados toda segunda-feira pelo Claude analista.
          </p>
        </div>
        <Link
          href="/bot"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Voltar pro bot
        </Link>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white">
        {analises.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-neutral-500">
            Nenhuma análise gerada ainda. O cron roda toda segunda 09h BRT.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-3 text-left">Período</th>
                <th className="px-5 py-3 text-right">Conversas</th>
                <th className="px-5 py-3 text-right">Fechadas</th>
                <th className="px-5 py-3 text-right">Taxa</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Gerado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {analises.map((a) => {
                const status = statusBadge[a.status] ?? { label: a.status, cls: "bg-neutral-100" };
                return (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/bot/analises/${a.id}`}
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {formatDateBR(a.periodoInicio)} – {formatDateBR(a.periodoFim)}
                      </Link>
                      {a.resumoExecutivo && (
                        <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-neutral-500">
                          {a.resumoExecutivo}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-700">{a.totalConversas}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-700">
                      {a.fechadas}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-700">
                      {a.taxaFechamento ? formatPct(Number(a.taxaFechamento)) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-neutral-400">
                      {a.criadoEm.toLocaleDateString("pt-BR")}
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
