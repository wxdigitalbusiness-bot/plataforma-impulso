import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  token: string;
  tipo: string;
  date_from: Date | null;
  date_to: Date | null;
  criado_em: Date;
  expira_em: Date | null;
  revogado: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  crm: "CRM",
  geral: "Geral",
};

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default async function PortalRelatoriosPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const rows = await db.$queryRaw<Row[]>`
    SELECT id, token, tipo, date_from, date_to, criado_em, expira_em, revogado
    FROM relatorios_publicos
    WHERE cliente_id = ${session.clienteId}
      AND (revogado = false OR revogado IS NULL)
      AND (expira_em IS NULL OR expira_em > NOW())
    ORDER BY criado_em DESC
  `;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Relatórios</h2>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Período</th>
                <th className="px-4 py-3 text-left font-medium">Gerado em</th>
                <th className="px-4 py-3 text-left font-medium">Expira</th>
                <th className="px-4 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">
                    {TIPO_LABEL[r.tipo] ?? r.tipo}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">
                    {r.date_from && r.date_to
                      ? `${fmtDate(r.date_from)} – ${fmtDate(r.date_to)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                    {fmtDate(r.criado_em)}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                    {fmtDate(r.expira_em)}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nenhum relatório disponível.
        </div>
      )}
    </div>
  );
}
