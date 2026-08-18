import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getResultadosFinanceiros } from "@/lib/db-insights";

export const dynamic = "force-dynamic";

type Origem = "todos" | "pago" | "organico";

function isValidIso(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type Props = { searchParams: Promise<{ from?: string; to?: string; origem?: string }> };

export default async function PortalResultadosPage({ searchParams }: Props) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const sp = await searchParams;
  const from = isValidIso(sp.from) ? sp.from : null;
  const to   = isValidIso(sp.to)   ? sp.to   : null;
  const origem: Origem = sp.origem === "pago" || sp.origem === "organico" ? sp.origem : "todos";

  const resultados = session.clientKey
    ? await getResultadosFinanceiros(session.clientKey, from, to, origem)
    : { leads: [], totalGeral: 0, totalPago: 0, totalOrganico: 0 };

  const { leads: rows, totalGeral, totalPago, totalOrganico } = resultados;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const filtroAtivo = from !== null || to !== null || origem !== "todos";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Resultados</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Total negociado por lead — apenas leads com valor registrado.
        </p>
      </div>

      <form action="/portal/resultados" method="GET" className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">Origem</label>
          <select
            name="origem"
            defaultValue={origem}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="pago">Tráfego pago</option>
            <option value="organico">Orgânico</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
        >
          Aplicar
        </button>

        {filtroAtivo && (
          <a
            href="/portal/resultados"
            className="mb-1.5 text-xs text-neutral-400 underline hover:text-neutral-700"
          >
            Limpar filtros
          </a>
        )}
      </form>

      {totalGeral > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Total geral</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(totalGeral)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Vindo de tráfego pago</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(totalPago)}</p>
            <p className="mt-0.5 text-[11px] text-blue-500">
              {totalGeral > 0 ? `${((totalPago / totalGeral) * 100).toFixed(0)}% do total` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Orgânico</p>
            <p className="mt-1 text-2xl font-bold text-neutral-700">{fmt(totalOrganico)}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {totalGeral > 0 ? `${((totalOrganico / totalGeral) * 100).toFixed(0)}% do total` : "—"}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum valor de negociação registrado no período/filtro selecionado.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Última negociação</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.leadId} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">
                    {r.leadNome || r.leadId}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{r.fase || "—"}</td>
                  <td className="px-4 py-3 text-neutral-500">{fmtDate(r.ultimaNegociacao)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {fmt(r.totalNegociado)}
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
