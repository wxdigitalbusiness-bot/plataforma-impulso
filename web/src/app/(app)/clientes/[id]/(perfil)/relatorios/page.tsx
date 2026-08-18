import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GerarRelatorioButton } from "../performance/_gerar-relatorio";
import { listarMesesRecentes, mesAtualEmCurso } from "@/lib/relatorios";
import { VisibilidadePortalToggle } from "../_visibilidade-toggle";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

// dateFrom/dateTo são @db.Date (sem hora) — formata em UTC pra não recuar um
// dia no fuso local (o valor guardado já é a data pretendida).
function fmtDateOnly(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type Props = { params: Promise<{ id: string }> };

export default async function RelatoriosClientePage({ params }: Props) {
  const { id } = await params;
  const clienteId = Number(id);
  if (Number.isNaN(clienteId)) notFound();

  const [cliente, relatorios] = await Promise.all([
    db.cliente.findUnique({ where: { id: clienteId }, select: { portalMostrarRelatorios: true } }),
    db.relatorioPublico.findMany({
      where: { clienteId },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        token: true,
        tipo: true,
        dateFrom: true,
        dateTo: true,
        criadoEm: true,
        expiraEm: true,
        revogado: true,
      },
    }),
  ]);
  if (!cliente) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Relatórios</h2>
        <div className="flex items-center gap-3">
          <VisibilidadePortalToggle
            clienteId={clienteId}
            aba="relatorios"
            visivelInicial={cliente.portalMostrarRelatorios}
          />
          <GerarRelatorioButton
            clienteId={clienteId}
            meses={listarMesesRecentes(12).filter((m) => m.value !== mesAtualEmCurso())}
            defaultMesAno={listarMesesRecentes(2).filter((m) => m.value !== mesAtualEmCurso())[0]?.value ?? ""}
          />
        </div>
      </div>

      {relatorios.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nenhum relatório gerado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Gerado em</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {relatorios.map((r) => {
                const expirado = r.expiraEm !== null && r.expiraEm < new Date();
                return (
                  <tr key={r.id.toString()} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 font-medium text-neutral-800">
                      {TIPO_LABEL[r.tipo] ?? r.tipo}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                      {fmtDateOnly(r.dateFrom)} – {fmtDateOnly(r.dateTo)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">
                      {fmtDate(r.criadoEm)}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.revogado ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          revogado
                        </span>
                      ) : expirado ? (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                          expirado
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/r/${r.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        Ver
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
